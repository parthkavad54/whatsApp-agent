import { jsPDF } from "jspdf";
import React, { useState, useEffect, useRef } from "react";
import {
  Phone,
  MessageSquare,
  Plus,
  RotateCcw,
  TrendingUp,
  Coins,
  Users,
  ShoppingBag,
  Database,
  Settings,
  Download,
  CheckCircle,
  Clock,
  Send,
  Mic,
  MicOff,
  Wifi,
  AlertCircle,
  Calendar,
  Play,
  Volume2,
  Briefcase,
  Tag,
  ShieldAlert,
  Sliders,
  FileSpreadsheet,
  Search,
  Trash2,
  Edit,
  Truck,
  MapPin,
  Box,
  Package,
  X,
  ChevronRight
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Product, Customer, Order, Conversation, CallLog, WebhookLog, SpeechPhrase, QuickReply } from "./types";

export default function App() {
  // DB States Hydrated from server
  const [data, setData] = useState<{
    db: {
      products: Product[];
      customers: Customer[];
      orders: Order[];
      conversations: Conversation[];
      callLogs: CallLog[];
      webhookLogs: WebhookLog[];
      prompts: {
        whatsappSystem: string;
        callsSystem: string;
        languageDetection: string;
        objectionHandling: string;
        selectedModel?: string;
      };
      quickReplies?: QuickReply[];
    };
    isGeminiConfigured: boolean;
    isQuotaExhausted?: boolean;
    isLiteQuotaExhausted?: boolean;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isResettingQuota, setIsResettingQuota] = useState(false);

  // App Layout Preferences
  const [activeTab, setActiveTab] = useState<"analytics" | "orders" | "customers" | "sheets" | "prompts">("analytics");
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>("");
  const [orderDateRange, setOrderDateRange] = useState<"all" | "3days" | "7days" | "30days" | "custom">("all");
  const [orderStartDate, setOrderStartDate] = useState<string>("");
  const [orderEndDate, setOrderEndDate] = useState<string>("");
  const [orderPaymentStatusFilter, setOrderPaymentStatusFilter] = useState<"all" | "Paid" | "Pending">("all");
  
  // Simulator Contexts
  const [selectedSimPhone, setSelectedSimPhone] = useState<string>("919876543210");
  const [customPhone, setCustomPhone] = useState<string>("");
  const [whatsappInputValue, setWhatsappInputValue] = useState<string>("");
  const [isSendingWA, setIsSendingWA] = useState<boolean>(false);
  const [waVoiceMode, setWaVoiceMode] = useState<boolean>(false);

  // Live Call Simulator States
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [callSessionId, setCallSessionId] = useState<string>("");
  const [callDuration, setCallDuration] = useState<number>(0);
  const [callTranscript, setCallTranscript] = useState<SpeechPhrase[]>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [speakValue, setSpeakValue] = useState<string>("");
  const [isSpeakingAI, setIsSpeakingAI] = useState<boolean>(false);
  const [aiSpeechOutput, setAiSpeechOutput] = useState<string>("");
  const [speechError, setSpeechError] = useState<string>("");
  const [activeCallNotes, setActiveCallNotes] = useState<string>("");
  const [waveHeights, setWaveHeights] = useState<number[]>(new Array(24).fill(6));

  // Automated Reorder Cron simulator state
  const [reminderDrafts, setReminderDrafts] = useState<any[]>([]);
  const [showReminderModal, setShowReminderModal] = useState<boolean>(false);

  // Manual Order Creation Fields
  const [showManualOrderForm, setShowManualOrderForm] = useState<boolean>(false);
  const [manualPhone, setManualPhone] = useState<string>("");
  const [manualName, setManualName] = useState<string>("");
  const [manualSize, setManualSize] = useState<string>("1L");
  const [manualQty, setManualQty] = useState<number>(1);
  const [manualAddress, setManualAddress] = useState<string>("");
  const [selectedTrackingOrder, setSelectedTrackingOrder] = useState<Order | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Prompts Editing state
  const [editedWhatsappPrompt, setEditedWhatsappPrompt] = useState<string>("");
  const [editedCallPrompt, setEditedCallPrompt] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isSavingPrompts, setIsSavingPrompts] = useState<boolean>(false);

  // Quick Replies list/editor state
  const [qrId, setQrId] = useState<string>("");
  const [qrTitle, setQrTitle] = useState<string>("");
  const [qrShortcut, setQrShortcut] = useState<string>("");
  const [qrText, setQrText] = useState<string>("");
  const [qrIsSaving, setQrIsSaving] = useState<boolean>(false);
  const [qrSearchQuery, setQrSearchQuery] = useState<string>("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Standard Hydration Protocol
  const loadDatabaseState = async () => {
    try {
      const res = await fetch("/api/data");
      if (!res.ok) throw new Error("Server not responding to request");
      const result = await res.json();
      setData(result);
      
      // Auto populate prompt editors once initialized
      if (result.db?.prompts) {
        if (!editedWhatsappPrompt) setEditedWhatsappPrompt(result.db.prompts.whatsappSystem);
        if (!editedCallPrompt) setEditedCallPrompt(result.db.prompts.callsSystem);
        setSelectedModel(prev => prev || result.db.prompts.selectedModel || "gemini-3.5-flash");
      }
      
      setErrorMsg(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to interface with backend API");
    } finally {
      setIsLoading(false);
    }
  };

  // Poll server state every 4.5 seconds to sync webhooks and logs gracefully
  useEffect(() => {
    loadDatabaseState();
    const interval = setInterval(loadDatabaseState, 4500);
    return () => clearInterval(interval);
  }, []);

  // Scroll active chat stream bottom securely within the chat box container only
  const scrollToChatBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToChatBottom();
  }, [data?.db?.conversations, selectedSimPhone]);

  // Handle call duration tick counters
  useEffect(() => {
    if (isCallActive) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCallActive]);

  // Dynamic Real-time Audio Wave modulation loop for active calls
  useEffect(() => {
    if (!isCallActive) {
      setWaveHeights(new Array(24).fill(6));
      return;
    }

    let animationFrameId: number;
    let tick = 0;

    const updateWave = () => {
      tick += 1.2; // control speed of math wave fluctuations
      setWaveHeights(prev =>
        prev.map((_, idx) => {
          if (isSpeakingAI) {
            // High-energy conversational wave: combination of waves with peak overlays
            const wave1 = Math.sin(tick * 0.18 + idx * 0.38) * 16;
            const wave2 = Math.cos(tick * 0.28 - idx * 0.22) * 10;
            // Introduce a randomized volume accent to simulate actual speech pauses or plosive sounds
            const rawGleam = Math.sin(tick * 0.08) > 0.3 ? 1.2 : 0.4;
            const noise = Math.random() * 8 - 4;
            // Center weight factor so it organically tapers like a natural spectrum/meter
            const centerWeight = Math.sin((idx / 23) * Math.PI); // peaked in middle
            return Math.max(6, Math.min(52, 6 + (wave1 + wave2 + 20 + noise) * centerWeight * rawGleam * 1.1));
          } else {
            // Calm, elegant respiratory baseline wave showing live open connection
            const baseSin = Math.sin(tick * 0.06 + idx * 0.26) * 4 + 7;
            const baselinePulse = Math.cos(tick * 0.02) > 0 ? 1 : 0.6;
            const noise = Math.random() * 2 - 1;
            const centerWeight = Math.sin((idx / 23) * Math.PI);
            return Math.max(4, Math.min(18, 4 + (baseSin + noise) * centerWeight * baselinePulse * 1.1));
          }
        })
      );
      animationFrameId = requestAnimationFrame(updateWave);
    };

    animationFrameId = requestAnimationFrame(updateWave);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isCallActive, isSpeakingAI]);

  // Select Current Simulated Customer Profile or create dynamic input
  const getSimulatedPhone = () => {
    return customPhone.trim() ? customPhone.trim() : selectedSimPhone;
  };

  // Get current active WhatsApp session convo
  const getActiveWAConversation = (): Conversation | null => {
    if (!data?.db?.conversations) return null;
    const phone = getSimulatedPhone();
    return data.db.conversations.find(c => c.customerPhone === phone) || null;
  };

  // 1. Send Simulated WhatsApp message
  const handleSendWhatsApp = async (e?: React.FormEvent, isAudioSimulation: boolean = false, overrideText?: string) => {
    if (e) e.preventDefault();
    const msgText = overrideText || whatsappInputValue.trim();
    if (!msgText && !isAudioSimulation) return;

    const textToSubmit = isAudioSimulation
      ? (msgText || "Mane 2 litre ghee vechva mokalo bapu, Ahmedabad mate")
      : msgText;

    const phone = getSimulatedPhone();
    setIsSendingWA(true);
    setWhatsappInputValue("");

    try {
      const response = await fetch("/api/whatsapp/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          text: textToSubmit,
          type: isAudioSimulation ? "audio" : "text"
        })
      });
      await response.json();
      await loadDatabaseState();
    } catch (err) {
      console.error("WA Sim error", err);
    } finally {
      setIsSendingWA(false);
    }
  };

  // 2. Start Live Call Simulation
  const handleStartCall = () => {
    const phone = getSimulatedPhone();
    const sessionId = `call-sim-${Date.now().toString().slice(-4)}`;
    setCallSessionId(sessionId);
    setCallTranscript([]);
    setIsCallActive(true);
    setAiSpeechOutput("Initializing Call Stream...");
    setActiveCallNotes(""); // Reset active call notes on start!

    // Send initial greeting phrase to set context
    handleSimulateVoicePhrase("Namaste, Supr Ghee ma swagat che!", sessionId);
  };

  // Simulate Speak Phrase from caller on Active Call session
  const handleSimulateVoicePhrase = async (phraseInput?: string, specificCid?: string) => {
    const textPhrase = phraseInput || speakValue.trim();
    if (!textPhrase) return;

    setSpeakValue("");
    setIsSpeakingAI(true);
    const cid = specificCid || callSessionId;
    const phone = getSimulatedPhone();

    try {
      const res = await fetch("/api/call/simulate-phrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          phrase: textPhrase,
          callId: cid
        })
      });
      const resData = await res.json();
      setCallTranscript(resData.transcript);
      setAiSpeechOutput(resData.text);
      
      // Speak AI's voice verbally using Web Speech Synth if available
      if (window.speechSynthesis && resData.text) {
        const speech = new SpeechSynthesisUtterance(resData.text);
        // detect language to parse accents beautifully
        if (resData.text.includes("Namaste") || resData.text.includes("Kem") || resData.text.includes("bhai")) {
          speech.lang = "hi-IN"; // Hindi voice handles phonetic Gujlish accents excellently
        } else {
          speech.lang = "en-IN";
        }
        speech.rate = 1.0;
        window.speechSynthesis.speak(speech);
      }

      await loadDatabaseState();
    } catch (err) {
      console.error("Call simulation error", err);
    } finally {
      setIsSpeakingAI(false);
    }
  };

  // Convert Web Speech Recognition dynamically inside user frame
  const handleToggleVoiceRecognize = () => {
    const SpeechRecObj = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecObj) {
      setSpeechError("Speech recognition is not fully supported in this local sandbox browser. Please type to simulate speech!");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const recognizer = new SpeechRecObj();
    recognizer.lang = "gu-IN"; // prioritizes Gujarati spoken phrases
    recognizer.continuous = false;
    recognizer.interimResults = false;

    recognizer.onstart = () => {
      setIsRecording(true);
      setSpeechError("");
    };

    recognizer.onerror = (err: any) => {
      console.error(err);
      setSpeechError("Microphone permission or speech frame block. Please type instead.");
      setIsRecording(false);
    };

    recognizer.onend = () => {
      setIsRecording(false);
    };

    recognizer.onresult = (e: any) => {
      const phraseText = e.results[0][0].transcript;
      if (phraseText) {
        handleSimulateVoicePhrase(phraseText);
      }
    };

    recognizer.start();
  };

  // Terminates active voice call and sends automatic summary receipt on WhatsApp
  const handleTerminateCall = async () => {
    if (!isCallActive) return;
    setIsCallActive(false);

    try {
      const res = await fetch("/api/call/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: callSessionId,
          duration: callDuration,
          internalNotes: activeCallNotes.trim()
        })
      });
      await res.json();
      await loadDatabaseState();
    } catch (err) {
      console.error("End call error", err);
    }
  };

  // 3. Trigger Razorpay billing receipt webhook simulated authorization
  const handleTriggerRazorpayWebhook = async (orderId: string) => {
    try {
      const res = await fetch("/api/payments/trigger-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId })
      });
      await res.json();
      await loadDatabaseState();
    } catch (err) {
      console.error(err);
    }
  };

  // 3.5. Update order Shipping Status manually
  const handleUpdateShippingStatus = async (orderId: string, shippingStatus: string) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch("/api/orders/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, shippingStatus })
      });
      if (res.ok) {
        await loadDatabaseState();
      } else {
        alert("Could not update shipping status.");
      }
    } catch (err) {
      console.error("Error updating shipping status", err);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // 4. Trigger Day 25 automated re-order scheduler check
  const handleCheckReorderReminders = async () => {
    try {
      const res = await fetch("/api/reorders/check-reminders", {
        method: "POST"
      });
      const resData = await res.json();
      setReminderDrafts(resData.reminders || []);
      setShowReminderModal(true);
    } catch (err) {
      console.error("Cron trigger error", err);
    }
  };

  // Manual Reset for the Quota/Rate Limit Exhaustion status
  const handleResetQuota = async () => {
    setIsResettingQuota(true);
    try {
      const res = await fetch("/api/quota/reset", {
        method: "POST"
      });
      const resData = await res.json();
      if (resData.success) {
        await loadDatabaseState();
      }
    } catch (err) {
      console.error("Quota reset failure", err);
    } finally {
      setIsResettingQuota(false);
    }
  };

  // Send selected reminder draft to customer's WhatsApp conversation record
  const handleSendReminderToWa = async (phone: string, message: string) => {
    try {
      await fetch("/api/reorders/dispatch-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message })
      });
      // Filter out immediately
      setReminderDrafts(prev => prev.filter(p => p.phone !== phone));
      await loadDatabaseState();
    } catch (err) {
      console.error(err);
    }
  };

  // 5. Save System Prompts Updates globally
  const handleSavePrompts = async () => {
    setIsSavingPrompts(true);
    try {
      const res = await fetch("/api/prompts/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappSystem: editedWhatsappPrompt,
          callsSystem: editedCallPrompt,
          selectedModel: selectedModel
        })
      });
      if (res.ok) {
        alert("System Knowledge prompts saved successfully!");
      }
      await loadDatabaseState();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingPrompts(false);
    }
  };

  // Quick Replies Template CRUD managers
  const handleSaveQuickReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!qrTitle.trim() || !qrShortcut.trim() || !qrText.trim()) {
      alert("Please specify a Title, Shortcut (e.g. /welcome), and Template Content.");
      return;
    }
    setQrIsSaving(true);
    try {
      const res = await fetch("/api/quick-replies/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: qrId ? qrId : undefined,
          title: qrTitle.trim(),
          shortcut: qrShortcut.trim(),
          text: qrText.trim()
        })
      });
      if (res.ok) {
        // Clear editor fields
        setQrId("");
        setQrTitle("");
        setQrShortcut("");
        setQrText("");
        await loadDatabaseState();
      } else {
        alert("Could not persist quick reply template.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setQrIsSaving(false);
    }
  };

  const handleDeleteQuickReply = async (id: string) => {
    if (!confirm("Are you sure you want to delete this reusable quick reply template?")) {
      return;
    }
    try {
      const res = await fetch("/api/quick-replies/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        await loadDatabaseState();
        if (qrId === id) {
          setQrId("");
          setQrTitle("");
          setQrShortcut("");
          setQrText("");
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditQuickReply = (qr: QuickReply) => {
    setQrId(qr.id);
    setQrTitle(qr.title);
    setQrShortcut(qr.shortcut);
    setQrText(qr.text);
  };

  // 6. Manual Order Creation Dispatcher
  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone || !manualName || !manualAddress || !manualQty) {
      alert("Please fill all required billing variables");
      return;
    }

    try {
      const res = await fetch("/api/orders/create-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: manualPhone,
          name: manualName,
          size: manualSize,
          quantity: manualQty,
          address: manualAddress
        })
      });
      if (res.ok) {
        setShowManualOrderForm(false);
        // Reset
        setManualPhone("");
        setManualName("");
        setManualAddress("");
        setManualQty(1);
        await loadDatabaseState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Format datetimes comfortably
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return "N/A";
    const date = new Date(isoString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Daily revenue trends over the last 30 days
  const dailyTrendsData = React.useMemo(() => {
    const trends = [];
    const now = new Date();
    const anchor = now.getFullYear() >= 2026 ? now : new Date("2026-06-10T12:00:00Z");
    const successPayments = data?.db?.payments?.filter((p: any) => p.status === "success") || [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() - i);
      const ymd = d.toISOString().split("T")[0];

      const dayTotal = successPayments
        .filter((p: any) => p.paidAt && p.paidAt.split("T")[0] === ymd)
        .reduce((sum: number, p: any) => sum + p.amount, 0);

      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      trends.push({
        date: label,
        Revenue: dayTotal
      });
    }
    return trends;
  }, [data?.db?.payments]);


  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-stone-700 font-serif text-lg animate-pulse">
            Configuring Supr Ghee Operating System Environment...
          </p>
        </div>
      </div>
    );
  }

  // Calculate rich metrics for dashboard stats
  const totalRevenue = data?.db?.payments
    .filter(p => p.status === "success")
    .reduce((sum, current) => sum + current.amount, 0) || 0;

  const totalOrdersCount = data?.db?.orders.length || 0;
  const paidOrdersCount = data?.db?.orders.filter(o => o.paymentStatus === "Paid").length || 0;
  const pendingOrdersCount = data?.db?.orders.filter(o => o.paymentStatus === "Pending").length || 0;
  const customerBaseCount = data?.db?.customers.length || 0;

  // Pie chart stats calculation
  const languagesMap = data?.db?.customers.reduce((acc: any, cust) => {
    acc[cust.preferredLanguage] = (acc[cust.preferredLanguage] || 0) + 1;
    return acc;
  }, {}) || {};

  const languagePieData = Object.keys(languagesMap).map(lang => ({
    name: lang,
    value: languagesMap[lang]
  }));

  const COLORS = ["#d97706", "#059669", "#2563eb"];

  // Bar chart stats calculation (Order sizes popularity)
  const sizesMap = data?.db?.orders.reduce((acc: any, ord) => {
    acc[ord.size] = (acc[ord.size] || 0) + ord.quantity;
    return acc;
  }, {}) || {};

  const sizeBarData = Object.keys(sizesMap).map(size => ({
    name: size,
    QuantitySold: sizesMap[size]
  }));

  const paymentStatusPieData = [
    { name: "Paid", value: paidOrdersCount },
    { name: "Pending", value: pendingOrdersCount }
  ];

  const getFilteredOrders = () => {
    return (data?.db?.orders || []).filter((ord) => {
      // 1. Text Search Filter
      const query = orderSearchQuery.toLowerCase().trim();
      const matchesText = !query || (
        ord.orderId.toLowerCase().includes(query) ||
        ord.customerName.toLowerCase().includes(query)
      );

      if (!matchesText) return false;

      // 1b. Payment Status Filter
      if (orderPaymentStatusFilter !== "all" && ord.paymentStatus !== orderPaymentStatusFilter) {
        return false;
      }

      // 2. Date Range Filter
      if (orderDateRange === "all") return true;

      const ordTime = new Date(ord.createdAt).getTime();
      const nowTime = new Date().getTime();

      if (orderDateRange === "3days") {
        return (nowTime - ordTime) <= 3 * 24 * 60 * 60 * 1000;
      }
      if (orderDateRange === "7days") {
        return (nowTime - ordTime) <= 7 * 24 * 60 * 60 * 1000;
      }
      if (orderDateRange === "30days") {
        return (nowTime - ordTime) <= 30 * 24 * 60 * 60 * 1000;
      }
      if (orderDateRange === "custom") {
        if (orderStartDate) {
          const startStr = orderStartDate + "T00:00:00";
          if (ordTime < new Date(startStr).getTime()) return false;
        }
        if (orderEndDate) {
          const endStr = orderEndDate + "T23:59:59";
          if (ordTime > new Date(endStr).getTime()) return false;
        }
      }

      return true;
    });
  };

  const handleExportPDF = () => {
    const list = getFilteredOrders();
    if (list.length === 0) {
      alert("No filtered orders found to export.");
      return;
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    
    // Header function to draw decorative items
    const drawHeader = (pageNum: number) => {
      // Background Accent bar at top
      doc.setFillColor(245, 158, 11); // Amber
      doc.rect(0, 0, pageW, 4, "F");

      // Brand Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(31, 41, 55); // Slate 800
      doc.text("VEDIC GHEE CO.", margin, 18);

      // Subtitle
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text("A2 Gir Cow Desi Ghee - Billing Ledger & Invoices Summary", margin, 23);

      // Meta date
      const dateStr = new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
      doc.setFont("courier", "bold");
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(`DATE GENERATED: ${dateStr.toUpperCase()}`, pageW - margin, 18, { align: "right" });
      doc.text(`PAGE: ${pageNum}`, pageW - margin, 23, { align: "right" });

      // Solid dividing line
      doc.setDrawColor(229, 231, 235); // Cool Gray 200
      doc.setLineWidth(0.4);
      doc.line(margin, 26, pageW - margin, 26);
    };

    // Footer function
    const drawFooter = (pageNum: number, totalPages: number) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      
      const disclaimer = "* This is a live database ledger export report. Amounts are in Indian Rupees (INR).";
      doc.text(disclaimer, margin, pageH - 10);
      
      const pageInfo = `Page ${pageNum} of ${totalPages}`;
      doc.text(pageInfo, pageW - margin, pageH - 10, { align: "right" });
    };

    // Calculate sum statistics
    const totalCount = list.length;
    const totalAmount = list.reduce((sum, o) => sum + o.amount, 0);
    const paidCount = list.filter(o => o.paymentStatus === "Paid").length;
    const pendingCount = list.filter(o => o.paymentStatus === "Pending").length;
    const paidAmount = list.filter(o => o.paymentStatus === "Paid").reduce((sum, o) => sum + o.amount, 0);
    const pendingAmount = list.filter(o => o.paymentStatus === "Pending").reduce((sum, o) => sum + o.amount, 0);

    // Initial page header
    drawHeader(1);

    // 1. Metric Cards Header Widget Row (Starting at Y=32)
    let y = 32;

    // Draw card container panel
    doc.setFillColor(250, 248, 245); // Subtle warm off-white background
    doc.setDrawColor(241, 195, 122); // Fine gold-amber frame
    doc.setLineWidth(0.3);
    doc.rect(margin, y, pageW - margin*2, 20, "DF");

    // Stat Column dividers
    doc.setDrawColor(230, 224, 215);
    doc.line(75, y + 3, 75, y + 17);
    doc.line(135, y + 3, 135, y + 17);

    // Column 1: Filter Summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 110, 95); // Golden sage
    doc.text("LOCKED LEDGER TOTALS", margin + 5, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(`INR ${totalAmount.toLocaleString()}`, margin + 5, y + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`${totalCount} orders exported`, margin + 5, y + 17);

    // Column 2: Receivables Paid Analysis
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(16, 185, 129); // emerald 500
    doc.text("RECEIVABLES RESOLVED", 80, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(`INR ${paidAmount.toLocaleString()}`, 80, y + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`${paidCount} closed billing contracts`, 80, y + 17);

    // Column 3: Outstanding Receivables
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(245, 158, 11); // amber 500
    doc.text("PENDING ACCOUNTS", 140, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(`INR ${pendingAmount.toLocaleString()}`, 140, y + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`${pendingCount} unpaid invoice counts`, 140, y + 17);

    y = 58;

    // 2. Table Headers
    doc.setFillColor(241, 245, 249); // light blue gray
    doc.rect(margin, y, pageW - margin*2, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105); // slate-600

    doc.text("ORDER ID", margin + 3, y + 5.5);
    doc.text("PATRON DETAILS", margin + 28, y + 5.5);
    doc.text("DESI GHEE PRODUCT DETAILS", margin + 74, y + 5.5);
    doc.text("SETTLEMENT STATUS", margin + 128, y + 5.5);
    doc.text("NET AMOUNT", pageW - margin - 3, y + 5.5, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(margin, y + 8, pageW - margin, y + 8);

    y += 8;

    // Rows printing loop
    let currentPageIndex = 1;

    list.forEach((ord) => {
      const rowHeight = 13;
      // Check for page overflow
      if (y + rowHeight > pageH - 25) {
        // Draw footer of current page before adding a new one
        drawFooter(currentPageIndex, 999); // Will be replaced in the final pass or updated
        doc.addPage();
        currentPageIndex += 1;
        drawHeader(currentPageIndex);
        
        // Re-draw table headers on the new page
        y = 32;
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, y, pageW - margin*2, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text("ORDER ID", margin + 3, y + 5.5);
        doc.text("PATRON DETAILS", margin + 28, y + 5.5);
        doc.text("DESI GHEE PRODUCT DETAILS", margin + 74, y + 5.5);
        doc.text("SETTLEMENT STATUS", margin + 128, y + 5.5);
        doc.text("NET AMOUNT", pageW - margin - 3, y + 5.5, { align: "right" });
        y += 8;
      }

      // Draw standard separation line in background
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.15);
      doc.line(margin, y + rowHeight, pageW - margin, y + rowHeight);

      // Print Order ID
      doc.setFont("courier", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42); // slate 900
      doc.text(ord.orderId, margin + 3, y + 5);

      // Date of creation below ID
      const dateOnly = new Date(ord.createdAt).toLocaleDateString("en-GB");
      doc.setFont("courier", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(dateOnly, margin + 3, y + 9);

      // Print Customer info
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(ord.customerName, margin + 28, y + 5);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`+${ord.customerPhone}`, margin + 28, y + 9);

      // Print Product info
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(ord.productName, margin + 74, y + 5);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(180, 83, 9); // amber 700
      doc.text(`${ord.size} x ${ord.quantity}`, margin + 74, y + 9);

      // Print Payment & Shipping Status inline
      const statusText = ord.paymentStatus.toUpperCase();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      
      if (ord.paymentStatus === "Paid") {
        doc.setFillColor(209, 250, 229); // light green bg
        doc.setTextColor(6, 95, 70); // deep green text
        doc.rect(margin + 128, y + 2.5, 12, 4.5, "F");
        doc.text(statusText, margin + 129.5, y + 5.7);
      } else {
        doc.setFillColor(254, 243, 199); // light yellow bg
        doc.setTextColor(146, 64, 14); // deep orange text
        doc.rect(margin + 128, y + 2.5, 16, 4.5, "F");
        doc.text(statusText, margin + 129.5, y + 5.7);
      }

      // Shipping label text
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`(Ship: ${ord.shippingStatus})`, margin + 147, y + 6);

      // Print amount in INR (Bold right aligned)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`INR ${ord.amount.toLocaleString()}`, pageW - margin - 3, y + 7, { align: "right" });

      y += rowHeight;
    });

    // Finalize page count for footer variables
    const totalPagesCount = currentPageIndex;
    for (let p = 1; p <= totalPagesCount; p++) {
      doc.setPage(p);
      drawFooter(p, totalPagesCount);
    }

    // Download the PDF
    const safeTitle = `VedicGhee_Summary_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(safeTitle);
  };


  // Daily revenue trends over the last 30 days

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-950 flex flex-col font-sans">
      
      {/* Top Brand Hero Header */}
      <header className="bg-stone-900 text-stone-100 py-3 px-6 border-b border-amber-500/20 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-stone-950 p-2.5 rounded-full font-bold shadow-md animate-pulse">
              🐮
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight font-serif text-amber-100 flex items-center gap-2">
                Supr Ghee <span className="text-stone-400 font-sans text-xs uppercase px-2 py-0.5 bg-stone-800 rounded">GirSatva Live OS</span>
              </h1>
              <p className="text-xs text-stone-400">
                100% Pure Gir Cow A2 Vedic Bilona Ghee • Multi-Channel Sales AI Agent
              </p>
            </div>
          </div>

          {/* Gemini Verification Indicator */}
          <div className="flex items-center gap-4 text-xs">
            {data?.isGeminiConfigured ? (
              data?.isQuotaExhausted && data?.isLiteQuotaExhausted ? (
                <div className="bg-amber-950 text-amber-300 border border-amber-500/35 px-3 py-1.5 rounded-md flex items-center gap-2 animate-bounce" title="Both standard and free lite model keys are exhausted. Resilient offline trilingual backup is fully active.">
                  <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse"></span>
                  <span className="font-semibold">Quotas Full • Active Resilient Fallback</span>
                  <button
                    onClick={handleResetQuota}
                    disabled={isResettingQuota}
                    className="ml-1.5 px-1.5 py-0.5 bg-amber-800 hover:bg-amber-700 text-amber-100 rounded text-[10px] font-semibold tracking-wider uppercase transition cursor-pointer active:scale-95"
                  >
                    {isResettingQuota ? "Resetting" : "Reset"}
                  </button>
                </div>
              ) : data?.isQuotaExhausted ? (
                <div className="bg-amber-950/70 text-amber-200 border border-amber-500/25 px-3 py-1.5 rounded-md flex items-center gap-2" title="Standard Gemini-3.5 quota exhausted. Dynamic failover to free Gemini-3.1-flash-lite was triggered successfully.">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse"></span>
                  <span className="font-semibold">3.5 Quota Full • Using 3.1 Flash Lite (Free)</span>
                  <button
                    onClick={handleResetQuota}
                    disabled={isResettingQuota}
                    className="ml-1.5 px-1.5 py-0.5 bg-amber-800/80 hover:bg-amber-700 text-amber-200 rounded text-[10px] font-semibold tracking-wider uppercase transition cursor-pointer active:scale-95"
                  >
                    {isResettingQuota ? "Resetting" : "Reset"}
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-950 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-md flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
                  <span className="font-semibold">
                    AI Agent ({data?.db?.prompts?.selectedModel === "gemini-3.1-flash-lite" ? "Gemini-3.1-flash-lite Free" : "Gemini-3.5-flash"}) Active
                  </span>
                </div>
              )
            ) : (
              <div className="bg-red-950 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-md flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span className="font-semibold">Demo Mode (Set GEMINI_API_KEY in Secrets)</span>
              </div>
            )}

            <button
              onClick={handleCheckReorderReminders}
              className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold px-3 py-1.5 rounded-md flex items-center gap-2.5 transition active:scale-95 cursor-pointer shadow-sm"
              id="cron-btn"
            >
              <Clock className="w-4 h-4" />
              <span>Simulate Day 25 Cron</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: SIMULATORS SUITE (WhatsApp & Calling) - spans 5 cols */}
        <section className="lg:col-span-5 flex flex-col gap-6" id="simulators-container">
          
          {/* Customer Selection Card */}
          <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" />
              <span>Select Active Customer Simulator Context</span>
            </h2>
            
            <div className="grid grid-cols-3 gap-2">
              {data?.db?.customers.map(cust => (
                <button
                  key={cust.phone}
                  onClick={() => {
                    setSelectedSimPhone(cust.phone);
                    setCustomPhone("");
                  }}
                  className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition h-[68px] cursor-pointer ${
                    getSimulatedPhone() === cust.phone
                      ? "border-amber-500 bg-amber-50/40 shadow-sm"
                      : "border-stone-100 hover:bg-stone-50"
                  }`}
                  id={`cust-btn-${cust.phone}`}
                >
                  <span className="text-xs font-semibold block truncate text-stone-900">{cust.name}</span>
                  <span className="text-[10px] font-mono text-stone-500">+{cust.phone}</span>
                  <div className="flex gap-1 mt-1">
                    <span className="text-[9px] px-1 bg-stone-100 text-stone-600 rounded">
                      {cust.preferredLanguage}
                    </span>
                    {cust.totalOrders > 0 && (
                      <span className="text-[9px] px-1 bg-emerald-50 text-emerald-700 rounded font-semibold">
                        {cust.totalOrders} Ord
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="pt-2 border-t border-stone-100 flex gap-2">
              <input
                type="tel"
                placeholder="Or input custom phone (e.g. 9199998888)"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                className="flex-1 text-xs px-3 py-2 border border-stone-200 rounded-lg outline-none focus:border-amber-500 focus:bg-stone-50"
                id="custom-phone-input"
              />
              {customPhone && (
                <button
                  onClick={() => setCustomPhone("")}
                  className="text-stone-400 text-xs hover:text-stone-600 self-center px-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Tab Selection inside Simulators Section: WhatsApp Chat vs Audio call */}
          <div className="bg-white rounded-xl border border-stone-200/80 shadow-sm overflow-hidden flex flex-col h-[525px]">
            
            {/* Simulator Switcher Header */}
            <div className="bg-stone-50 border-b border-stone-100 p-2 flex gap-1">
              <button
                onClick={() => {
                  if (isCallActive) handleTerminateCall();
                  setWaVoiceMode(false);
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  !isCallActive && !waVoiceMode
                    ? "bg-white text-stone-900 shadow-sm border border-stone-100"
                    : "text-stone-500 hover:text-stone-900"
                }`}
                id="tab-wa-sim"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>WhatsApp Sim</span>
              </button>

              <button
                onClick={() => {
                  if (!isCallActive) handleStartCall();
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  isCallActive
                    ? "bg-stone-900 text-amber-300 shadow-md"
                    : "text-stone-500 hover:text-stone-900"
                }`}
                id="tab-call-sim"
              >
                <Phone className="w-3.5 h-3.5 text-amber-600" />
                {isCallActive ? (
                  <span className="flex items-center gap-1.5">
                    Live Call ({Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, "0")})
                  </span>
                ) : (
                  <span>Voice Call Sim</span>
                )}
              </button>
            </div>

            {/* Sim 1: WHATSAPP PANEL */}
            {!isCallActive && (
              <div className="flex-1 flex flex-col bg-stone-50 overflow-hidden relative">
                
                {/* Chat Partner Metadata Banner */}
                <div className="bg-emerald-600 text-white px-4 py-2.5 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="bg-white/20 p-1.5 rounded-full text-sm font-semibold">🟩</div>
                    <div>
                      <h3 className="font-semibold text-xs text-white leading-tight">
                        Neha (Supr Ghee Agent)
                      </h3>
                      <p className="text-[10px] text-emerald-100 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full inline-block animate-ping"></span>
                        <span>Trilingual Bot • Active</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-[11px] bg-emerald-800 px-2 py-0.5 rounded text-emerald-100">
                    +{getSimulatedPhone()}
                  </div>
                </div>

                {/* Chat Messages Body */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 flex flex-col justify-end">
                  <div className="my-auto text-center p-4">
                    <p className="text-[10px] text-stone-400 bg-stone-200/50 px-3 py-1.5 rounded-full inline-block">
                      🔒 Encodings synced via Simulated Meta Cloud Webhooks
                    </p>
                  </div>

                  {getActiveWAConversation()?.messages.map((msg, index) => {
                    const isUser = msg.sender === "customer";
                    const isSystem = msg.sender === "system";

                    if (isSystem) {
                      return (
                        <div key={index} className="text-center py-2 text-[10px] font-mono text-amber-700/80 italic">
                          {msg.text}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={index}
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-xs shadow-sm shadow-black/5 flex flex-col ${
                          isUser
                            ? "bg-emerald-600 text-white self-end rounded-br-none"
                            : "bg-white text-stone-900 self-start rounded-bl-none border border-stone-200/60"
                        }`}
                      >
                        {msg.type === "audio" && (
                          <div className="flex items-center gap-2 mb-1.5 bg-stone-100/10 text-[10px] py-1 px-1.5 rounded text-emerald-100 border border-white/10">
                            <Volume2 className="w-3 h-3 text-stone-300" />
                            <span>Voice Note simulated transcription</span>
                          </div>
                        )}
                        <span className="whitespace-pre-wrap leading-relaxed">{msg.text}</span>
                        <span className={`text-[9px] mt-1 text-right block self-end ${isUser ? "text-emerald-100" : "text-stone-400"}`}>
                          {formatDateTime(msg.timestamp)}
                        </span>
                      </div>
                    );
                  })}

                  <div ref={chatEndRef}></div>
                </div>

                {/* Preset Suggestions Bar */}
                <div className="px-2 py-1.5 bg-stone-100 border-t border-stone-200/60 flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none">
                  <button
                    onClick={() => handleSendWhatsApp(undefined, false, "Namaste! Ghee nu price shu che?")}
                    className="bg-white hover:bg-stone-50 text-stone-700 text-[10px] px-2.5 py-1 rounded-full border border-stone-200/80 text-ellipsis truncate max-w-[150px] cursor-pointer"
                  >
                    "price shu che?" (Gujlish)
                  </button>
                  <button
                    onClick={() => handleSendWhatsApp(undefined, false, "મારે ૧ લીટર બિલૌના ઘી જોઈએ છે. કઈ રીતે ઓર્ડર થાય?")}
                    className="bg-white hover:bg-stone-50 text-stone-700 text-[10px] px-2.5 py-1 rounded-full border border-stone-200/80 text-ellipsis truncate max-w-[150px] cursor-pointer"
                  >
                    "મારે ૧ લીટર ઘી જોઈએ" (Gujarati)
                  </button>
                  <button
                    onClick={() => handleSendWhatsApp(undefined, false, "Why is your Gir cow ghee so expensive compared to others?")}
                    className="bg-white hover:bg-stone-50 text-stone-700 text-[10px] px-2.5 py-1 rounded-full border border-stone-200/80 text-ellipsis truncate max-w-[150px] cursor-pointer"
                  >
                    "Why so expensive?" (English)
                  </button>
                  <button
                    onClick={() => handleSendWhatsApp(undefined, true, "Bhai ek combo pack order mukvo che")}
                    className="bg-amber-100 hover:bg-amber-150 text-stone-800 text-[10px] px-2.5 py-1 rounded-full border border-amber-200 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    🎙️ Sim Voice: "1 combo pack dyo"
                  </button>
                </div>

                {/* Quick Replies Helper Bar */}
                {data?.db?.quickReplies && data.db.quickReplies.length > 0 && (
                  <div className="px-2 py-1.5 bg-stone-50 border-t border-stone-200/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                    <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wide font-mono select-none bg-amber-50 px-1 py-0.5 rounded border border-amber-200">Templates:</span>
                    {data.db.quickReplies.map((qr) => (
                      <button
                        key={qr.id}
                        type="button"
                        onClick={() => setWhatsappInputValue(qr.text)}
                        className="bg-white hover:bg-amber-50 text-stone-700 text-[10px] px-2 py-1 rounded-lg border border-stone-200 hover:border-amber-400 font-mono transition cursor-pointer flex items-center gap-1.5 shrink-0"
                        title={qr.text}
                      >
                        <span className="text-amber-800 font-bold">{qr.shortcut}</span>
                        <span className="text-stone-300">|</span>
                        <span className="font-sans text-stone-600">{qr.title}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Send Typing Bar */}
                <form onSubmit={handleSendWhatsApp} className="p-2 bg-white border-t border-stone-200 flex gap-2" id="wa-form">
                  <input
                    type="text"
                    value={whatsappInputValue}
                    onChange={(e) => setWhatsappInputValue(e.target.value)}
                    placeholder="Type trilingual message (English, Gujarati, Gujlish)..."
                    className="flex-1 text-xs px-3 py-2 border border-stone-200 rounded-lg outline-none focus:border-emerald-500"
                    disabled={isSendingWA}
                    id="wa-text-input"
                  />
                  
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg transition disabled:bg-stone-300 flex items-center justify-center cursor-pointer"
                    disabled={isSendingWA || !whatsappInputValue.trim()}
                    id="wa-send-btn"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* Sim 2: VOICE CALLING PANEL */}
            {isCallActive && (
              <div className="flex-1 flex flex-col bg-stone-900 text-stone-100 overflow-hidden relative">
                
                {/* Visualizer and Status Banner */}
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="w-16 h-16 bg-amber-500 text-stone-950 rounded-full flex items-center justify-center text-xl font-bold animate-pulse shadow-xl shadow-amber-500/20">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-serif font-semibold text-amber-100">
                      Active AI Voice Stream
                    </h3>
                    <p className="text-stone-400 text-[11px] font-mono">
                      Session ID: {callSessionId} • Phone: +{getSimulatedPhone()}
                    </p>
                  </div>

                  {/* Simulated Oscilloscope Wave */}
                  <div className="flex items-end justify-center gap-1 h-16 w-full max-w-[280px] bg-stone-950/50 px-4 py-3 rounded-2xl border border-stone-800/40 shadow-inner">
                    {waveHeights.map((val, idx) => {
                      const centerDist = Math.abs(idx - 11.5) / 11.5; // distance from central bar (0 to 1)
                      const barColor = isSpeakingAI
                        ? `rgba(245, 158, 11, ${1 - centerDist * 0.45})` // Core glowing Amber energy
                        : `rgba(245, 158, 11, ${0.45 - centerDist * 0.3})`; // Gentle idle orange hue

                      return (
                        <span
                          key={idx}
                          className="w-1 rounded-full transition-all duration-75"
                          style={{
                            height: `${val}px`,
                            backgroundColor: barColor,
                            boxShadow: isSpeakingAI ? '0 0 10px rgba(245, 158, 11, 0.45)' : 'none'
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* AI Output Caption Bubble */}
                  <div className="bg-stone-800 text-amber-200 px-4 py-3 rounded-lg border border-stone-750 text-xs font-semibold leading-relaxed max-w-sm">
                    {isSpeakingAI ? (
                      <span className="animate-pulse">Neha is speaking verbally...</span>
                    ) : (
                      aiSpeechOutput || "Ready for voice or typed instructions..."
                    )}
                  </div>
                </div>

                {/* Embedded Transcripts Ledger */}
                <div className="h-32 bg-stone-950 border-t border-stone-800 p-2 overflow-y-auto space-y-1.5 text-[11px]">
                  <p className="text-stone-500 text-[10px] font-mono border-b border-stone-900 pb-1 flex justify-between">
                    <span>Live Call Transcript Logs</span>
                    <span>No markup standard</span>
                  </p>
                  {callTranscript.map((t, idx) => (
                    <div key={idx} className="flex gap-2 leading-relaxed">
                      <span className={`font-semibold shrink-0 ${t.speaker === 'customer' ? 'text-blue-400' : 'text-amber-400'}`}>
                        {t.speaker === 'customer' ? 'Customer' : 'Neha AI'}:
                      </span>
                      <span className="text-stone-300">{t.phrase}</span>
                    </div>
                  ))}
                </div>

                {/* Admin Internal Notes Text Area */}
                <div className="bg-stone-900 p-3 border-t border-stone-800 space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-stone-400 font-semibold">
                    <label htmlFor="active-call-notes" className="flex items-center gap-1.5 text-amber-450 hover:text-amber-400">
                      <span>📝 Admin Internal Call Notes</span>
                    </label>
                    <span className="text-[9px] font-mono text-stone-500">Saves with final transcript</span>
                  </div>
                  <textarea
                    id="active-call-notes"
                    value={activeCallNotes}
                    onChange={(e) => setActiveCallNotes(e.target.value)}
                    placeholder="Manually type or append internal notes for this active call session here (e.g. bulk discount discussions, delivery instructions...)"
                    className="w-full h-16 bg-stone-950 border border-stone-800 focus:border-amber-500 rounded p-2 text-stone-200 text-xs placeholder-stone-600 focus:ring-1 focus:ring-amber-500 outline-none resize-none font-sans"
                  />
                </div>

                {/* Microphone error banner */}
                {speechError && (
                  <div className="bg-red-900/60 text-red-200 px-3 py-1.5 text-[10px] border-t border-red-800 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{speechError}</span>
                  </div>
                )}

                {/* Call Typing or Voice Stream Controls */}
                <div className="p-3 bg-stone-900/40 border-t border-stone-800 space-y-2">
                  <p className="text-[10px] text-stone-400">Suggest what to say to the Ghee Sales Agent:</p>
                  <div className="flex gap-1 overflow-x-auto whitespace-nowrap pb-1 scrollbar-none">
                    <button
                      onClick={() => handleSimulateVoicePhrase("Namaste, mare 2 litre ghee vechvu che Surat mate")}
                      className="bg-stone-850 hover:bg-stone-800 text-stone-300 text-[9px] px-2.5 py-1 rounded"
                    >
                      "mare 2 litre ghee vechvu che Surat" (Order)
                    </button>
                    <button
                      onClick={() => handleSimulateVoicePhrase("Is this ghee standard Vedic Bilona method or dairy cream?")}
                      className="bg-stone-850 hover:bg-stone-800 text-stone-300 text-[9px] px-2.5 py-1 rounded"
                    >
                      "Vedic Bilona process?" (Audit)
                    </button>
                    <button
                      onClick={() => handleSimulateVoicePhrase("Ah standard glass bottle break to nahi thay ne parcel ma?")}
                      className="bg-stone-850 hover:bg-stone-800 text-stone-300 text-[9px] px-2.5 py-1 rounded"
                    >
                      "Glass jar break threat?" (objection)
                    </button>
                  </div>
                  
                  <div className="flex gap-2" id="voice-input-row">
                    <button
                      onClick={handleToggleVoiceRecognize}
                      className={`p-2 rounded-lg flex items-center justify-center transition cursor-pointer ${
                        isRecording
                          ? "bg-red-600 text-white animate-pulse"
                          : "bg-amber-500 text-stone-950 hover:bg-amber-400"
                      }`}
                      title="Toggle Speech Recognition"
                      id="mic-btn"
                    >
                      {isRecording ? <MicOff className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4" />}
                    </button>

                    <input
                      type="text"
                      placeholder="Type voice statement (English, Gujarati, Gujlish)..."
                      value={speakValue}
                      onChange={(e) => setSpeakValue(e.target.value)}
                      className="flex-1 bg-stone-800 text-xs px-3 py-2 text-stone-100 rounded-lg outline-none focus:border-amber-400 placeholder-stone-500 border border-transparent"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSimulateVoicePhrase();
                      }}
                      id="call-text-input"
                    />

                    <button
                      onClick={() => handleSimulateVoicePhrase()}
                      className="bg-stone-700 text-xs text-amber-200 px-3 rounded-lg hover:bg-stone-650 cursor-pointer"
                      id="call-send-btn"
                    >
                      Speak
                    </button>
                  </div>

                  {/* Hang up auto SMS trigger button */}
                  <button
                    onClick={handleTerminateCall}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
                    id="hangup-call-btn"
                  >
                    <Phone className="w-4 h-4 rotate-135" />
                    <span>Hang Up (Triggers Automated Follow-up WhatsApp Invoice)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Webhook & Sheets Sync Logs Console Window */}
          <div className="bg-stone-950 p-4 rounded-xl border border-stone-800 shadow-xl overflow-hidden flex flex-col h-[270px]">
            <h2 className="text-xs font-semibold tracking-wider text-stone-400 uppercase flex items-center justify-between border-b border-stone-800 pb-2 mb-2 shrink-0">
              <span className="flex items-center gap-1.5 text-amber-500">
                <Database className="w-3.5 h-3.5" />
                <span>Webhooks & Sync Event Stream</span>
              </span>
              <span className="text-[10px] text-stone-400 font-mono flex items-center gap-1.5" id="live-logs-status">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-semibold text-stone-400">Live Logs</span>
                <span className="text-[9px] text-stone-600 bg-stone-900 border border-stone-850 px-1 py-0.2 rounded font-mono">Synced</span>
              </span>
            </h2>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-[11px] font-mono">
              {data?.db?.webhookLogs.map((log) => {
                let badgeColor = "bg-purple-950 text-purple-300 border-purple-500/25";
                if (log.service === "WhatsApp") badgeColor = "bg-emerald-950 text-emerald-300 border-emerald-500/25";
                if (log.service === "Razorpay") badgeColor = "bg-blue-950 text-blue-300 border-blue-500/25";
                if (log.service === "Sheets") badgeColor = "bg-green-950 text-green-300 border-green-500/25";

                return (
                  <div key={log.id} className="bg-stone-900/60 p-2 rounded border border-stone-800/80 flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${badgeColor}`}>
                        {log.service}
                      </span>
                      <span className="text-stone-500">{formatDateTime(log.timestamp)}</span>
                    </div>
                    <div className="text-stone-300 text-white/90">
                      <span className="text-amber-500">Event:</span> {log.event}
                    </div>
                    <div className="bg-stone-950/80 text-[10px] text-stone-400 p-1 rounded border border-stone-850 truncate">
                      {JSON.stringify(log.payload)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
        </section>

        {/* RIGHT COLUMN: MAIN ADMIN OPERATING PANELS - spans 7 cols */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Admin Panels Navigation Tabs bar */}
          <div className="bg-white p-2 rounded-xl border border-stone-200/80 shadow-sm flex items-center justify-between overflow-x-auto whitespace-nowrap gap-1">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("analytics")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === "analytics"
                    ? "bg-amber-600 text-stone-950 font-bold"
                    : "text-stone-600 hover:bg-stone-50"
                }`}
                id="tab-analytics"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Analytics</span>
              </button>

              <button
                onClick={() => setActiveTab("orders")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === "orders"
                    ? "bg-amber-600 text-stone-950 font-bold"
                    : "text-stone-600 hover:bg-stone-50"
                }`}
                id="tab-orders"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Orders ({totalOrdersCount})</span>
              </button>

              <button
                onClick={() => setActiveTab("customers")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === "customers"
                    ? "bg-amber-600 text-stone-950 font-bold"
                    : "text-stone-600 hover:bg-stone-50"
                }`}
                id="tab-customers"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Customer CRM ({customerBaseCount})</span>
              </button>

              <button
                onClick={() => setActiveTab("sheets")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer relative ${
                  activeTab === "sheets"
                    ? "bg-amber-600 text-stone-950 font-bold"
                    : "text-stone-600 hover:bg-stone-50"
                }`}
                id="tab-sheets"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Google Sheets</span>
                <span className="absolute -top-1 -right-1 bg-green-600 text-white rounded-full w-2.5 h-2.5 inline-block border border-white animate-ping"></span>
              </button>

              <button
                onClick={() => setActiveTab("prompts")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === "prompts"
                    ? "bg-amber-600 text-stone-950 font-bold"
                    : "text-stone-600 hover:bg-stone-50"
                }`}
                id="tab-prompts"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>AI Prompts</span>
              </button>
            </div>

            {/* Manual Order button */}
            <button
              onClick={() => setShowManualOrderForm(true)}
              className="bg-stone-900 hover:bg-stone-850 text-stone-100 font-semibold px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
              id="open-manual-order-btn"
            >
              <Plus className="w-3.5 h-3.5 text-amber-500" />
              <span>Manual Billing</span>
            </button>
          </div>

          {/* TAB CONTENT: WEB ANALYTICS DASHBOARD */}
          {activeTab === "analytics" && (
            <div className="space-y-6" id="panel-analytics">
              
              {/* Dynamic KPI Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                
                <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-sm flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                    Total Revenue
                  </span>
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold font-serif text-stone-900">
                      ₹{totalRevenue.toLocaleString("en-IN")}
                    </span>
                    <Coins className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
                    <span>100% Razorpay synced</span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-sm flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                    Active Clients
                  </span>
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold font-serif text-stone-900">
                      {customerBaseCount}
                    </span>
                    <Users className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="text-[10px] text-stone-500 mt-1">
                    Mobile numbers as Unique IDs
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-sm flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                    Paid / Pending Ord
                  </span>
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold font-serif text-stone-900">
                      {paidOrdersCount} / {pendingOrdersCount}
                    </span>
                    <ShoppingBag className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-[10px] text-amber-600 font-semibold mt-1">
                    ₹{(pendingOrdersCount * 1800).toLocaleString("en-IN")} pending followups
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-sm flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                    AI Lead Conversion
                  </span>
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold font-serif text-stone-900">
                      {Math.round((paidOrdersCount / (customerBaseCount || 1)) * 100)}%
                    </span>
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-[10px] text-stone-500 mt-1">
                    Conversion standard rate
                  </div>
                </div>

              </div>

              {/* 30-Day Daily Revenue Trend Line Chart */}
              <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-4" id="chart-revenue-trends">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                      Daily Revenue Trend (Last 30 Days)
                    </h3>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Completed sales revenue flow tracked via simulated billing webhooks
                    </p>
                  </div>
                  <div className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded text-xs font-bold font-mono">
                    30D Peak: ₹{Math.max(...dailyTrendsData.map(d => d.Revenue), 0).toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="h-64 w-full min-h-[256px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <LineChart data={dailyTrendsData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#78716c" 
                        fontSize={10}
                        tickLine={false}
                        dy={8}
                      />
                      <YAxis 
                        stroke="#78716c" 
                        fontSize={10} 
                        tickLine={false}
                        tickFormatter={(v) => `₹${v}`}
                        dx={-8}
                      />
                      <Tooltip 
                        formatter={(value) => [`₹${value.toLocaleString("en-IN")}`, "Revenue"]}
                        contentStyle={{ fontSize: '11px', borderRadius: '8px' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Revenue" 
                        stroke="#d97706" 
                        strokeWidth={2.5}
                        activeDot={{ r: 6 }}
                        dot={{ r: 3, strokeWidth: 1 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Dynamic Recharts Visualization Suite */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Bar Chart: Selling Pack Sizes popularity */}
                <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Product Packs Volume Popularity (Sizes Sold)
                  </h3>
                  <div className="h-56 min-h-[224px]">
                    <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0}>
                      <BarChart data={sizeBarData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                        <XAxis dataKey="name" stroke="#78716c" fontSize={11} />
                        <YAxis stroke="#78716c" fontSize={11} />
                        <Tooltip />
                        <Bar dataKey="QuantitySold" fill="#d97706" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Pie Chart: Customer Language Distribution preferences */}
                <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-4 flex flex-col justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Trilingual Split (Preferred Accent)
                  </h3>
                  <div className="h-56 flex items-center justify-center">
                    {languagePieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0}>
                        <PieChart>
                          <Pie
                            data={languagePieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {languagePieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-xs text-stone-400">Loading language telemetry metrics...</p>
                    )}
                  </div>
                </div>

                {/* 3. Donut Chart: Receivables Health (Paid vs. Pending orders Ratio) */}
                <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                      Receivables Health (Paid vs. Pending)
                    </h3>
                    <p className="text-[10px] text-stone-400">
                      Visual break-up of invoice closure ratios
                    </p>
                  </div>
                  <div className="h-56 min-h-[224px] flex items-center justify-center relative">
                    {paidOrdersCount + pendingOrdersCount > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0}>
                          <PieChart>
                            <Pie
                              data={paymentStatusPieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={75}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, value }) => `${name}: ${value}`}
                            >
                              <Cell fill="#10b981" />
                              <Cell fill="#f59e0b" />
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Centered overlay badge inside donut */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                          <span className="text-xl font-serif font-bold text-stone-800">
                            {((paidOrdersCount / (paidOrdersCount + pendingOrdersCount || 1)) * 100).toFixed(0)}%
                          </span>
                          <span className="text-[9px] text-stone-400 uppercase font-semibold">Paid Ratio</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-stone-400">No order payment records found.</p>
                    )}
                  </div>
                  <div className="flex items-center justify-around border-t border-stone-100 pt-3 text-[11px] font-medium text-stone-600">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Paid ({paidOrdersCount})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span>Pending ({pendingOrdersCount})</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Business Overview & Objections Handling Prompt */}
              <div className="bg-[#FAF7F2] border border-amber-600/10 p-5 rounded-xl space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🥛</span>
                  <h3 className="text-md font-serif font-semibold text-amber-950">
                    Traditional Gir Cow Vedic Ghee Knowledge base
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-stone-200/40">
                    <h4 className="font-semibold text-amber-900 mb-1">Raw A2 Milk Churn</h4>
                    <p className="text-stone-600 leading-relaxed">
                      Requires 30 litres raw pasture-fed Gir cow A2 milk to carefully hand-make 1 single litre jar of elite Ghee.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-stone-200/40">
                    <h4 className="font-semibold text-amber-900 mb-1">Traditional Vedic Bilona</h4>
                    <p className="text-stone-600 leading-relaxed">
                      Milk fermented to curd overnight. Curd hand-whipped with wooden churning rod (mathni) before slow copper boiling.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-stone-200/40">
                    <h4 className="font-semibold text-amber-900 mb-1">Objection Shield</h4>
                    <p className="text-stone-600 leading-relaxed">
                      Equips our virtual agent with solid objections handling responses for pricing, delivery security, and genuine laboratory certification.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB CONTENT: ORDERS LEDGER */}
          {activeTab === "orders" && (
            <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-4" id="panel-orders">
              <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center border-b border-stone-100 pb-4">
                <div>
                  <h3 className="text-md font-serif font-semibold text-stone-900">
                    Core Sales & Billing Receipts
                  </h3>
                  <p className="text-xs text-stone-500">Durable Orders Table</p>
                </div>
                
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
                  {/* Search query input */}
                  <div className="relative w-full sm:w-60 md:w-68">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      placeholder="Search Order ID or Customer Name..."
                      className="w-full pl-9 pr-8 py-1.5 text-xs bg-stone-50 border border-stone-250 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 placeholder-stone-400 text-stone-800"
                      id="order-search-input"
                    />
                    {orderSearchQuery && (
                      <button
                        onClick={() => setOrderSearchQuery("")}
                        className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-stone-400 hover:text-stone-600 focus:outline-none text-[10px] uppercase font-semibold"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Date range dropdown */}
                  <div className="flex items-center">
                    <select
                      value={orderDateRange}
                      onChange={(e) => setOrderDateRange(e.target.value as any)}
                      className="text-xs bg-stone-50 border border-stone-250 rounded-lg px-2.5 py-1.5 text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-semibold cursor-pointer align-middle"
                      id="order-date-range-select"
                    >
                      <option value="all">📅 All Dates</option>
                      <option value="3days">📅 Last 3 days</option>
                      <option value="7days">📅 Last 7 days</option>
                      <option value="30days">📅 Last 30 days</option>
                      <option value="custom">📅 Custom Range...</option>
                    </select>
                  </div>

                  {/* Payment status dropdown */}
                  <div className="flex items-center">
                    <select
                      value={orderPaymentStatusFilter}
                      onChange={(e) => setOrderPaymentStatusFilter(e.target.value as any)}
                      className="text-xs bg-stone-50 border border-stone-250 rounded-lg px-2.5 py-1.5 text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-semibold cursor-pointer align-middle"
                      id="order-payment-status-select"
                    >
                      <option value="all">💳 All Payments</option>
                      <option value="Paid">🟢 Paid Only</option>
                      <option value="Pending">🟡 Pending Only</option>
                    </select>
                  </div>

                  {/* Custom range dates inline */}
                  {orderDateRange === "custom" && (
                    <div className="flex items-center gap-1.5 bg-stone-50/70 border border-stone-200/85 px-2 py-1 rounded-lg">
                      <input
                        type="date"
                        value={orderStartDate}
                        onChange={(e) => setOrderStartDate(e.target.value)}
                        className="text-[11px] bg-white border border-stone-200 rounded px-1.5 py-0.5 text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-500 outline-none"
                        id="order-start-date"
                      />
                      <span className="text-[9px] text-stone-400 font-medium font-mono uppercase">to</span>
                      <input
                        type="date"
                        value={orderEndDate}
                        onChange={(e) => setOrderEndDate(e.target.value)}
                        className="text-[11px] bg-white border border-stone-200 rounded px-1.5 py-0.5 text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-500 outline-none"
                        id="order-end-date"
                      />
                      {(orderStartDate || orderEndDate) && (
                        <button
                          onClick={() => {
                            setOrderStartDate("");
                            setOrderEndDate("");
                          }}
                          className="text-[10px] text-stone-400 hover:text-stone-600 font-bold px-1"
                          title="Reset custom dates"
                          type="button"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}

                  {/* Export PDF Summary Button */}
                  <button
                    onClick={handleExportPDF}
                    className="flex items-center justify-center gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg border border-amber-700 shadow-sm transition cursor-pointer select-none"
                    id="btn-export-pdf-invoice"
                    title="Export currently filtered table as styled PDF ledger summary"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF Ledger</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-100 text-stone-500 font-medium">
                      <th className="py-2.5 font-bold uppercase tracking-wider text-[10px]">Order ID</th>
                      <th className="py-2.5 font-bold uppercase tracking-wider text-[10px]">Customer</th>
                      <th className="py-2.5 font-bold uppercase tracking-wider text-[10px]">Product / Size</th>
                      <th className="py-2.5 font-bold uppercase tracking-wider text-[10px]">Total Amount</th>
                      <th className="py-2.5 font-bold uppercase tracking-wider text-[10px]">Billing Info</th>
                      <th className="py-2.5 font-bold uppercase tracking-wider text-[10px]">Shipment Status</th>
                      <th className="py-2.5 font-bold uppercase tracking-wider text-[10px] text-right">Webhook Loop</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const list = getFilteredOrders();

                      if (list.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-stone-400 font-medium">
                              No orders match the search criteria.
                            </td>
                          </tr>
                        );
                      }

                      return list.map((ord) => (
                        <tr key={ord.orderId} className="border-b border-stone-100 hover:bg-stone-50/50">
                          <td className="py-3 font-semibold font-mono text-stone-900">{ord.orderId}</td>
                          <td className="py-3">
                            <div className="font-semibold">{ord.customerName}</div>
                            <div className="text-[10px] text-stone-500 font-mono">+{ord.customerPhone}</div>
                          </td>
                          <td className="py-3">
                            <div className="font-semibold leading-tight">{ord.productName}</div>
                            <div className="text-[10px] text-amber-700 font-bold">{ord.size} x {ord.quantity}</div>
                          </td>
                          <td className="py-3 font-bold font-serif text-stone-900">₹{ord.amount}</td>
                          <td className="py-3">
                            {ord.paymentStatus === "Paid" ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded font-semibold flex items-center gap-1 w-max">
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Paid</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-300 rounded font-semibold flex items-center gap-1 w-max animate-pulse">
                                <Clock className="w-3.5 h-3.5 animate-spin" />
                                <span>Pending</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <select
                                value={ord.shippingStatus}
                                onChange={(e) => handleUpdateShippingStatus(ord.orderId, e.target.value)}
                                className={`px-2 py-1 rounded text-[10px] font-bold border outline-none cursor-pointer focus:ring-1 focus:ring-amber-500 hover:border-stone-400 transition-colors ${
                                  updatingOrderId === ord.orderId ? "animate-pulse ring-2 ring-amber-400" : ""
                                } ${
                                  ord.shippingStatus === "Delivered" ? "bg-stone-50 text-stone-800 border-stone-300" :
                                  ord.shippingStatus === "Shipped" ? "bg-teal-50 text-teal-700 border-teal-200" :
                                  ord.shippingStatus === "Returned" ? "bg-red-50 text-red-700 border-red-200" :
                                  "bg-blue-50 text-blue-700 border-blue-200"
                                }`}
                                id={`ship-status-select-${ord.orderId}`}
                              >
                                <option value="Processing">Processing</option>
                                <option value="Shipped">Shipped</option>
                                <option value="Delivered">Delivered</option>
                                <option value="Returned">Returned</option>
                              </select>
                              <button
                                onClick={() => setSelectedTrackingOrder(ord)}
                                className="p-1 px-1.5 flex items-center justify-center bg-stone-100 hover:bg-amber-100 border border-stone-200 hover:border-amber-300 text-stone-600 hover:text-amber-800 rounded transition"
                                title="Track shipment live timeline"
                                id={`btn-track-order-${ord.orderId}`}
                              >
                                <Truck className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            {ord.paymentStatus === "Pending" ? (
                              <button
                                onClick={() => handleTriggerRazorpayWebhook(ord.orderId)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded text-[10px] select-none transition cursor-pointer"
                                id={`pay-webhook-btn-${ord.orderId}`}
                              >
                                Sim Razorpay webhook
                              </button>
                            ) : (
                              <span className="text-[10px] text-stone-400 font-medium">Auto-confirmed</span>
                            )}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB CONTENT: CUSTOMER CRM CARDS */}
          {activeTab === "customers" && (
            <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-4" id="panel-customers">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-stone-100 pb-3">
                <div>
                  <h3 className="text-md font-serif font-semibold text-stone-900">
                    Customer Directory & CRM
                  </h3>
                  <p className="text-xs text-stone-500">Secure records of returning Vedic ghee patrons</p>
                </div>
                <span className="text-xs text-stone-500 font-mono">Mobile Identifier Keys</span>
              </div>

              {/* CRM Search Input and Statistics Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    placeholder="Search by customer name or phone..."
                    className="w-full pl-9 pr-8 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-medium"
                    id="customer-search-input"
                  />
                  {customerSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearchQuery("")}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-stone-400 hover:text-stone-600 focus:outline-none"
                    >
                      <span className="text-xs font-bold">✕</span>
                    </button>
                  )}
                </div>
                {(() => {
                  const filteredList = (data?.db?.customers || []).filter((cust) => {
                    const query = customerSearchQuery.toLowerCase().trim();
                    if (!query) return true;
                    return (
                      cust.name.toLowerCase().includes(query) ||
                      cust.phone.includes(query)
                    );
                  });
                  return (
                    <div className="text-xs text-stone-500 font-semibold bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-100">
                      Patrons: <span className="text-stone-800">{filteredList.length}</span> / {data?.db?.customers.length || 0}
                    </div>
                  );
                })()}
              </div>

              {(() => {
                const filteredCustomers = (data?.db?.customers || []).filter((cust) => {
                  const query = customerSearchQuery.toLowerCase().trim();
                  if (!query) return true;
                  return (
                    cust.name.toLowerCase().includes(query) ||
                    cust.phone.includes(query)
                  );
                });

                if (filteredCustomers.length === 0) {
                  return (
                    <div className="py-12 text-center bg-stone-50/50 rounded-xl border border-dashed border-stone-200">
                      <p className="text-sm text-stone-500 font-serif italic">No matching patrons found</p>
                      <p className="text-xs text-stone-400 mt-1">Try another name prefix or mobile code</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredCustomers.map((cust) => (
                      <div key={cust.phone} className="p-4 rounded-xl border border-stone-200 border-stone-200/70 hover:border-amber-500/40 transition bg-stone-50/40 relative" id={`customer-card-${cust.phone}`}>
                        
                        {/* Customer Header Meta */}
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-serif font-semibold text-stone-900 flex items-center gap-2">
                              <span>{cust.name}</span>
                            </h4>
                            <p className="text-xs text-stone-500 font-mono">+{cust.phone}</p>
                          </div>

                          <div className="flex flex-col gap-1 items-end">
                            <span className="text-[10px] px-1.5 py-0.5 font-semibold bg-amber-100 text-amber-800 rounded animate-fade-in">
                              Lang: {cust.preferredLanguage}
                            </span>
                            <div className="flex gap-1">
                              {cust.tags.map((tag, idx) => (
                                <span key={idx} className="text-[9px] px-1.5 bg-stone-100 text-stone-600 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Address Detail info */}
                        <p className="text-stone-600 text-[11px] leading-relaxed mb-3 mt-2 pr-1">
                          <span className="font-semibold text-stone-700">Address:</span> {cust.address || "Pending checkout allocation"}
                        </p>

                        {/* CRM footer order sync telemetry */}
                        <div className="border-t border-stone-200/50 pt-2 flex items-center justify-between text-[11px]">
                          <span className="text-stone-500">
                            Total Sync: <strong className="text-stone-900">{cust.totalOrders} order(s)</strong>
                          </span>
                          {cust.lastOrderDate && (
                            <span className="text-[10px] text-stone-400">
                              Last Sale: {new Date(cust.lastOrderDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB CONTENT: VIRTUAL GOOGLE SHEETS LIVE SYNC */}
          {activeTab === "sheets" && (
            <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-4" id="panel-sheets">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-stone-200/60 pb-3">
                <div>
                  <h3 className="text-md font-serif font-semibold text-stone-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    <span>Simulated Google Sheets API Real-time Database Sync</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Every background DB edit automatically appends new rows into owner's connected spreadsheet files.
                  </p>
                </div>

                {/* Service Account verification flags */}
                <div className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-1 rounded flex items-center gap-1.5 font-medium shrink-0">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-ping"></span>
                  <span>Google Service Account Linked</span>
                </div>
              </div>

              {/* Grid represent sheet tables */}
              <div className="space-y-6">
                
                {/* Customers sync tab */}
                <div className="space-y-2 border border-stone-200/80 rounded-lg overflow-hidden bg-stone-50/20">
                  <div className="bg-stone-100/60 px-4 py-2 flex justify-between items-center border-b border-stone-250">
                    <span className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                      <span className="text-green-600">📊</span> Sheet 1: Customers Sync Ledger
                    </span>
                    <a
                      href="/api/sheets/download/customers"
                      download
                      className="text-[11px] bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 font-semibold px-2 py-1 rounded flex items-center gap-1 transition"
                    >
                      <Download className="w-3.5 h-3.5 text-stone-500" />
                      <span>Download .csv</span>
                    </a>
                  </div>
                  <div className="p-3 text-[11px] overflow-x-auto text-stone-600 leading-relaxed font-mono">
                    <div className="bg-stone-950 text-neutral-300 p-2 rounded whitespace-pre">
                      Phone, Name, Language, TotalOrders, LastOrderDate<br />
                      {data?.db?.customers.map(c => (
                        <div key={c.phone}>{c.phone}, "{c.name}", {c.preferredLanguage}, {c.totalOrders}, "{c.lastOrderDate || 'None'}"</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Orders sync tab */}
                <div className="space-y-2 border border-stone-200/80 rounded-lg overflow-hidden bg-stone-50/20">
                  <div className="bg-stone-100/60 px-4 py-2 flex justify-between items-center border-b border-stone-250">
                    <span className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                      <span className="text-green-600">📊</span> Sheet 2: Orders Sync Ledger
                    </span>
                    <a
                      href="/api/sheets/download/orders"
                      download
                      className="text-[11px] bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 font-semibold px-2 py-1 rounded flex items-center gap-1 transition"
                    >
                      <Download className="w-3.5 h-3.5 text-stone-500" />
                      <span>Download .csv</span>
                    </a>
                  </div>
                  <div className="p-3 text-[11px] overflow-x-auto text-stone-600 leading-relaxed font-mono">
                    <div className="bg-stone-950 text-neutral-300 p-2 rounded whitespace-pre">
                      OrderID, CustomerName, Phone, Product, Qty, Amount, PStatus<br />
                      {data?.db?.orders.map(o => (
                        <div key={o.orderId}>{o.orderId}, "{o.customerName}", {o.customerPhone}, "{o.size}", {o.quantity}, ₹{o.amount}, {o.paymentStatus}</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Leads Sync tab */}
                <div className="space-y-2 border border-stone-200/80 rounded-lg overflow-hidden bg-stone-50/20">
                  <div className="bg-stone-100/60 px-4 py-2 flex justify-between items-center border-b border-stone-250">
                    <span className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                      <span className="text-green-600">📊</span> Sheet 3: Leads Conversation Loop Sync
                    </span>
                    <a
                      href="/api/sheets/download/leads"
                      download
                      className="text-[11px] bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 font-semibold px-2 py-1 rounded flex items-center gap-1 transition"
                    >
                      <Download className="w-3.5 h-3.5 text-stone-500" />
                      <span>Download .csv</span>
                    </a>
                  </div>
                  <div className="p-3 text-[11px] text-stone-600 leading-relaxed font-mono">
                    <div className="bg-stone-950 text-neutral-300 p-2 rounded whitespace-pre">
                      Phone, EstimatedLang, Touchpoints, LastUpdated<br />
                      {data?.db?.conversations.map(c => (
                        <div key={c.customerPhone}>{c.customerPhone}, {c.language}, {c.messages.length} message(s), "{c.updatedAt}"</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Call Logs Sync tab */}
                <div className="space-y-2 border border-stone-200/80 rounded-lg overflow-hidden bg-stone-50/20">
                  <div className="bg-stone-100/60 px-4 py-2 flex justify-between items-center border-b border-stone-250">
                    <span className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                      <span className="text-green-600">📊</span> Sheet 4: Voice Call Records & Transcripts Sync
                    </span>
                    <a
                      href="/api/sheets/download/calls"
                      download
                      className="text-[11px] bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 font-semibold px-2 py-1 rounded flex items-center gap-1 transition"
                    >
                      <Download className="w-3.5 h-3.5 text-stone-500" />
                      <span>Download .csv</span>
                    </a>
                  </div>
                  <div className="p-3 text-[11px] text-stone-600 leading-relaxed font-mono">
                    <div className="bg-stone-950 text-neutral-300 p-2 rounded whitespace-pre max-h-[300px] overflow-y-auto">
                      CallID, CustomerPhone, Duration, OrdersCreated, InternalNotes, Summary<br />
                      {(data?.db?.callLogs || []).length === 0 ? (
                        <span className="text-stone-500">// No call sessions recorded yet</span>
                      ) : (
                        data?.db?.callLogs.map(c => (
                          <div key={c.id} className="border-b border-stone-800 pb-1.5 last:border-0 pt-1.5">
                            <div><span className="text-amber-400 font-bold">{c.id}</span> | Phone: {c.customerPhone} | Duration: {c.duration}s | Orders: {c.ordersCreated.join(",") || "None"}</div>
                            <div className="text-stone-300 mt-1 pl-3 border-l border-stone-750">
                              <span className="text-amber-500/80 font-bold">Internal Notes:</span> <span className="text-amber-200 font-sans">{c.internalNotes || "N/A (No notes appended)"}</span>
                            </div>
                            <div className="text-stone-400 pl-3 border-l border-stone-750">
                              <span className="text-blue-400 font-bold">Summary:</span> {c.summary}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB CONTENT: PROMPTS AND KNOWLEDGE BASE */}
          {activeTab === "prompts" && (
            <div className="space-y-6">
              {/* SYSTEM PROMPTS CARD */}
              <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-4" id="panel-prompts">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-md font-serif font-semibold text-stone-900">
                      System Prompt Core Instructions
                    </h3>
                    <p className="text-xs text-stone-500">Configures the AI Agent's behavioral logic and rules.</p>
                  </div>
                  <span className="text-xs text-stone-500 font-mono bg-stone-100 px-2 py-0.5 rounded">Configures Agent's Brain</span>
                </div>

                {/* WhatsApp prompt */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-700 block">
                    🛡️ Neha Bot's WhatsApp System Prompt Instruction
                  </label>
                  <textarea
                    value={editedWhatsappPrompt}
                    onChange={(e) => setEditedWhatsappPrompt(e.target.value)}
                    className="w-full h-44 text-stone-800 text-xs p-3 font-mono border border-stone-200 rounded-lg outline-none focus:border-amber-500"
                  />
                </div>

                {/* Call prompt */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-700 block">
                    📞 Neha Bot's Phone Agent System Prompt Instruction (Shortspoken, No Markdown)
                  </label>
                  <textarea
                    value={editedCallPrompt}
                    onChange={(e) => setEditedCallPrompt(e.target.value)}
                    className="w-full h-44 text-stone-800 text-xs p-3 font-mono border border-stone-200 rounded-lg outline-none focus:border-amber-500"
                  />
                </div>

                {/* Preferred Gemini Model Selector */}
                <div className="space-y-1.5 p-3.5 rounded-lg bg-stone-50 border border-stone-200">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-stone-700 block mb-0">
                      ⚙️ Selected Gemini LLM Engine
                    </label>
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Free Version Fallback Configured
                    </span>
                  </div>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full text-xs text-stone-800 p-2.5 bg-white border border-stone-200 rounded-lg outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash (Default Standard Engine - Limit 20/day)</option>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Free High-Permissiveness Engine)</option>
                  </select>
                  <p className="text-[11px] text-stone-500 font-sans mt-1 leading-normal">
                    💡 If your model quota is exhausted, the server will **automatically fail over** to the free <code className="bg-stone-200 text-stone-800 px-1 rounded text-[10px]">gemini-3.1-flash-lite</code> model, then to our offline trilingual heuristics so the voice and WhatsApp systems never go down!
                  </p>
                </div>

                {/* Save Prompt action buttons */}
                <div className="pt-3 border-t border-stone-100 flex justify-end">
                  <button
                    onClick={handleSavePrompts}
                    disabled={isSavingPrompts}
                    className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold px-4 py-2 rounded-lg text-xs transition active:scale-95 cursor-pointer disabled:bg-stone-300"
                  >
                    {isSavingPrompts ? "Saving System Prompts..." : "Persist Prompt Updates"}
                  </button>
                </div>
              </div>

              {/* QUICK REPLIES MANAGEMENT SECTION */}
              <div className="bg-white p-5 rounded-xl border border-stone-200/80 shadow-sm space-y-4" id="panel-quick-replies">
                <div className="border-b border-stone-100 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="text-md font-serif font-semibold text-stone-900 flex items-center gap-2">
                      <span className="text-amber-600 text-lg">⚡</span>
                      <span>Quick Replies & Reusable Message Templates</span>
                    </h3>
                    <p className="text-xs text-stone-500">
                      Admins can save standard canned responses, pricing tables, or objection templates.
                    </p>
                  </div>
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
                    WhatsApp Agent Assets
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                  {/* Add / Edit Form (cols-4) */}
                  <div className="lg:col-span-4 bg-stone-50 p-4 rounded-lg border border-stone-200/60 space-y-4 h-fit" id="qr-form-container">
                    <div className="flex justify-between items-center pb-2 border-b border-stone-200">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                        {qrId ? "✏️ Edit Template" : "✨ Create Template"}
                      </h4>
                      {qrId && (
                        <button
                          onClick={() => {
                            setQrId("");
                            setQrTitle("");
                            setQrShortcut("");
                            setQrText("");
                          }}
                          className="text-[10px] text-stone-500 hover:text-stone-800 underline uppercase font-semibold"
                          type="button"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-stone-600 block">Template Title</label>
                        <input
                          type="text"
                          placeholder="e.g., Vedic Bilona Method"
                          value={qrTitle}
                          onChange={(e) => setQrTitle(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 text-stone-800"
                          id="qr-title-input"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-stone-600 block flex justify-between">
                          <span>Shortcut Link Key</span>
                          <span className="text-[9px] font-normal text-stone-400 font-mono">Starts with /</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., /bilona"
                          value={qrShortcut}
                          onChange={(e) => setQrShortcut(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 text-stone-800"
                          id="qr-shortcut-input"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-stone-600 block">Template Message Body</label>
                        <textarea
                          placeholder="Write the full response template. Trilingual texts or pricing tables work beautifully."
                          rows={6}
                          value={qrText}
                          onChange={(e) => setQrText(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 text-stone-800"
                          id="qr-text-input"
                        />
                      </div>

                      <button
                        onClick={handleSaveQuickReply}
                        disabled={qrIsSaving}
                        className="w-full bg-stone-900 hover:bg-stone-800 text-white font-semibold py-2 px-3 rounded text-xs select-none cursor-pointer transition disabled:bg-stone-300"
                        id="qr-save-btn"
                      >
                        {qrIsSaving ? "Saving..." : qrId ? "Update Quick Reply" : "Add Quick Reply"}
                      </button>
                    </div>
                  </div>

                  {/* Templates List (cols-8) */}
                  <div className="lg:col-span-8 space-y-4">
                    {/* Search Bar */}
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400">
                        <Search className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        placeholder="Search templates by title, shortcut, or content..."
                        value={qrSearchQuery}
                        onChange={(e) => setQrSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-10 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-stone-800"
                        id="qr-search-input"
                      />
                      {qrSearchQuery && (
                        <button
                          onClick={() => setQrSearchQuery("")}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-450 hover:text-stone-700 text-[10px] uppercase font-semibold text-stone-500"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* List */}
                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 text-stone-705">
                      {(() => {
                        const list = data?.db?.quickReplies || [];
                        const filtered = list.filter((qr) => {
                          const term = qrSearchQuery.toLowerCase().trim();
                          if (!term) return true;
                          return (
                            qr.title.toLowerCase().includes(term) ||
                            qr.shortcut.toLowerCase().includes(term) ||
                            qr.text.toLowerCase().includes(term)
                          );
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="py-16 text-center text-stone-400 text-xs font-medium bg-stone-50/50 rounded-xl border border-dashed border-stone-200">
                              No templates found matching "{qrSearchQuery}"
                            </div>
                          );
                        }

                        return filtered.map((qr) => (
                          <div
                            key={qr.id}
                            className="p-3 bg-white border border-stone-200/80 hover:border-amber-300 rounded-xl hover:shadow-sm transition-all duration-200 space-y-2 relative"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-serif font-bold text-stone-900 text-xs">{qr.title}</span>
                                <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  {qr.shortcut}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleEditQuickReply(qr)}
                                  className="p-1 hover:bg-stone-100 rounded text-stone-600 hover:text-stone-900 transition"
                                  title="Edit Template"
                                  id={`edit-qr-${qr.id}`}
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteQuickReply(qr.id)}
                                  className="p-1 hover:bg-red-50 rounded text-stone-400 hover:text-red-600 transition"
                                  title="Delete Template"
                                  id={`delete-qr-${qr.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="text-stone-600 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-stone-50 hover:bg-stone-105 p-3 rounded-lg border border-stone-100 font-mono">
                              {qr.text}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </section>

      </main>

      {/* FOOTER METRICS VERIFICATION CREDITS */}
      <footer className="mt-auto bg-stone-900 text-stone-400 py-6 border-t border-stone-800 px-6 text-xs text-center leading-relaxed">
        <p className="max-w-2xl mx-auto">
          Supr Ghee Operating System • Formulated on full-stack architecture running Node.js Express server. Pure Vedic Bilona method (glass jars carefully packed). Powered by Google AI Studio agent.
        </p>
      </footer>

      {/* MODAL 1: Day 25 Automated reorder alerts drafts */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full overflow-hidden border border-amber-300">
            
            <div className="bg-amber-50 px-6 py-4 border-b border-amber-200 flex justify-between items-center">
              <h3 className="font-serif font-bold text-amber-950 text-md flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <span>Simulated Automated CRM Reorder Reminders (Day 25 Cron)</span>
              </h3>
              <button
                onClick={() => setShowReminderModal(false)}
                className="text-stone-500 hover:text-stone-900 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
              <p className="text-xs text-stone-500 leading-relaxed">
                Our scheduler reviews ordering historical timestamps in the database. When ~25 days have elapsed since their last ghee shipment, Neha drafts a friendly reorder sequence on WhatsApp.
              </p>

              {reminderDrafts.length > 0 ? (
                <div className="space-y-3.5">
                  {reminderDrafts.map((draft, idx) => (
                    <div key={idx} className="bg-stone-50 p-4 rounded-lg border border-stone-200 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-[11px] font-semibold text-stone-700">
                        <span>Customer name: {draft.customer}</span>
                        <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">
                          {draft.daysPassed} Days passed
                        </span>
                      </div>
                      
                      <div className="bg-white p-3 rounded border border-stone-150 leading-relaxed font-mono text-[10px] text-stone-600 whitespace-pre-wrap">
                        {draft.message}
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => handleSendReminderToWa(draft.phone, draft.message)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>Dispatch WA Note</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-stone-400">
                  <CheckCircle className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                  <p className="text-xs">No pending reorder reminders required for active customer base.</p>
                </div>
              )}
            </div>

            <div className="bg-stone-50 px-6 py-3 border-t border-stone-200 text-right">
              <button
                onClick={() => setShowReminderModal(false)}
                className="bg-stone-900 text-stone-100 font-bold px-4 py-1.5 text-xs rounded-lg cursor-pointer hover:bg-stone-800"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: Admin Manual Order Form */}
      {showManualOrderForm && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateManualOrder}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200"
          >
            <div className="bg-stone-950 text-stone-100 px-6 py-4 flex justify-between items-center">
              <h3 className="font-serif font-bold text-amber-100 text-sm flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-500" />
                <span>Manual Admin Billing dispatcher</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowManualOrderForm(false)}
                className="text-stone-400 hover:text-stone-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-stone-700">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Parthbhai Kavad"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-stone-200 rounded-lg outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-stone-700">Phone Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 919876543210"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-stone-200 rounded-lg outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700">Volume Size</label>
                  <select
                    value={manualSize}
                    onChange={(e) => setManualSize(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-stone-200 rounded-lg outline-none focus:border-amber-500"
                  >
                    <option value="500ml">500ml Jar (₹950)</option>
                    <option value="1L">1L Jar (₹1800)</option>
                    <option value="5L">5L Tin (₹8500)</option>
                    <option value="Combo">Combo Pack (₹3450)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-stone-700">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={manualQty}
                    onChange={(e) => setManualQty(parseInt(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-stone-200 rounded-lg outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-stone-700">Deliverability Address *</label>
                <textarea
                  required
                  placeholder="Street and house name, pincode"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  className="w-full text-xs p-3 border border-stone-200 rounded-lg outline-none focus:border-amber-500 h-20"
                />
              </div>
            </div>

            <div className="bg-stone-50 px-6 py-3 border-t border-stone-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowManualOrderForm(false)}
                className="bg-white border border-stone-300 text-stone-700 font-bold px-3 py-1.5 text-xs rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold px-4 py-1.5 text-xs rounded-lg cursor-pointer block"
              >
                Create Manual Order
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Shipment Live Tracking Timeline */}
      {selectedTrackingOrder && (() => {
        const o = selectedTrackingOrder;
        const orderTime = new Date(o.createdAt);
        
        const formatOffsetDate = (hours: number) => {
          const d = new Date(orderTime.getTime() + hours * 60 * 60 * 1000);
          return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        };

        const steps = [
          {
            id: "placed",
            title: "Order Placed & Registered",
            desc: "Authentic A2 Gir Bilona Ghee purchase successfully registered in our production logs.",
            isCompleted: true,
            time: orderTime.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
            icon: <Box className="w-4 h-4" />
          },
          {
            id: "payment",
            title: o.paymentStatus === "Paid" ? "Payment Authorized" : "Payment Awaiting Lock",
            desc: o.paymentStatus === "Paid" 
              ? `Ledger clearance checked. ₹${o.amount} securely credited.`
              : "Financial settlement pending customer payment activation trigger.",
            isCompleted: o.paymentStatus === "Paid",
            time: o.paymentStatus === "Paid" ? formatOffsetDate(0.15) : "Pending Gateway",
            icon: <Coins className="w-4 h-4" />
          },
          {
            id: "processing",
            title: "Traditional Churning & Glass Packaging",
            desc: "Batch filtered, placed into sterile glass jars, and cocooned with traditional canvas strings.",
            isCompleted: o.shippingStatus === "Shipped" || o.shippingStatus === "Delivered",
            isActive: o.shippingStatus === "Processing" && o.paymentStatus === "Paid",
            time: (o.shippingStatus === "Shipped" || o.shippingStatus === "Delivered") ? formatOffsetDate(4) : "In Assay Queue",
            icon: <Package className="w-4 h-4" />
          },
          {
            id: "shipped",
            title: o.shippingStatus === "Returned" ? "Shipment Return Dispatch" : "In Transit via Vedic Express",
            desc: o.shippingStatus === "Returned"
              ? "Re-routed back to regional warehouse repository due to courier transit issues."
              : (o.shippingStatus === "Shipped" || o.shippingStatus === "Delivered")
                ? "Dispatched from warehouse depot. Tracking ID: VEDIC-GHEE-8491"
                : "Awaiting hand-off to premium parcel service.",
            isCompleted: o.shippingStatus === "Shipped" || o.shippingStatus === "Delivered" || o.shippingStatus === "Returned",
            isActive: false,
            time: (o.shippingStatus === "Shipped" || o.shippingStatus === "Delivered" || o.shippingStatus === "Returned") ? formatOffsetDate(18) : "Pending pickup",
            icon: <Truck className="w-4 h-4" />
          },
          {
            id: "delivered",
            title: o.shippingStatus === "Delivered" 
              ? "Delivered & Handed Over" 
              : o.shippingStatus === "Returned"
                ? "Returned & Replenished"
                : "Out for Local Delivery Milestone",
            desc: o.shippingStatus === "Delivered"
              ? "Delivered directly to designated patron address. Pure ghee hand-delivered."
              : o.shippingStatus === "Returned"
                ? "Batch returned back to sterile temperature storage."
                : o.shippingStatus === "Shipped"
                  ? "Arrived in local hub. Delivery rider assigned."
                  : "Awaiting final localized leg of transit.",
            isCompleted: o.shippingStatus === "Delivered" || o.shippingStatus === "Returned",
            isActive: o.shippingStatus === "Shipped",
            time: o.shippingStatus === "Delivered" ? formatOffsetDate(42) : o.shippingStatus === "Returned" ? formatOffsetDate(32) : "Awaiting destination",
            icon: <MapPin className="w-4 h-4" />
          }
        ];

        return (
          <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="modal-tracking-timeline">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200 flex flex-col max-h-[90vh]">
              
              {/* Header */}
              <div className="bg-stone-950 text-stone-100 px-5 py-4 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="font-serif font-bold text-amber-100 text-sm flex items-center gap-2">
                    <Truck className="w-5 h-5 text-amber-400" />
                    <span>Shipment Tracking Ledger</span>
                  </h3>
                  <p className="text-[10px] text-stone-400 mt-0.5">Order Ref: {o.orderId}</p>
                </div>
                <button
                  onClick={() => setSelectedTrackingOrder(null)}
                  className="text-stone-400 hover:text-stone-100 p-1.5 rounded-lg hover:bg-stone-800 transition"
                  id="btn-close-tracking-modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-4">
                
                {/* Meta Summary Block */}
                <div className="bg-stone-50 p-3 rounded-xl border border-stone-200/65 grid grid-cols-2 gap-3 text-[11px] text-stone-600">
                  <div>
                    <span className="block font-semibold uppercase tracking-wider text-[9px] text-stone-400">Patron</span>
                    <strong className="text-stone-900 block mt-0.5">{o.customerName}</strong>
                    <span className="text-[10px] font-mono block mt-0.5">+{o.customerPhone}</span>
                  </div>
                  <div>
                    <span className="block font-semibold uppercase tracking-wider text-[9px] text-stone-400">Ghee Jar Size</span>
                    <strong className="text-stone-900 block mt-0.5">{o.productName}</strong>
                    <span className="text-[10px] font-semibold text-amber-800 block mt-0.5">{o.size} jar x {o.quantity} qty</span>
                  </div>
                </div>

                {/* Timeline vertical stack */}
                <div className="relative pl-6 space-y-6 py-2 border-l border-stone-200 ml-3">
                  {steps.map((step, idx) => {
                    let dotBg = "bg-stone-100 text-stone-400 border-stone-200";
                    let textAccent = "text-stone-400";
                    let titleStyle = "text-stone-500 font-medium";

                    if (step.isCompleted) {
                      dotBg = "bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/15";
                      textAccent = "text-emerald-700 font-semibold";
                      titleStyle = "text-stone-900 font-serif font-bold";
                    } else if (step.isActive) {
                      dotBg = "bg-amber-500 text-stone-950 border-amber-600 animate-pulse shadow-md shadow-amber-500/20";
                      textAccent = "text-amber-700 font-semibold";
                      titleStyle = "text-amber-900 font-serif font-semibold";
                    }

                    return (
                      <div key={step.id} className="relative group transition-all duration-300">
                        {/* Timeline point dot */}
                        <div className={`absolute -left-[35px] top-0.5 w-6 h-6 rounded-full border flex items-center justify-center transition-all ${dotBg}`}>
                          {step.isCompleted && !step.isActive ? (
                            <CheckCircle className="w-3.5 h-3.5" />
                          ) : (
                            step.icon
                          )}
                        </div>

                        {/* Timeline Details */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-start gap-2">
                            <h4 className={`text-xs ${titleStyle}`}>{step.title}</h4>
                            <span className="text-[10px] font-mono text-stone-400 select-none whitespace-nowrap shrink-0">
                              {step.time}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 leading-relaxed font-sans pr-2">
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Footer action button */}
              <div className="bg-stone-50 px-5 py-3.5 border-t border-stone-100 flex justify-between items-center shrink-0">
                <span className="text-[10px] text-stone-400 flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                  <span>Real-time satcom updates synced</span>
                </span>
                <button
                  onClick={() => setSelectedTrackingOrder(null)}
                  className="bg-stone-900 hover:bg-stone-800 text-stone-100 font-bold px-4 py-1.5 text-xs rounded-lg cursor-pointer transition"
                >
                  Close Timeline
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
