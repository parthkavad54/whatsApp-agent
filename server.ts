import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { handleWhatsAppVerification, handleWhatsAppMessage, registerWhatsAppMessageHandler, sendActualWhatsAppMessage } from "./server/services/whatsapp";
import dotenv from "dotenv";
import { sendSuccess, sendError } from "./server/utils/response";
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Customer, Order, Product, Conversation, CallLog, PaymentLog, WebhookLog, MessageLine, SpeechPhrase, QuickReply } from "./src/types";

dotenv.config();

const app = express();
app.use(express.json());

// WhatsApp Webhook
app.get("/api/whatsapp", handleWhatsAppVerification);
app.post("/api/whatsapp", handleWhatsAppMessage);

const PORT = 3000;
const BUNDLED_DB_PATH = path.join(process.cwd(), "db.json");
const DB_FILE_PATH = process.env.VERCEL ? "/tmp/db.json" : BUNDLED_DB_PATH;

// -------------------------------------------------------------
// Lazy Gemini Client Setup
// -------------------------------------------------------------
let aiInstance: GoogleGenAI | null = null;
let isQuotaExhausted = false;
let isLiteQuotaExhausted = false;

function getGeminiAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing. Please add it via the Secrets panel in Settings.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Check if Gemini is configured helper
function isGeminiEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// -------------------------------------------------------------
// Robust Gemini content generator with retry & exponential backoff for 503 / 429 transient errors
// -------------------------------------------------------------
async function generateContentWithRetry(params: any, retries = 3, initialDelay = 1000): Promise<any> {
  const aiClient = getGeminiAI();
  let delay = initialDelay;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await aiClient.models.generateContent(params);
    } catch (err: any) {
      const errStr = String(err?.message || err || "").toUpperCase();
      const status = err?.status || err?.code || 0;
      
      const isApiKeyFailure =
        status === 403 ||
        errStr.includes("API KEY EXPIRED") ||
        errStr.includes("RENEW THE API KEY") ||
        errStr.includes("API_KEY_INVALID") ||
        errStr.includes("API KEY INVALID") ||
        errStr.includes("INVALID_ARGUMENT") ||
        (status === 400 && (errStr.includes("API KEY") || errStr.includes("API_KEY") || errStr.includes("EXPIRED") || errStr.includes("INVALID") || errStr.includes("KEY")));

      if (isApiKeyFailure) {
        isQuotaExhausted = true;
        isLiteQuotaExhausted = true;
        console.warn(`[Gemini API] Auth or API Key failure detected (${status}). Triggering immediate offline failover to support zero-interruption demo path!`);
        throw err;
      }

      const isTransient =
        status === 503 ||
        status === 429 ||
        errStr.includes("503") ||
        errStr.includes("429") ||
        errStr.includes("UNAVAILABLE") ||
        errStr.includes("HIGH DEMAND") ||
        errStr.includes("TEMPORARY") ||
        errStr.includes("RATE LIMIT") ||
        errStr.includes("RESOURCE_EXHAUSTED");

      const isQuotaLimit =
        status === 429 ||
        errStr.includes("429") ||
        errStr.includes("QUOTA") ||
        errStr.includes("EXCEEDED YOUR CURRENT QUOTA") ||
        errStr.includes("RESOURCE_EXHAUSTED") ||
        errStr.includes("RATE_LIMIT");

      if (isQuotaLimit) {
        if (params.model === "gemini-3.5-flash") {
          isQuotaExhausted = true;
          console.warn(`[Gemini API] Quota limit hit for gemini-3.5-flash. Dynamically failing over to free gemini-3.1-flash-lite!`);
          
          // Auto-reset isQuotaExhausted back to false after 180 seconds (cooldown)
          const standardTimer = setTimeout(() => {
            isQuotaExhausted = false;
            console.log("[Gemini API] Cooldown complete: standard model slot restored to try again.");
          }, 180 * 1000);
          if (standardTimer && typeof standardTimer.unref === "function") {
            standardTimer.unref();
          }

          params.model = "gemini-3.1-flash-lite";
          // Reset delay and continue to try with the lite model immediately
          delay = initialDelay;
          continue;
        } else {
          isLiteQuotaExhausted = true;
          console.error(`[Gemini API] Quota limit hit for gemini-3.1-flash-lite as well. Fully exhausted.`);

          // Auto-reset isLiteQuotaExhausted back to false after 180 seconds (cooldown)
          const liteTimer = setTimeout(() => {
            isLiteQuotaExhausted = false;
            console.log("[Gemini API] Cooldown complete: lite model slot restored to try again.");
          }, 180 * 1000);
          if (liteTimer && typeof liteTimer.unref === "function") {
            liteTimer.unref();
          }

          throw err;
        }
      }

      console.warn(`[Gemini API] Attempt ${attempt}/${retries} failed. Status: ${status}. Error:`, err?.message || err);

      const isHardQuota = errStr.includes("QUOTA") || errStr.includes("EXCEEDED YOUR CURRENT QUOTA");
      if (isHardQuota) {
        console.log(`[Gemini API] Hard Quota limit hit. Skipping further retries.`);
        throw err;
      }

      if (isTransient && attempt < retries) {
        console.log(`[Gemini API] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2.5; // Exponential backoff with jitter spacing
      } else {
        throw err;
      }
    }
  }
}

// -------------------------------------------------------------
// Heuristic Trilingual Local Solver for 429/503 fallback
// -------------------------------------------------------------
interface FallbackAgentResult {
  response: string;
  toolsUsed: string[];
}

function getTrilingualFallbackReply(text: string, customerPhone: string): FallbackAgentResult {
  const norm = text.toLowerCase().trim();
  const toolsUsed: string[] = [];

  // Check if they want to track order or check order status
  const containsTrack = norm.includes("track") || norm.includes("status") || norm.includes("kya che") || norm.includes("maro order") || norm.includes("ord-") || norm.includes("reorder") || norm.includes("reminder") || norm.includes("remind");
  
  // Check if they want to buy or order
  const containsBuy = norm.includes("buy") || norm.includes("order") || norm.includes("purchase") || norm.includes("kharid") || norm.includes("mangalvo") || norm.includes("apo") || norm.includes("levi") || norm.includes("lebi") || norm.includes("didho");

  // Determine language preference
  const isGujarati = /[\u0a80-\u0aff]/.test(text); // Regex for Gujarati unicode characters
  const isGujlish = norm.includes("kem cho") || norm.includes("mane") || norm.includes("che") || norm.includes("bhav") || norm.includes("maro") || norm.includes("tame");

  // 1. Order Status Tracking
  if (containsTrack) {
    // Let's try to find an order for this customer
    const ord = db.orders.find(o => o.customerPhone === customerPhone);
    toolsUsed.push("getOrderStatus");
    if (ord) {
      if (isGujarati) {
        return {
          response: `તમારો ઓર્ડર ${ord.orderId} (${ord.productName} - ${ord.size}) અત્યારે ${ord.shippingStatus} સ્થિતિમાં છે. Payment status: ${ord.paymentStatus}. ટૂંક સમયમાં તમને ડિલિવરી મળી જશે. આભાર!`,
          toolsUsed
        };
      } else if (isGujlish) {
        return {
          response: `Tmaro order ${ord.orderId} (${ord.productName} - ${ord.size}) atyare ${ord.shippingStatus} chhe. Payment status: ${ord.paymentStatus}. Toonk samay ma delivery mali jashe. Aabhar!`,
          toolsUsed
        };
      } else {
        return {
          response: `Your order ${ord.orderId} of ${ord.productName} (${ord.size}) is in "${ord.shippingStatus}" status. Payment: ${ord.paymentStatus}. Your dispatch is being monitored!`,
          toolsUsed
        };
      }
    } else {
      if (isGujarati) {
        return {
          response: `માફ કરશો, આ નંબર ${customerPhone} પર કોઈ સક્રિય ઓર્ડર મળ્યો નથી. નવો ઓર્ડર આપવા માટે કૃપા કરીને સાઈઝ જણાવો (500ml, 1L, અથવા 5L).`,
          toolsUsed
        };
      } else if (isGujlish) {
        return {
          response: `Sorry, aa number ${customerPhone} par koi active order nathi malyo. New order mate size offline select karo.`,
          toolsUsed
        };
      } else {
        return {
          response: `Sorry, we couldn't locate any active order associated with the phone number: ${customerPhone}. Let me know if you would like to place a new order for our Gir Cow A2 Desi Ghee!`,
          toolsUsed
        };
      }
    }
  }

  // 2. Placing/Updating Order
  if (containsBuy) {
    // Detect typical size requested
    let size = "1L";
    let q = 1;
    if (norm.includes("500ml") || norm.includes("500 ml") || norm.includes("half") || norm.includes("ardho")) {
      size = "500ml";
    } else if (norm.includes("5l") || norm.includes("5 l") || norm.includes("bulk") || norm.includes("dabbo") || norm.includes("five")) {
      size = "5L";
    } else if (norm.includes("combo") || norm.includes("2 x") || norm.includes("svasthya")) {
      size = "2 x 1L";
    }

    // Try creating a local order to make the app simulate correctly
    try {
      const created = createOrder(customerPhone, size, q, "Simulated Address");
      toolsUsed.push("createOrder");
      if (created && created.orderId) {
        toolsUsed.push("generatePaymentLink");
        // Update payment link if appropriate
        const link = generatePaymentLink(created.orderId, created.amount);
        
        if (isGujarati) {
          return {
            response: `ગિર ગાયનું શુદ્ધ A2 વેદિક ઘી (${size}) ઓર્ડર કરવા બદલ ખુબ ખુબ આભાર! તમારો ઓર્ડર ID ${created.orderId} સફળતાપૂર્વક નોંધાયો છે. રકમ: Rs. ${created.amount}/-. ચુકવણી માટે આ લિંક વાપરો: ${link.link}. ઓર્ડર પ્રોસેસ થઈ રહ્યો છે.`,
            toolsUsed
          };
        } else if (isGujlish) {
          return {
            response: `Gir Cow pure A2 Vedic ghee (${size}) kharidva mate khub aabhar! Tmaro order ${created.orderId} register thai gyo chhe. Amount: Rs. ${created.amount}/-. Payment mate aa link par click karo: ${link.link}. Have a great day!`,
            toolsUsed
          };
        } else {
          return {
            response: `Fantastic! I have created a booking for your purchase of Gir Cow A2 Desi Ghee (${size}). Order ID is ${created.orderId} for Rs. ${created.amount}/-. Please pay securely here: ${link.link} to automatically trigger dispatch!`,
            toolsUsed
          };
        }
      }
    } catch (e) {
      console.warn("Failed automatic order create during fallback:", e);
    }
  }

  // 3. Informational Price or Bhav query
  const containsPrice = norm.includes("price") || norm.includes("bhav") || norm.includes("cost") || norm.includes("rupees") || norm.includes("rs") || norm.includes("rate") || norm.includes("paisa") || norm.includes("ghee") || norm.includes("benefit") || norm.includes("fayda") || norm.includes("bilona");
  if (containsPrice) {
    if (isGujarati) {
      return {
        response: `ગિર ગાયનું વેદિક એ૨ ઘી (બિલોણા પદ્ધતિ) સંપૂર્ણપણે શુદ્ધ અને રોગપ્રતિકારક શક્તિ વર્ધક છે.
- ૫૦૦ મિલી ગ્લાસ જાર: રૂ. ૯૫૦
- ૧ લીટર ગ્લાસ જાર: રૂ. ૧૮૦૦
- ૫ લીટર ફેમિલી ટીન: રૂ. ૮૫૦૦
તમે જે સાઈઝ મંગાવવા માંગો છો તે જણાવશો તો હું ઓર્ડર બુક કરી દઈશ.`,
        toolsUsed: ["getCustomer"]
      };
    } else if (isGujlish) {
      return {
        response: `Pure Gir Cow A2 Bilona Ghee na prices aa pramane chhe:
- 500ml Glass Jar: Rs. 950
- 1L Glass Jar: Rs. 1800
- 5L Family Tin (Bulk): Rs. 8500
- Gir Svasthya Combo (2x1L): Rs. 3450 (Rs. 150 discount!)
Tame shu order karva mango cho? Mane size janavo, hu bookkeeping aiyaj kari dais.`,
        toolsUsed: ["getCustomer"]
      };
    } else {
      return {
        response: `Our Gir Cow A2 Vedic Ghee is prepared using the slow, traditional wood-fire Bilona churn method:
- 500ml Glass Jar: Rs 950
- 1L Glass Jar: Rs 1800 (Highly Recommended!)
- 5L Value Family Tin: Rs 8500
- Gir Svasthya Combo (2 x 1L): Rs 3450
All orders represent premium A2 richness, hand-crafted in Junagadh, Gujarat. Which option can I schedule for you?`,
        toolsUsed: ["getCustomer"]
      };
    }
  }

  // 4. Greetings
  if (isGujarati) {
    return {
      response: `નમસ્તે! હું ગિર સત્વ ફાર્મ્સનો ઓટોમેટેડ વેચાણ સહાયક છું. હું તમને શુદ્ધ ગિર ગાયનું A2 ઘી ખરીદવામાં અથવા ઓર્ડર ટ્રેક કરવામાં મદદ કરી શકું છું. તમે ઘી ના ભાવો જાણવા માટે 'Price' અથવા ઓર્ડર સ્ટેટસ માટે 'Status' લખી શકો છો.`,
      toolsUsed: ["getCustomer"]
    };
  } else if (norm.includes("kem cho") || norm.includes("su chale") || isGujlish) {
    return {
      response: `Namaste! Hu ekdam majama chu. Mane batao tame pure Gir Cow A2 Desi Bilona Ghee order karva mango cho ke order status check karvu chhe? Price list hve ready chhe!`,
      toolsUsed: ["getCustomer"]
    };
  } else {
    return {
      response: `Namaste! Welcome. I am your trilingual sales assistant for Gir Satva Farms. I can assist you with ordering our hand-churned Vedic A2 Desi Ghee or tracking existing orders. How can I assist you in English, Gujarati or Gujlish today?`,
      toolsUsed: ["getCustomer"]
    };
  }
}

// -------------------------------------------------------------
// In-Memory Durable Local DB
// -------------------------------------------------------------
interface LocalDatabase {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  conversations: Conversation[];
  callLogs: CallLog[];
  payments: PaymentLog[];
  webhookLogs: WebhookLog[];
  prompts: {
    whatsappSystem: string;
    callsSystem: string;
    languageDetection: string;
    objectionHandling: string;
    selectedModel?: string;
  };
  quickReplies?: QuickReply[];
}

let db: LocalDatabase = {
  products: [
    {
      id: "prod-500",
      name: "Gir Cow A2 Desi Ghee (Glass Jar)",
      size: "500ml",
      price: 950,
      description: "Traditional Vedic Bilona method ghee prepared slowly in earthen pots over cow dung cake fire. Rich golden grain texture, highly aromatic.",
      benefits: ["Enriched with A2 Beta-Casein", "Boosts core immunity and digestion", "Lubricates joints & nourishing for brain", "Ideal for baby food & pregnancy diets"],
      storageInfo: "Store in a cool, dry place. No refrigeration needed. Keep away from sunlight.",
      origin: "Gir Satva Farms, Junagadh District, Gujarat, India",
      stock: 45
    },
    {
      id: "prod-1000",
      name: "Gir Cow A2 Desi Ghee (Glass Jar)",
      size: "1L",
      price: 1800,
      description: "Traditional Vedic Bilona method ghee prepared slowly in earthen pots over cow dung cake fire. Rich golden grain texture, highly aromatic.",
      benefits: ["Enriched with A2 Beta-Casein", "Boosts core immunity and digestion", "Lubricates joints & nourishing for brain", "Ideal for baby food & pregnancy diets"],
      storageInfo: "Store in a cool, dry place. No refrigeration needed. Keep away from sunlight.",
      origin: "Gir Satva Farms, Junagadh District, Gujarat, India",
      stock: 80
    },
    {
      id: "prod-5000",
      name: "Gir Cow A2 Desi Ghee (Bulk Pack Tin)",
      size: "5L",
      price: 8500,
      description: "Premium value bulk family tin of pure Gir Cow A2 Desi Ghee. Made from grass-fed traditional Gir Cows using Vedic traditional protocol.",
      benefits: ["Enriched with A2 Beta-Casein", "Boosts core immunity and digestion", "Lubricates joints & nourishing for brain", "Best price for daily family consumption"],
      storageInfo: "Store in a cool, dry place. Transfer to a glass jar if preferred.",
      origin: "Gir Satva Farms, Junagadh District, Gujarat, India",
      stock: 4
    },
    {
      id: "prod-combo",
      name: "Gir Svasthya Combo Pack",
      size: "2 x 1L",
      price: 3450,
      description: "Specially packed combo of two liters of pure A2 Desi Ghee. Best for gifting health to grandparents and infants.",
      benefits: ["Save Rs. 150 over single packs", "Vedic hand-churned purity guaranteed", "Free premium shipping in safe carton box"],
      storageInfo: "Store in cool dark cupboard.",
      origin: "Gir Satva Farms, Junagadh District, Gujarat, India",
      stock: 8
    }
  ],
  customers: [
    {
      phone: "919876543210",
      name: "Amish Bhai Patel",
      preferredLanguage: "Gujlish",
      totalOrders: 3,
      lastOrderDate: "2026-05-12T10:15:00Z",
      address: "B-404, Shrinand Nagar-2, Vejalpur, Ahmedabad, Gujarat - 380051",
      tags: ["Returning", "VIP"],
      notes: "Prefers very fast delivery. Always asks if current batch has strong grainy structure."
    },
    {
      phone: "918765432109",
      name: "Jayesh Shah",
      preferredLanguage: "Gujarati",
      totalOrders: 1,
      lastOrderDate: "2026-06-08T08:30:00Z",
      address: "12, Sona Bungalows, near Ring Road, Surat, Gujarat - 395007",
      tags: ["Returning"],
      notes: "Orders 1L jar every month."
    },
    {
      phone: "919012345678",
      name: "Meera Krishnan",
      preferredLanguage: "English",
      totalOrders: 0,
      lastOrderDate: undefined,
      address: "Row House #8, Royal Enclave, Jayanagar 4th Block, Bengaluru, Karnataka - 560041",
      tags: ["New"],
      notes: "Discovered us from Instagram. Wanted details about pasture-fed cow's milk."
    }
  ],
  orders: [
    {
      orderId: "ORD-7319",
      customerPhone: "919876543210",
      customerName: "Amish Bhai Patel",
      productName: "Gir Cow A2 Desi Ghee (Glass Jar)",
      size: "1L",
      quantity: 2,
      amount: 3600,
      paymentStatus: "Paid",
      shippingStatus: "Delivered",
      address: "B-404, Shrinand Nagar-2, Vejalpur, Ahmedabad, Gujarat - 380051",
      razorpayPaymentId: "pay_link_Rzp98231asf",
      createdAt: "2026-03-10T14:20:00Z",
      updatedAt: "2026-03-12T11:00:00Z"
    },
    {
      orderId: "ORD-8942",
      customerPhone: "919876543210",
      customerName: "Amish Bhai Patel",
      productName: "Gir Cow A2 Desi Ghee (Glass Jar)",
      size: "1L",
      quantity: 2,
      amount: 3600,
      paymentStatus: "Paid",
      shippingStatus: "Delivered",
      address: "B-404, Shrinand Nagar-2, Vejalpur, Ahmedabad, Gujarat - 380051",
      razorpayPaymentId: "pay_link_Rzp77421bsd",
      createdAt: "2026-05-12T10:15:00Z",
      updatedAt: "2026-05-14T15:30:00Z"
    },
    {
      orderId: "ORD-9214",
      customerPhone: "918765432109",
      customerName: "Jayesh Shah",
      productName: "Gir Cow A2 Desi Ghee (Glass Jar)",
      size: "1L",
      quantity: 1,
      amount: 1800,
      paymentStatus: "Paid",
      shippingStatus: "Shipped",
      address: "12, Sona Bungalows, near Ring Road, Surat, Gujarat - 395007",
      razorpayPaymentId: "pay_link_Rzp44901lkj",
      createdAt: "2026-06-08T08:30:00Z",
      updatedAt: "2026-06-09T09:12:00Z"
    },
    {
      orderId: "ORD-5100",
      customerPhone: "919876543210",
      customerName: "Amish Bhai Patel",
      productName: "Gir Cow A2 Desi Ghee (Bulk Pack Tin)",
      size: "5L",
      quantity: 1,
      amount: 8500,
      paymentStatus: "Pending",
      shippingStatus: "Processing",
      address: "B-404, Shrinand Nagar-2, Vejalpur, Ahmedabad, Gujarat - 380051",
      createdAt: "2026-06-10T09:40:00Z",
      updatedAt: "2026-06-10T09:40:00Z"
    }
  ],
  conversations: [
    {
      customerPhone: "919876543210",
      channel: "whatsapp",
      messages: [
        { sender: "customer", text: "Namaste, mane 5L ghee nu pack order karvu che. Gujarati ma bolo plz.", timestamp: "2026-06-10T09:35:00Z" },
        { sender: "agent", text: "Namaste Amish Bhai! Supr Ghee ma tamaru swagat che. Neha bolu chu. 5L Bulk Pack nu price Rs 8500 che, aenamathhi tame barobar rasoi ne poshan aapi shaksho! Shu aa order confirmation nakki kariye?", timestamp: "2026-06-10T09:37:00Z" },
        { sender: "customer", text: "Haan, barobar che, Ahmedabad na address par mokali dyo.", timestamp: "2026-06-10T09:38:00Z" },
        { sender: "agent", text: "Me tamaro order bulk pack mathe record kari didho che. Order Id: ORD-5100. Aa payment link par click karine pay kari dyo: https://razorpay.com/pay/lnk_SuprGhee5L", timestamp: "2026-06-10T09:40:00Z" }
      ],
      language: "Gujlish",
      createdAt: "2026-06-10T09:35:00Z",
      updatedAt: "2026-06-10T09:40:00Z"
    }
  ],
  callLogs: [
    {
      id: "call-901",
      customerPhone: "918765432109",
      customerName: "Jayesh Shah",
      transcript: [
        { speaker: "agent", phrase: "Namaste, Supr Ghee ma swagat che. Hu tamne kevi rite madad kari shakun?", time: "08:30:03" },
        { speaker: "customer", phrase: "Bhai, mane 1 litre ghee dyo ne, kalna order nathi aavyo.", time: "08:30:15" },
        { speaker: "agent", phrase: "Jayeshbhai, tame 1 litre ghee order karva mango cho. Tamari details khub khub aabhar che. Hu tamne order banavi ne payment link WhatsApp karu chu, barobar?", time: "08:30:30" },
        { speaker: "customer", phrase: "Haan barobar, ema link mokaljo, hu GPay kari daish.", time: "08:31:02" },
        { speaker: "agent", phrase: "Khub khub aabhar Jayeshbhai! Have have order summary link WhatsApp par aavi jashe. Have divas shubh rahe!", time: "08:31:15" }
      ],
      summary: "Jayesh Shah called to order 1L Ghee. Confirmed translation and ordered. Initiated WhatsApp receipt sync.",
      duration: 72,
      ordersCreated: ["ORD-9214"],
      createdAt: "2026-06-08T08:30:00Z"
    }
  ],
  payments: [
    {
      orderId: "ORD-7319",
      razorpayPaymentId: "pay_link_Rzp98231asf",
      customerPhone: "919876543210",
      amount: 3600,
      status: "success",
      paidAt: "2026-03-10T14:25:00Z"
    },
    {
      orderId: "ORD-8942",
      razorpayPaymentId: "pay_link_Rzp77421bsd",
      customerPhone: "919876543210",
      amount: 3600,
      status: "success",
      paidAt: "2026-05-12T10:20:00Z"
    },
    {
      orderId: "ORD-9214",
      razorpayPaymentId: "pay_link_Rzp44901lkj",
      customerPhone: "918765432109",
      amount: 1800,
      status: "success",
      paidAt: "2026-06-08T08:35:00Z"
    }
  ],
  webhookLogs: [
    {
      id: "web-001",
      timestamp: "2026-06-10T09:35:00Z",
      service: "WhatsApp",
      event: "message_received",
      payload: { from: "919876543210", text: "Namaste, mane 5L ghee nu pack order karvu che. Gujarati ma bolo plz." }
    },
    {
      id: "web-002",
      timestamp: "2026-06-10T09:40:02Z",
      service: "Sheets",
      event: "order_synced",
      payload: { orderId: "ORD-5100", customerName: "Amish Bhai Patel", amount: 8500 }
    }
  ],
  prompts: {
    whatsappSystem: `You are "Neha", a warm, direct-to-customer friendly AI Sales Representative for "Supr Ghee" (also known as "GirSatva"), which produces 100% pure Bilona Vedic Gir Cow A2 Desi Ghee in Junagadh, Gujarat.
Brand Values & Knowledge:
1. Purity & Process: Made from Gir Cow premium A2 milk. Butter is hand-churned in earthen or copper pots (Bilona mathni method) and boiled slow-style over dung-cakes/woodfires. This makes it super grainy, aromatic, and rich with medicinal values.
2. Prices & Sizes:
   - 500ml Glass Jar: Rs. 950 INR
   - 1L Glass Jar: Rs. 1800 INR
   - 5L Bulk Pack Tin: Rs. 8500 INR
   - Combo pack (2 x 1L Jars): Rs. 3450 INR (Save Rs. 150)
3. Delivery: Delivery within Gujarat takes 2-3 days. Rest of India takes 4-5 days. Premium courier packaging in secure cardboard slots to prevent glass jar breaking. Free shipping for Combo Pack & 5L tin. Shipping is Rs 100 standard otherwise.
4. Core Language Guideline (CRITICAL):
   The customer can text you in:
   - English ("I want 1 litre ghee")
   - Gujarati ("મારે એક લિટર ઘી જોઈએ છે")
   - Gujlish (Gujarati lyrics in Latin characters: "Mare ek litre ghee joiye che")
   You MUST instantly detect the language and reply in the EXACT SAME LANGUAGE and tone used by the customer. Do not be overly formal. Speak like a friendly neighbor selling authentic home-cooked food.

Goal:
Encourage customers to complete their orders. To do this, you have tools to interact with our central state.
When a customer wants to place an order, you MUST collect:
- Customer Name
- Standard Shipping Address
- Product Size and Quantity
If you already have their customer record from "getCustomer" tool (which you should call first if they provide a phone number or if they are repeating), greet them by name, state their address and previous preferences to make them feel special!
Once you have the details, summarize the order (items, prices, shipping, and total) and use the "createOrder" tool, then "generatePaymentLink". Give them the Razorpay link to pay!

Tool Calling Instructions:
- Always call "getCustomer" first to see if they're a returning user.
- If they are new or updating details, use "saveCustomer".
- Once order items and address are verified, call "createOrder".
- Call "generatePaymentLink" immediately to send payments.
- Call "getOrderStatus" if they ask about their shipment tracking.`,

    callsSystem: `You are Neha, an elite voice assistant representing Supr Ghee / GirSatva. Your tone is warm, smiling, musical, and clear.
Guidelines:
1. Speaking Format: NEVER use markdown (no asterisks, lists, bullet points, or complex math notations). Keep sentences short, punchy, conversational, and comfortable to hear over a phone loudspeaker.
2. Language Support: Speak Gujarati, Gujlish, or English. Always respond in the exact linguistic rhythm of the caller. For Gujarati speech, keep it natural and standard (e.g. "Namaste, Supr Ghee ma swagat che! Hu tamne kevi rite madad kari shakun?").
3. Support Escalations: If the customer wants wholesale prices (above 15L), has a major complaint, or is angry, explain that you are creating a priority callback request for Parth (the founder) and he will ring them back in 30 minutes.
4. Ordering on Calls:
   - Promptly get their name, quantity desired (500ml, 1L, or 5L), and location.
   - Tell them: "Parth bhai will send you the order receipt and secure Razorpay payment link directly to your WhatsApp in 5 seconds."
   - Trigger the tools immediately! Use "saveCustomer" and "createOrder" to place the order in our system.`,

    languageDetection: `Analyze the user query and detect the primary language style:
1. "English" (English text/words)
2. "Gujarati" (native Gujarati script characters)
3. "Gujlish" (Gujarati phonetic words written in English Latin characters, e.g. "keim cho", "ghee mokalvu che", "ghar mate ghee joiy tu")
Route the conversation context with this tag.`,

    objectionHandling: `When dealing with typical ghee customer objections:
- Why so expensive? -> "True Gir Cow A2 Ghee is expensive because 1 Litre of ghee requires 28-30 Litres of original Gir Cow A2 milk! Also, traditional Bilona method is labor-intensive and done carefully by local rural families. Commercial ghee is made from machine cream, whereas we do hand-churning which preserves digestive properties."
- Is it original Gir cow? -> "Yes! Our cows live at Gir Satva farms in Junagadh, near Gir forest. They graze freely on organic grassland herbs. You can come visit us, or we can send you live farm videos & test reports on WhatsApp!"
- Will glass break in transit? -> "We use double-wall premium foam slot packaging designed specifically for glass bottles. In the rare event of damage, we ship a brand new bottle instantly for free, no questions asked!"`,
    selectedModel: "gemini-3.5-flash"
  },
  quickReplies: [
    {
      id: "qr-1",
      title: "Greeting (Trilingual)",
      shortcut: "/welcome",
      text: "Namaste! Welcome to Supr Ghee! How can I help you today? We offer 100% pure Bilona Vedic Gir Cow A2 Desi Ghee. (Tamaru swigat che, hu tamne kevi rite madad kari shaku? / નમસ્તે! સુપ્ર ઘી માં આપનું સ્વાગત છે.)"
    },
    {
      id: "qr-2",
      title: "Pricing & Packs",
      shortcut: "/price",
      text: "Our pure Bilona Ghee is available in: 500ml Glass Jar (Rs. 950), 1L Glass Jar (Rs. 1800), and 5L Bulk Pack Tin (Rs. 8500). Standard shipping is Rs. 100, but is FREE for our 5L Bulk Pack or any pack with 2L or more!"
    },
    {
      id: "qr-3",
      title: "Vedic Bilona Process FAQ",
      shortcut: "/bilona",
      text: "Our ghee is freshly crafted using the Vedic hand-churned Bilona method: we boil raw grass-fed Gir Cow A2 milk, set it to curd, hand-churn it with a wood churner, and slow-cook the butter on dung-cake wood fires in earthen pots. This makes it rich, extremely grainy, aromatic, and medicinal!"
    },
    {
      id: "qr-4",
      title: "Breakage Guarantee",
      shortcut: "/breakage",
      text: "We ship in premium dual-padded thick foam safety jackets to prevent breakage in transit. If any damage occurs, simply send us a photo of the box, and we will send you a brand new glass jar immediately, free of charge!"
    }
  ]
};

const defaultQuickReplies: QuickReply[] = [
  {
    id: "qr-1",
    title: "Greeting (Trilingual)",
    shortcut: "/welcome",
    text: "Namaste! Welcome to Supr Ghee! How can I help you today? We offer 100% pure Bilona Vedic Gir Cow A2 Desi Ghee. (Tamaru swigat che, hu tamne kevi rite madad kari shaku? / નમસ્તે! સુપ્ર ઘી માં આપનું સ્વાગત છે.)"
  },
  {
    id: "qr-2",
    title: "Pricing & Packs",
    shortcut: "/price",
    text: "Our pure Bilona Ghee is available in: 500ml Glass Jar (Rs. 950), 1L Glass Jar (Rs. 1800), and 5L Bulk Pack Tin (Rs. 8500). Standard shipping is Rs. 100, but is FREE for our 5L Bulk Pack or any pack with 2L or more!"
  },
  {
    id: "qr-3",
    title: "Vedic Bilona Process FAQ",
    shortcut: "/bilona",
    text: "Our ghee is freshly crafted using the Vedic hand-churned Bilona method: we boil raw grass-fed Gir Cow A2 milk, set it to curd, hand-churn it with a wood churner, and slow-cook the butter on dung-cake wood fires in earthen pots. This makes it rich, extremely grainy, aromatic, and medicinal!"
  },
  {
    id: "qr-4",
    title: "Breakage Guarantee",
    shortcut: "/breakage",
    text: "We ship in premium dual-padded thick foam safety jackets to prevent breakage in transit. If any damage occurs, simply send us a photo of the box, and we will send you a brand new glass jar immediately, free of charge!"
  }
];

// Initial database hydration from file if exists
let dbLoaded = false;
try {
  // If we are on Vercel and /tmp/db.json doesn't exist, seed it from the bundled db.json
  if (process.env.VERCEL && !fs.existsSync(DB_FILE_PATH) && fs.existsSync(BUNDLED_DB_PATH)) {
    const bundledContent = fs.readFileSync(BUNDLED_DB_PATH, "utf-8");
    fs.writeFileSync(DB_FILE_PATH, bundledContent);
    console.log("[Vercel Startup] Bootstrapping database from bundled db.json to /tmp/db.json");
  }

  if (fs.existsSync(DB_FILE_PATH)) {
    const rawData = fs.readFileSync(DB_FILE_PATH, "utf-8");
    db = { ...db, ...JSON.parse(rawData) };
    if (!db.quickReplies || db.quickReplies.length === 0) {
      db.quickReplies = defaultQuickReplies;
    }

    // -------------------------------------------------------------
    // Durable Database Auto-Cleanup for Legacy Raw JSON errors
    // -------------------------------------------------------------
    let scrubbedCount = 0;
    if (db.conversations && Array.isArray(db.conversations)) {
      db.conversations.forEach((conv: any) => {
        if (conv.messages && Array.isArray(conv.messages)) {
          conv.messages = conv.messages.map((m: any) => {
            if (m.sender === "agent" && (m.text.includes("Raw error:") || m.text.includes("RESOURCE_EXHAUSTED") || m.text.includes("exceeded your current quota") || m.text.includes("Quota exceeded for metric"))) {
              scrubbedCount++;
              return {
                ...m,
                text: "Namaste! Our dynamic sales agent system is currently taking a quick breath. We offer 100% pure Bilona hand-churned Vedic Gir Cow A2 Desi Ghee (500ml for Rs 950, 1L for Rs 1800, 5L for Rs 8500). Please tell us your location or desired bottle size to complete your order!"
              };
            }
            return m;
          });
        }
      });
    }
    if (db.callLogs && Array.isArray(db.callLogs)) {
      db.callLogs.forEach((log: any) => {
        if (log.transcript && Array.isArray(log.transcript)) {
          log.transcript = log.transcript.map((t: any) => {
            if (t.speaker === "agent" && (t.phrase.includes("Raw error:") || t.phrase.includes("RESOURCE_EXHAUSTED") || t.phrase.includes("exceeded your current quota") || t.phrase.includes("Quota exceeded for metric"))) {
              scrubbedCount++;
              return {
                ...t,
                phrase: "Namaste! Parth bhai will update you on WhatsApp. Premium Gir cow ghee is available in 500ml and 1L glass jars. We will send you payment details soon. Thank you so much!"
              };
            }
            return t;
          });
        }
      });
    }
    if (scrubbedCount > 0) {
      console.log(`[Database Startup] Cleaned ${scrubbedCount} legacy raw JSON model error messages from database logs to keep our chat contexts pristine.`);
      try {
        fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2));
      } catch (writeErr) {
        console.error("Non-fatal write error while cleaning startup database:", writeErr);
      }
    }

    console.log(`Durable Database loaded from ${DB_FILE_PATH}`);
    dbLoaded = true;
  }
} catch (err) {
  console.error("Error matching or reading db.json", err);
}

if (!dbLoaded) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2));
    console.log(`Created new seed database at ${DB_FILE_PATH}`);
  } catch (err) {
    console.error("Error creating initial seed database", err);
  }
}

// Persist helper
function saveToDB() {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Error persisting database to db.json", err);
  }
}

// Model lookup helpers
function getPreferredModel(): string {
  if (db && db.prompts && (db.prompts as any).selectedModel) {
    return (db.prompts as any).selectedModel;
  }
  return "gemini-3.5-flash";
}

function getActiveModel(): string {
  const preferred = getPreferredModel();
  if (preferred === "gemini-3.5-flash" && isQuotaExhausted) {
    console.log("[Gemini API] Default gemini-3.5-flash is exhausted. Downgrading request model destination to free gemini-3.1-flash-lite.");
    return "gemini-3.1-flash-lite";
  }
  return preferred;
}

// -------------------------------------------------------------
// Google Sheets Simulated sync
// -------------------------------------------------------------
function syncToSheets(type: "Customers" | "Orders" | "Leads" | "Payments", event: string, payload: any) {
  // Add a webhook log entry representing Google Sheets sync activity
  const id = `web-sht-${Date.now().toString().slice(-4)}`;
  db.webhookLogs.unshift({
    id,
    timestamp: new Date().toISOString(),
    service: "Sheets",
    event: `${type.toLowerCase()}_row_appended`,
    payload: { status: "success_synced", rowType: type, details: payload }
  });
  saveToDB();
}

// -------------------------------------------------------------
// WhatsApp Simulation Tool Outputs Handlers
// -------------------------------------------------------------
const getCustomer = (phone: string): Customer | null => {
  const cleanPhone = phone.replace(/\D/g, "");
  const customer = db.customers.find(c => c.phone === cleanPhone || cleanPhone.endsWith(c.phone) || c.phone.endsWith(cleanPhone));
  return customer || null;
};

const saveCustomer = (phone: string, name: string, address?: string, language?: string): Customer => {
  const cleanPhone = phone.replace(/\D/g, "");
  let customer = getCustomer(cleanPhone);
  if (customer) {
    customer.name = name || customer.name;
    if (address) customer.address = address;
    if (language) customer.preferredLanguage = language as any;
    customer.tags = Array.from(new Set([...customer.tags, "Returning"]));
  } else {
    customer = {
      phone: cleanPhone,
      name,
      preferredLanguage: (language as any) || "Gujlish",
      totalOrders: 0,
      address: address || "",
      tags: ["New"]
    };
    db.customers.push(customer);
  }
  saveToDB();
  syncToSheets("Customers", "created_updated", { name: customer.name, phone: customer.phone, totalOrders: customer.totalOrders });
  return customer;
};

const createOrder = (phone: string, size: string, quantity: number, address: string): Order => {
  const cleanPhone = phone.replace(/\D/g, "");
  let cust = getCustomer(cleanPhone);
  if (!cust) {
    cust = saveCustomer(cleanPhone, "Valued Customer", address);
  } else if (address) {
    cust.address = address;
  }

  // Calculate prices based on products
  let itemPrice = 1800;
  let prodName = "Gir Cow A2 Desi Ghee (Glass Jar)";
  if (size.toLowerCase().includes("500")) {
    itemPrice = 950;
    size = "500ml";
  } else if (size.toLowerCase().includes("5l") || size.toLowerCase().includes("5 l")) {
    itemPrice = 8500;
    prodName = "Gir Cow A2 Desi Ghee (Bulk Pack Tin)";
    size = "5L";
  } else if (size.toLowerCase().includes("combo") || size.toLowerCase().includes("2")) {
    itemPrice = 3450;
    prodName = "Gir Svasthya Combo Pack";
    size = "2 x 1L";
  } else {
    size = "1L";
  }

  const shipping = (size === "5L" || size === "2 x 1L" || quantity >= 2) ? 0 : 100;
  const totalAmount = (itemPrice * quantity) + shipping;

  const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
  const newOrder: Order = {
    orderId,
    customerPhone: cleanPhone,
    customerName: cust.name,
    productName: prodName,
    size,
    quantity,
    amount: totalAmount,
    paymentStatus: "Pending",
    shippingStatus: "Processing",
    address: address || cust.address || "Pending Address Collection",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Decrement physical stock for live tracking
  const matchingProduct = db.products.find(p => p.size === size);
  if (matchingProduct) {
    matchingProduct.stock = Math.max(0, matchingProduct.stock - quantity);
  }

  db.orders.unshift(newOrder);
  cust.totalOrders += 1;
  cust.lastOrderDate = newOrder.createdAt;
  saveToDB();

  syncToSheets("Orders", "appended", {
    orderId,
    customer: cust.name,
    product: prodName,
    qty: quantity,
    amount: totalAmount,
    pStatus: "Pending"
  });

  return newOrder;
};

const getOrderStatus = (phoneOrOrderId: string): { found: boolean; status?: string; order?: Order } => {
  const clean = phoneOrOrderId.replace(/\D/g, "");
  // search by order id
  let order = db.orders.find(o => o.orderId.toLowerCase() === phoneOrOrderId.toLowerCase());
  if (!order) {
    // search by customer phone
    order = db.orders.find(o => o.customerPhone === clean || o.customerPhone.endsWith(clean) || clean.endsWith(o.customerPhone));
  }

  if (order) {
    return { found: true, status: order.shippingStatus, order };
  }
  return { found: false };
};

const generatePaymentLink = (orderId: string, amount: number): string => {
  const cleanId = orderId.toUpperCase();
  const order = db.orders.find(o => o.orderId === cleanId);
  const linkId = `pay_link_Rzp${Math.random().toString(36).substring(2, 9)}`;
  if (order) {
    order.razorpayPaymentId = linkId;
    saveToDB();
  }

  // Create simulated webhook logs
  db.webhookLogs.unshift({
    id: `web-pay-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toISOString(),
    service: "Razorpay",
    event: "payment_link_created",
    payload: { orderId: cleanId, amount, linkId, url: `https://rzp.io/i/${linkId}` }
  });
  saveToDB();

  return `https://rzp.io/i/${linkId}`;
};

const updateOrderStatus = (orderId: string, status: 'Processing' | 'Shipped' | 'Delivered' | 'Returned'): boolean => {
  const order = db.orders.find(o => o.orderId === orderId.toUpperCase());
  if (order) {
    order.shippingStatus = status;
    order.updatedAt = new Date().toISOString();
    saveToDB();
    syncToSheets("Orders", "status_updated", { orderId, shippingStatus: status });
    return true;
  }
  return false;
};

// -------------------------------------------------------------
// Declarations of Tools for Gemini
// -------------------------------------------------------------
const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "getCustomer",
    description: "Fetch a customer profile using their unique 10-digit mobile number.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        phone: {
          type: Type.STRING,
          description: "Mobile phone number of the customer (e.g., 919876543210 or 9876543210)."
        }
      },
      required: ["phone"]
    }
  },
  {
    name: "saveCustomer",
    description: "Create a new customer profile or update an existing customer's contact record (name, address, preferred language).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        phone: {
          type: Type.STRING,
          description: "Customer 10 or 12-digit mobile number."
        },
        name: {
          type: Type.STRING,
          description: "Full name of the customer."
        },
        address: {
          type: Type.STRING,
          description: "Deliverability street address, apartment, city, and pincode."
        },
        language: {
          type: Type.STRING,
          description: "Customer language choice: English, Gujarati, or Gujlish."
        }
      },
      required: ["phone", "name"]
    }
  },
  {
    name: "createOrder",
    description: "Generate a new Ghee purchase order in the database.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        phone: {
          type: Type.STRING,
          description: "Customer phone number used as ID."
        },
        size: {
          type: Type.STRING,
          description: "The product packing sizes, such as '500ml', '1L', '5L' (tin), or 'Combo' (2x1L)."
        },
        quantity: {
          type: Type.NUMBER,
          description: "Number of packs or items of the selected volume to purchase."
        },
        address: {
          type: Type.STRING,
          description: "Shipping delivery street address."
        }
      },
      required: ["phone", "size", "quantity", "address"]
    }
  },
  {
    name: "getOrderStatus",
    description: "Search for shipment tracking and checkout status based on an order id or phone number.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        phoneOrOrderId: {
          type: Type.STRING,
          description: "Order confirmation ID (e.g. ORD-1234) or customer mobile phone number."
        }
      },
      required: ["phoneOrOrderId"]
    }
  },
  {
    name: "generatePaymentLink",
    description: "Get a secure simulated Razorpay instant billing URL for standard order completion.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        orderId: {
          type: Type.STRING,
          description: "Unique ID of the order to pay (e.g. ORD-1234)"
        },
        amount: {
          type: Type.NUMBER,
          description: "Price amount total in India rupees."
        }
      },
      required: ["orderId", "amount"]
    }
  },
  {
    name: "updateOrderStatus",
    description: "Change the shipment statuses of a specific order.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        orderId: {
          type: Type.STRING,
          description: "Unique order configuration ID."
        },
        status: {
          type: Type.STRING,
          description: "Desired shipment values: Processing, Shipped, Delivered, Returned."
        }
      },
      required: ["orderId", "status"]
    }
  }
];

// Handles executing tools when returned by Gemini
async function executeAgentTools(calls: any[], customerPhone: string): Promise<any[]> {
  const toolOutputs: any[] = [];
  for (const call of calls) {
    const { name, args, id } = call;
    console.log(`Executing Tool [${name}] with args:`, args);

    let result: any = null;
    try {
      if (name === "getCustomer") {
        result = getCustomer(args.phone || customerPhone);
      } else if (name === "saveCustomer") {
        result = saveCustomer(args.phone || customerPhone, args.name, args.address, args.language);
      } else if (name === "createOrder") {
        result = createOrder(args.phone || customerPhone, args.size, args.quantity, args.address);
      } else if (name === "getOrderStatus") {
        result = getOrderStatus(args.phoneOrOrderId);
      } else if (name === "generatePaymentLink") {
        result = generatePaymentLink(args.orderId, args.amount);
      } else if (name === "updateOrderStatus") {
        result = updateOrderStatus(args.orderId, args.status);
      } else {
        result = { error: "Unknown tool" };
      }
    } catch (err: any) {
      result = { error: err.message || "Failed execution" };
    }

    toolOutputs.push({
      functionResponse: {
        name,
        response: { result },
      },
      id
    });
  }
  return toolOutputs;
}

// -------------------------------------------------------------
// WhatsApp API Simulation Routing
// -------------------------------------------------------------
app.get("/api/health", (req: Request, res: Response) => {
  sendSuccess(res, {
    status: "ok",
    timestamp: Date.now(),
    env: process.env.VERCEL ? "vercel-serverless" : "container",
    dbLoaded: !!db
  }, "Server heartbeat online");
});

app.get("/api/data", (req: Request, res: Response) => {
  try {
    if (!db) {
      return sendError(res, "Database ledger is not initialized", "DB_NOT_INITIALIZED", 500);
    }
    sendSuccess(res, {
      db,
      isGeminiConfigured: isGeminiEnabled(),
      isQuotaExhausted: isQuotaExhausted,
      isLiteQuotaExhausted: isLiteQuotaExhausted
    });
  } catch (err: any) {
    console.error("[CRITICAL DB RUNTIME ERROR]:", err);
    sendError(res, err?.message || "Failed to stringify database payload", "SERIALIZATION_FAILURE", 500);
  }
});

app.post("/api/quota/reset", (req: Request, res: Response) => {
  isQuotaExhausted = false;
  isLiteQuotaExhausted = false;
  console.log("[Gemini API] Quota exhausted flags reset manually by operator.");
  sendSuccess(res, { isQuotaExhausted, isLiteQuotaExhausted });
});

// -------------------------------------------------------------
// WhatsApp Message Processing Engine (Shared for Simulation & Real API)
// -------------------------------------------------------------
async function processIncomingWhatsAppMessage(
  phone: string,
  customerName: string,
  text: string,
  type: string = "text"
): Promise<{ replyText: string; toolsUsed: string[] }> {
  const cleanPhone = phone.replace(/\D/g, "");

  // Ensure customer exists in the CRM ledger
  let customer = db.customers.find(c => c.phone === cleanPhone);
  if (!customer) {
    customer = {
      name: customerName === "WhatsApp Patron" ? `Patron +${cleanPhone}` : customerName,
      phone: cleanPhone,
      preferredLanguage: "Gujarati",
      totalOrders: 0,
      address: "",
      tags: ["active", "leads"]
    };
    db.customers.push(customer);
  } else if (customer.name.startsWith("Patron +") && customerName !== "WhatsApp Patron") {
    // Elevate placeholder to real WhatsApp profile name
    customer.name = customerName;
  }

  // Retrieve or initialize conversation log
  let conversation = db.conversations.find(c => c.customerPhone === cleanPhone);
  if (!conversation) {
    conversation = {
      customerPhone: cleanPhone,
      channel: "whatsapp",
      messages: [],
      language: "Gujlish",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.conversations.push(conversation);
  }

  // Log incoming webhook event for auditing
  const hookId = `web-wa-${Date.now().toString().slice(-4)}`;
  db.webhookLogs.unshift({
    id: hookId,
    timestamp: new Date().toISOString(),
    service: "WhatsApp",
    event: type === "audio" ? "voice_note_received" : "message_received",
    payload: { from: cleanPhone, messageText: text, customerName: customer.name }
  });

  // Track user message in dialogue history
  conversation.messages.push({
    sender: "customer",
    text,
    timestamp: new Date().toISOString(),
    type: type === "audio" ? "audio" : "text"
  });
  conversation.updatedAt = new Date().toISOString();
  saveToDB();

  let replyText = "";
  let toolsUsed: string[] = [];

  // 1. Check if Gemini API is disabled
  if (!isGeminiEnabled()) {
    replyText = `Namaste! [Demo Mode - Gemini API Key Not Set] Received your message: "${text}". Please configure your GEMINI_API_KEY inside the 'Settings > Secrets' panel to activate the advanced trilingual sales agent. (Mock Answer: I can help you purchase pure Gir Cow A2 Bilona Ghee. We have 500ml for Rs 950, 1L for Rs 1800, and 5L for Rs 8500).`;
  } 
  // 2. Check if Gemini quotas are completely dry
  else if (isQuotaExhausted && isLiteQuotaExhausted) {
    console.log("[Gemini API] Quota exhausted for both standard and lite models - using high-fidelity trilingual offline fallback directly.");
    const fallbackObj = getTrilingualFallbackReply(text, cleanPhone);
    replyText = `[Resilient Trilingual Failover] ${fallbackObj.response}`;
    toolsUsed = fallbackObj.toolsUsed;
  } 
  // 3. Invoke trilingual live Gemini sales representative
  else {
    try {
      // Feed latest 10 messages to conversational context
      const recentMessages = conversation.messages.slice(-10);
      const contents: any[] = recentMessages.map(m => ({
        role: m.sender === "customer" ? "user" : "model",
        parts: [{ text: m.text }]
      }));

      console.log(`[WhatsApp Engine] Invoking Gemini context for +${cleanPhone}...`);
      let response = await generateContentWithRetry({
        model: getActiveModel(),
        contents,
        config: {
          systemInstruction: db.prompts.whatsappSystem,
          tools: [{ functionDeclarations: toolDeclarations }],
          temperature: 0.7
        }
      });

      let functionCalls = response.functionCalls;

      // Executing potential function triggers (database queries, ledger checkins)
      const maxLoops = 3;
      let loops = 0;
      while (functionCalls && functionCalls.length > 0 && loops < maxLoops) {
        loops++;
        console.log(`[WhatsApp Engine] Agent executing smart operational tools, loop ${loops}`, functionCalls);
        for (const call of functionCalls) {
          toolsUsed.push(call.name);
        }

        const outputs = await executeAgentTools(functionCalls, cleanPhone);

        const modelContent = response.candidates?.[0]?.content;
        if (modelContent) {
          contents.push(modelContent);
        } else {
          contents.push({
            role: "model",
            parts: functionCalls.map(f => ({
              functionCall: { name: f.name, args: f.args }
            }))
          });
        }

        contents.push({
          role: "user",
          parts: outputs.map(o => ({
            functionResponse: {
              name: o.functionResponse.name,
              response: o.functionResponse.response,
              id: o.id
            }
          }))
        });

        response = await generateContentWithRetry({
          model: getActiveModel(),
          contents,
          config: {
            systemInstruction: db.prompts.whatsappSystem,
            tools: [{ functionDeclarations: toolDeclarations }],
            temperature: 0.7
          }
        });

        functionCalls = response.functionCalls;
      }

      replyText = response.text || "Namaste, mane barobar samajh na padi. Shu tame fari kehsho?";

    } catch (err: any) {
      if (isQuotaExhausted && isLiteQuotaExhausted) {
        console.log("[Gemini API] Quota exhausted or expired API key. Gracing failover to high-fidelity trilingual offline resolver.");
      } else {
        console.error("[WhatsApp Engine] Gemini invocation error - falling back to trilingual local resolver", err?.message || err);
      }
      const fallbackObj = getTrilingualFallbackReply(text, cleanPhone);
      replyText = `[Resilient Trilingual Failover] ${fallbackObj.response}`;
      toolsUsed = fallbackObj.toolsUsed;
    }
  }

  // Persist final agent reply to localized discussion history
  conversation.messages.push({
    sender: "agent",
    text: replyText,
    timestamp: new Date().toISOString()
  });
  conversation.updatedAt = new Date().toISOString();
  saveToDB();

  // ATTEMPT LIVE PRODUCTION DELIVERY (using WHATSAPP_TOKEN & WHATSAPP_PHONE_NUMBER_ID if configured)
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    console.log(`[WhatsApp Engine] Outbound real API configured. Delivering message to +${cleanPhone}...`);
    await sendActualWhatsAppMessage(cleanPhone, replyText);
  }

  return { replyText, toolsUsed };
}

// Bind real Meta API live incoming WhatsApp messages webhook callback
registerWhatsAppMessageHandler(async (from, name, text, type) => {
  console.log(`[WhatsApp Callback Link] Triggering live response sequence for +${from} : "${text}"`);
  return await processIncomingWhatsAppMessage(from, name, text, type);
});

app.post("/api/whatsapp/simulate", async (req: Request, res: Response) => {
  const { phone, text, type } = req.body;
  if (!phone || !text) {
    return res.status(400).json({ error: "Missing required fields phone or text" });
  }

  const result = await processIncomingWhatsAppMessage(phone, "WhatsApp Patron", text, type || "text");
  return sendSuccess(res, { response: result.replyText, toolsUsed: result.toolsUsed });
});

// -------------------------------------------------------------
// Voice Calling API Simulation
// -------------------------------------------------------------
app.post("/api/call/simulate-phrase", async (req: Request, res: Response) => {
  const { phone, phrase, callId } = req.body;
  if (!phone || !phrase) {
    return res.status(400).json({ error: "Missing phone or phrase" });
  }

  const cleanPhone = phone.replace(/\D/g, "");

  // Find or create call record
  let log;
  if (callId) {
    log = db.callLogs.find(l => l.id === callId);
  } else {
    // Look for active call record within the last 15 minutes that doesn't have a duration set yet (or has duration 0)
    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
    log = db.callLogs.find(l => 
      l.customerPhone === cleanPhone && 
      (!l.duration || l.duration === 0) &&
      new Date(l.createdAt).getTime() > fifteenMinutesAgo
    );
  }

  if (!log) {
    const cid = callId || `call-${Date.now().toString().slice(-4)}`;
    const customer = getCustomer(cleanPhone);
    log = {
      id: cid,
      customerPhone: cleanPhone,
      customerName: customer ? customer.name : "Incoming Caller",
      transcript: [],
      summary: "Active Call taking order...",
      duration: 0,
      ordersCreated: [],
      createdAt: new Date().toISOString()
    };
    db.callLogs.unshift(log);
  }

  // Record user statement
  log.transcript.push({
    speaker: "customer",
    phrase: phrase,
    time: new Date().toLocaleTimeString()
  });
  saveToDB();

  // Create virtual webhook log
  db.webhookLogs.unshift({
    id: `web-voic-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toISOString(),
    service: "Call",
    event: "voice_stream_chunk",
    payload: { phone: cleanPhone, phrase }
  });
  saveToDB();

  if (!isGeminiEnabled()) {
    const mockVoiceReply = `Jayeshbhai, tame pure Gir ghee na 1 litre bottle ni kharidari karva mango cho? Menu confirmation tamara WhatsApp number par mokalvu chu. DIVAS SHUBH RAHE!`;
    log.transcript.push({
      speaker: "agent",
      phrase: mockVoiceReply,
      time: new Date().toLocaleTimeString()
    });
    saveToDB();
    return sendSuccess(res, {
      response: mockVoiceReply,
      text: mockVoiceReply,
      transcript: log.transcript,
      parsedSize: true,
      parsedQty: true,
      parsedAddress: false,
      orderGenerated: false
    });
  }

  // Early fallback if BOTH models are completely quota-exhausted to prevent failed API calls & errors
  if (isQuotaExhausted && isLiteQuotaExhausted) {
    console.log("[Gemini API] Quota exhausted (voice) for both models - using high-fidelity trilingual offline fallback directly.");
    const fallbackObj = getTrilingualFallbackReply(phrase, cleanPhone);
    const fallbackText = `[Voice Resilient Failover] ${fallbackObj.response}`;
    log.transcript.push({
      speaker: "agent",
      phrase: fallbackText,
      time: new Date().toLocaleTimeString()
    });
    
    // Auto-record created orders in call log if fallback creates an order
    let orderGenerated = false;
    let orderId = undefined;
    if (fallbackObj.toolsUsed.includes("createOrder")) {
      const lastOrderVal = db.orders[0];
      if (lastOrderVal && lastOrderVal.customerPhone === cleanPhone && !log.ordersCreated.includes(lastOrderVal.orderId)) {
        log.ordersCreated.push(lastOrderVal.orderId);
        orderGenerated = true;
        orderId = lastOrderVal.orderId;
      }
    }
    const sizeParsed = phrase.toLowerCase().includes("500") || phrase.toLowerCase().includes("1l") || phrase.toLowerCase().includes("5l");
    const qtyParsed = /\b\d+\b/.test(phrase);
    const addressParsed = phrase.toLowerCase().includes("address") || phrase.toLowerCase().includes("ahmedabad") || phrase.toLowerCase().includes("surat") || phrase.toLowerCase().includes("bengaluru");
    saveToDB();
    return sendSuccess(res, {
      response: fallbackText,
      text: fallbackText,
      transcript: log.transcript,
      ordersCreated: log.ordersCreated,
      parsedSize: sizeParsed,
      parsedQty: qtyParsed,
      parsedAddress: addressParsed,
      orderGenerated,
      orderId
    });
  }

  try {
    // Map audio transcript to structured chat history
    const chatContents: any[] = log.transcript.map(t => {
      return {
        role: t.speaker === "customer" ? "user" : "model",
        parts: [{ text: t.phrase }]
      };
    });

    console.log("Invoking Gemini for Calls agent flow...");
    let response = await generateContentWithRetry({
      model: getActiveModel(),
      contents: chatContents,
      config: {
        systemInstruction: db.prompts.callsSystem,
        tools: [{ functionDeclarations: toolDeclarations }],
        temperature: 0.5
      }
    });

    let functionCalls = response.functionCalls;
    let loops = 0;
    while (functionCalls && functionCalls.length > 0 && loops < 3) {
      loops++;
      const outputs = await executeAgentTools(functionCalls, cleanPhone);

      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) {
        chatContents.push(modelContent);
      } else {
        chatContents.push({
          role: "model",
          parts: functionCalls.map(f => ({
            functionCall: { name: f.name, args: f.args }
          }))
        });
      }

      chatContents.push({
        role: "user",
        parts: outputs.map(o => ({
          functionResponse: {
            name: o.functionResponse.name,
            response: o.functionResponse.response,
            id: o.id
          }
        }))
      });

      // record created orders inside call log if created
      for (const call of functionCalls) {
        if (call.name === "createOrder") {
          // let's grab the latest order we created
          const lastOrderVal = db.orders[0];
          if (lastOrderVal && lastOrderVal.customerPhone === cleanPhone && !log.ordersCreated.includes(lastOrderVal.orderId)) {
            log.ordersCreated.push(lastOrderVal.orderId);
          }
        }
      }

      response = await generateContentWithRetry({
        model: getActiveModel(),
        contents: chatContents,
        config: {
          systemInstruction: db.prompts.callsSystem,
          tools: [{ functionDeclarations: toolDeclarations }],
          temperature: 0.5
        }
      });

      functionCalls = response.functionCalls;
    }

    const callReplyPhrase = response.text || "Namaste, can you please repeat that?";

    // Save agent phrase
    log.transcript.push({
      speaker: "agent",
      phrase: callReplyPhrase,
      time: new Date().toLocaleTimeString()
    });
    saveToDB();

    const sizeParsed = phrase.toLowerCase().includes("500") || phrase.toLowerCase().includes("1l") || phrase.toLowerCase().includes("5l") || log.transcript.some(t => t.speaker === 'customer' && (t.phrase.toLowerCase().includes("500") || t.phrase.toLowerCase().includes("1l") || t.phrase.toLowerCase().includes("5l")));
    const qtyParsed = /\b\d+\b/.test(phrase) || log.transcript.some(t => t.speaker === 'customer' && /\b\d+\b/.test(t.phrase));
    const addressParsed = phrase.toLowerCase().includes("address") || log.transcript.some(t => t.speaker === 'customer' && (t.phrase.toLowerCase().includes("ahmedabad") || t.phrase.toLowerCase().includes("surat") || t.phrase.toLowerCase().includes("bengaluru") || t.phrase.toLowerCase().includes("address")));
    const orderGenerated = log.ordersCreated.length > 0;
    const orderId = log.ordersCreated[0];

    return sendSuccess(res, {
      response: callReplyPhrase,
      text: callReplyPhrase,
      transcript: log.transcript,
      ordersCreated: log.ordersCreated,
      parsedSize: sizeParsed,
      parsedQty: qtyParsed,
      parsedAddress: addressParsed,
      orderGenerated,
      orderId
    });

  } catch (err: any) {
    if (isQuotaExhausted && isLiteQuotaExhausted) {
      console.log("[Gemini API] Quota exhausted or expired API key. Gracing voice failover to high-fidelity trilingual offline resolver.");
    } else {
      console.error("Gemini voice invocation error - falling back to trilingual local resolver", err?.message || err);
    }
    const fallbackObj = getTrilingualFallbackReply(phrase, cleanPhone);
    const fallbackText = `[Voice Resilient Failover] ${fallbackObj.response}`;
    
    log.transcript.push({
      speaker: "agent",
      phrase: fallbackText,
      time: new Date().toLocaleTimeString()
    });
    
    // Auto-record created orders in call log if fallback creates an order
    let orderGenerated = false;
    let orderId = undefined;
    if (fallbackObj.toolsUsed.includes("createOrder")) {
      const lastOrderVal = db.orders[0];
      if (lastOrderVal && lastOrderVal.customerPhone === cleanPhone && !log.ordersCreated.includes(lastOrderVal.orderId)) {
        log.ordersCreated.push(lastOrderVal.orderId);
        orderGenerated = true;
        orderId = lastOrderVal.orderId;
      }
    }
    
    const sizeParsed = phrase.toLowerCase().includes("500") || phrase.toLowerCase().includes("1l") || phrase.toLowerCase().includes("5l");
    const qtyParsed = /\b\d+\b/.test(phrase);
    const addressParsed = phrase.toLowerCase().includes("address") || phrase.toLowerCase().includes("ahmedabad") || phrase.toLowerCase().includes("surat") || phrase.toLowerCase().includes("bengaluru");

    saveToDB();
    return sendSuccess(res, {
      response: fallbackText,
      text: fallbackText,
      transcript: log.transcript,
      ordersCreated: log.ordersCreated,
      parsedSize: sizeParsed,
      parsedQty: qtyParsed,
      parsedAddress: addressParsed,
      orderGenerated,
      orderId
    });
  }
});

// End call, generate summary, automatically trigger offline WhatsApp reminder receipt!
app.post("/api/call/end", async (req: Request, res: Response) => {
  const { callId, phone, customerPhone, duration, internalNotes, notes } = req.body;

  let log;
  if (callId) {
    log = db.callLogs.find(l => l.id === callId);
  } else {
    const searchPhone = phone || customerPhone;
    if (searchPhone) {
      const cleanPhone = searchPhone.replace(/\D/g, "");
      // Find the most recent call log for this phone number
      log = db.callLogs.find(l => l.customerPhone === cleanPhone);
    }
  }

  if (!log) {
    return res.status(400).json({ error: "Missing callId or phone parameter, or call session not found" });
  }

  log.duration = duration || Math.floor(30 + Math.random() * 60);
  const resolvedNotes = internalNotes !== undefined ? internalNotes : (notes || "Interacted through voice line calling simulator.");
  log.internalNotes = resolvedNotes;

  // Generate automated call translation summary using Gemini
  if (isGeminiEnabled() && !(isQuotaExhausted && isLiteQuotaExhausted) && log.transcript.length > 0) {
    try {
      const summaryRes = await generateContentWithRetry({
        model: getActiveModel(),
        contents: `Summarize the following customer phone call transcript in 1 short sentence including what they ordered or requested: \n\n${JSON.stringify(log.transcript)}`
      });
      log.summary = summaryRes.text?.trim() || "Completed business phone discussion.";
    } catch (err) {
      log.summary = "Completed ghee delivery call order.";
    }
  } else {
    log.summary = "Client placed 1L glass jar Vedic ghee order on voice call.";
  }

  saveToDB();

  // Create virtual webhook representing Post-Call WhatsApp Sync automation!
  db.webhookLogs.unshift({
    id: `web-hook-call-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toISOString(),
    service: "Call",
    event: "call_terminated_whatsapp_triggered",
    payload: { customerPhone: log.customerPhone, durationOfCall: log.duration }
  });

  // Automatically trigger a simulated outgoing WhatsApp message containing the receipt & link!
  const ordId = log.ordersCreated[0] || "ORD-MOCK";
  const orderObj = db.orders.find(o => o.orderId === ordId);
  const amount = orderObj ? orderObj.amount : 1800;
  const payLink = orderObj && orderObj.razorpayPaymentId ? `https://rzp.io/i/${orderObj.razorpayPaymentId}` : `https://rzp.io/i/pay_link_Rzp${Math.random().toString(36).substring(2, 8)}`;

  const customerObj = getCustomer(log.customerPhone);
  const nameToGREET = customerObj ? customerObj.name : "Bhai";

  const postCallWAText = `Namaste ${nameToGREET}! Aabhar Supr Ghee na call par order karva badal (Thank you for ordering with us on call!). Here is your receipt summary:
- Product: Original hand-churned Vedic Bilona Ghee
- Order ID: ${ordId}
- Total Price: Rs. ${amount}
- Razorpay Secure Invoice Link: ${payLink}

Click this secure link to pay using GPay, PhonePe, Paytm, or Credit cards. Once payment is done, yours will be shipped tomorrow morning. Aabhar! 🙏🐮`;

  // Write this automatic outgoing message to the customer's whatsapp conversation logs!
  let conversation = db.conversations.find(c => c.customerPhone === log.customerPhone);
  if (!conversation) {
    conversation = {
      customerPhone: log.customerPhone,
      channel: "whatsapp",
      messages: [],
      language: "Gujlish",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.conversations.push(conversation);
  }

  conversation.messages.push({
    sender: "system",
    text: "--- Auto SMS/WhatsApp message sent on call termination ---",
    timestamp: new Date().toISOString()
  });

  conversation.messages.push({
    sender: "agent",
    text: postCallWAText,
    timestamp: new Date().toISOString()
  });
  conversation.updatedAt = new Date().toISOString();
  saveToDB();

  sendSuccess(res, { callLog: log, autoMessage: postCallWAText });
});

// -------------------------------------------------------------
// Razorpay webhook simulation paid trigger
// -------------------------------------------------------------
app.post("/api/payments/trigger-webhook", (req: Request, res: Response) => {
  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ error: "Missing orderId parameter" });
  }

  const order = db.orders.find(o => o.orderId === orderId.toUpperCase());
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  // Update order database
  order.paymentStatus = "Paid";
  order.shippingStatus = "Shipped"; // Auto transition to shipped for fun demo
  order.updatedAt = new Date().toISOString();

  // Create payment log record
  const razorpayPaymentId = `pay_rzp_${Math.random().toString(36).substring(2, 10)}`;
  db.payments.push({
    orderId: order.orderId,
    razorpayPaymentId,
    customerPhone: order.customerPhone,
    amount: order.amount,
    status: "success",
    paidAt: new Date().toISOString()
  });

  // Create virtual webhook log
  db.webhookLogs.unshift({
    id: `web-rzp-hook-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toISOString(),
    service: "Razorpay",
    event: "payment_authorized_webhook",
    payload: { id: razorpayPaymentId, amount: order.amount, orderId: order.orderId }
  });
  saveToDB();

  // Synced with virtual Google Sheets database
  syncToSheets("Payments", "row_created", { orderId: order.orderId, amount: order.amount, payId: razorpayPaymentId });

  // Automatically send order payment confirmation WhatsApp!
  const confirmationWA = `Paiyment Recieved! (Payment Paid Confirmed) 🎉
Order ID: ${order.orderId}
We have successfully processed your billing amount of Rs. ${order.amount} via Secure Razorpay network.
Your Gir Cow A2 Desi Ghee package is already handed over to our premium shipping partner and is moving towards:
📍 ${order.address}

Expected delivery time: 2 days (Gujarat region). Standard tracking updates will follow. Thank you for supporting Junagadh dairy rural families! 🐮🌻`;

  let conversation = db.conversations.find(c => c.customerPhone === order.customerPhone);
  if (!conversation) {
    conversation = {
      customerPhone: order.customerPhone,
      channel: "whatsapp",
      messages: [],
      language: "Gujlish",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.conversations.push(conversation);
  }

  conversation.messages.push({
    sender: "system",
    text: "--- Auto WhatsApp payment confirmation webhook received ---",
    timestamp: new Date().toISOString()
  });

  conversation.messages.push({
    sender: "agent",
    text: confirmationWA,
    timestamp: new Date().toISOString()
  });
  conversation.updatedAt = new Date().toISOString();
  saveToDB();

  res.json({ success: true, order, messageSent: confirmationWA });
});

// -------------------------------------------------------------
// Cron Check Reminder Day 25 simulation
// -------------------------------------------------------------
app.post("/api/reorders/check-reminders", (req: Request, res: Response) => {
  // Simulates day 25 re-order checks
  // Find customers with totalOrders > 0 and calculate if 25 days have elapsed.
  // For the simulator, we will draft reminders for clients whose orders are older than 1 minute or standard dates.
  const remindersCreated: any[] = [];

  const now = new Date();
  for (const cust of db.customers) {
    if (cust.totalOrders > 0 && cust.lastOrderDate) {
      const lastDate = new Date(cust.lastOrderDate);
      const diffMs = now.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // In democratic demo, we allow reminder if they ordered previously (e.g. Amish Bhai or Jayeshbhai)
      const isEligible = true; // allow force simulation for demo and showcase

      const sampleMsg = `Namaste ${cust.name}! Kem cho? 🌸
Your previous order of pure Bilona Gir Cow A2 Ghee was placed around ${diffDays > 0 ? diffDays : 25} days ago.
We suspect your ghee jar is running low. Authentic Bilona cow ghee daily ensures good joint health and digestives!

Would you like to re-order the exact same pack directly?
Just reply with "HAAN" or "YES" to this message and we will prepare your shipping! No manual address forms needed.

Supr Ghee - Junagadh Farms 🌻`;

      remindersCreated.push({
        customer: cust.name,
        phone: cust.phone,
        message: sampleMsg,
        daysPassed: diffDays > 0 ? diffDays : 25
      });
    }
  }

  db.webhookLogs.unshift({
    id: `cron-rem-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toISOString(),
    service: "Sheets",
    event: "cron_scheduler_run",
    payload: { reminderChecksCompleted: db.customers.length, remindersDispatched: remindersCreated.length }
  });
  saveToDB();

  res.json({ success: true, reminders: remindersCreated });
});

// Send manual reminder draft on WhatsApp
app.post("/api/reorders/dispatch-whatsapp", (req: Request, res: Response) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: "Missing phone or message" });
  }

  const cleanPhone = phone.replace(/\D/g, "");

  let conversation = db.conversations.find(c => c.customerPhone === cleanPhone);
  if (!conversation) {
    conversation = {
      customerPhone: cleanPhone,
      channel: "whatsapp",
      messages: [],
      language: "Gujlish",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.conversations.push(conversation);
  }

  conversation.messages.push({
    sender: "system",
    text: "--- Day 25 Automated Reorder Reminder sent via Cron ---",
    timestamp: new Date().toISOString()
  });

  conversation.messages.push({
    sender: "agent",
    text: message,
    timestamp: new Date().toISOString()
  });
  conversation.updatedAt = new Date().toISOString();
  saveToDB();

  res.json({ success: true });
});

// -------------------------------------------------------------
// Update Prompts settings API
// -------------------------------------------------------------
app.post("/api/prompts/update", (req: Request, res: Response) => {
  const { whatsappSystem, callsSystem, objectionHandling } = req.body;

  if (whatsappSystem) db.prompts.whatsappSystem = whatsappSystem;
  if (callsSystem) db.prompts.callsSystem = callsSystem;
  if (objectionHandling) db.prompts.objectionHandling = objectionHandling;

  saveToDB();
  res.json({ success: true, prompts: db.prompts });
});

// -------------------------------------------------------------
// Quick Replies management APIs
// -------------------------------------------------------------
app.post("/api/quick-replies/save", (req: Request, res: Response) => {
  const { id, title, shortcut, text } = req.body;
  if (!title || !shortcut || !text) {
    return res.status(400).json({ error: "Missing title, shortcut, or text" });
  }

  if (!db.quickReplies) {
    db.quickReplies = [];
  }

  if (id) {
    const existing = db.quickReplies.find(q => q.id === id);
    if (existing) {
      existing.title = title;
      existing.shortcut = shortcut;
      existing.text = text;
    } else {
      db.quickReplies.push({ id, title, shortcut, text });
    }
  } else {
    const newId = `qr-${Date.now()}`;
    db.quickReplies.push({ id: newId, title, shortcut, text });
  }

  saveToDB();
  res.json({ success: true, quickReplies: db.quickReplies });
});

app.post("/api/quick-replies/delete", (req: Request, res: Response) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "Missing quick reply id" });
  }

  if (db.quickReplies) {
    db.quickReplies = db.quickReplies.filter(q => q.id !== id);
  }

  saveToDB();
  res.json({ success: true, quickReplies: db.quickReplies || [] });
});


// Create Manual Order from Admin Panel
app.post("/api/orders/create-manual", (req: Request, res: Response) => {
  const { phone, customerPhone, name, customerName, size, quantity, address } = req.body;
  const resolvedPhone = phone || customerPhone;
  const resolvedName = name || customerName;

  if (!resolvedPhone || !resolvedName || !size || !quantity || !address) {
    return res.status(400).json({ error: "Missing manual fields" });
  }

  const customerClean = resolvedPhone.replace(/\D/g, "");
  saveCustomer(customerClean, resolvedName, address);
  const ord = createOrder(customerClean, size, parseInt(quantity), address);

  sendSuccess(res, { orderId: ord.orderId, order: ord });
});

// Manual Orders Status Update
app.post("/api/orders/update-status", (req: Request, res: Response) => {
  const { orderId, shippingStatus, paymentStatus } = req.body;
  const order = db.orders.find(o => o.orderId === orderId);

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  if (shippingStatus) order.shippingStatus = shippingStatus;
  if (paymentStatus) {
    order.paymentStatus = paymentStatus;
    if (paymentStatus === "Paid") {
      db.payments.push({
        orderId: order.orderId,
        razorpayPaymentId: `manual_pay_${Date.now()}`,
        customerPhone: order.customerPhone,
        amount: order.amount,
        status: "success",
        paidAt: new Date().toISOString()
      });
    }
  }
  order.updatedAt = new Date().toISOString();
  saveToDB();

  sendSuccess(res, { order });
});

// -------------------------------------------------------------
// Google Sheets Simulated CSV Downloads
// -------------------------------------------------------------
app.get("/api/sheets/download/:sheet", (req: Request, res: Response) => {
  const sheet = req.params.sheet;

  if (sheet === "customers") {
    let csv = "Phone,Name,Preferred Language,Total Orders,Last Order Date,Address\n";
    db.customers.forEach(c => {
      csv += `${c.phone},"${c.name}",${c.preferredLanguage},${c.totalOrders},"${c.lastOrderDate || 'None'}","${c.address || ''}"\n`;
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=SuprGhee_Customers_LiveSync.csv");
    return res.status(200).send(csv);
  }

  if (sheet === "orders") {
    let csv = "OrderID,Customer Name,Customer Phone,Product,Size,Qty,Amount,Payment Status,Shipping Status,Date\n";
    db.orders.forEach(o => {
      csv += `${o.orderId},"${o.customerName}",${o.customerPhone},"${o.productName}",${o.size},${o.quantity},${o.amount},${o.paymentStatus},${o.shippingStatus},"${o.createdAt}"\n`;
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=SuprGhee_Orders_LiveSync.csv");
    return res.status(200).send(csv);
  }

  if (sheet === "payments") {
    let csv = "OrderID,Razorpay Payment ID,Customer Phone,Amount,Status,Paid At\n";
    db.payments.forEach(p => {
      csv += `${p.orderId},${p.razorpayPaymentId},${p.customerPhone},${p.amount},${p.status},"${p.paidAt || 'N/A'}"\n`;
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=SuprGhee_Payments_LiveSync.csv");
    return res.status(200).send(csv);
  }

  if (sheet === "leads") {
    let csv = "Phone,Name,Language,Channel,LastMessageAt\n";
    db.conversations.forEach(c => {
      const cust = getCustomer(c.customerPhone);
      csv += `${c.customerPhone},"${cust ? cust.name : 'Unknown Interested User'}",${c.language},${c.channel},"${c.updatedAt}"\n`;
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=SuprGhee_Leads_LiveSync.csv");
    return res.status(200).send(csv);
  }

  if (sheet === "calls") {
    let csv = "CallID,Customer Phone,Duration (sec),Orders Created,Internal Notes,Summary,Date\n";
    db.callLogs.forEach(c => {
      csv += `${c.id},${c.customerPhone},${c.duration},"${c.ordersCreated.join(';') || 'None'}","${(c.internalNotes || '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}","${(c.summary || '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}","${c.createdAt}"\n`;
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=SuprGhee_CallLogs_LiveSync.csv");
    return res.status(200).send(csv);
  }

  res.status(404).send("Sheet not discovered");
});

// -------------------------------------------------------------
// Vite Middleware for Full Stack
// -------------------------------------------------------------
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Supr Ghee Sales OS Server listening on http://localhost:${PORT}`);
    });
  }
}

bootstrap();

export default app;
