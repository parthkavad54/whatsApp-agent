import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "en" | "gu";

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    "nav.overview": "Overview",
    "nav.orders": "Orders",
    "nav.customers": "Customers",
    "nav.ai-agent": "AI Agent",
    "nav.analytics": "Analytics",
    "nav.integrations": "Integrations",
    "nav.logs": "Logs & Activity",

    // Header
    "header.newOrder": "New Order",
    "header.searchPlaceholder": "Search all records...",
    "header.alertCenter": "Alert Center",
    "header.unread": "unread",
    "header.markRead": "Mark Read",
    "header.clearAll": "Clear All",
    "header.liveChannel": "System connected via Live Polling Channel",

    // Overview & Metrics
    "metrics.revenue": "Gross Revenue",
    "metrics.revenueDesc": "Real-time Bilona Ledger",
    "metrics.dispatches": "Total Dispatches",
    "metrics.dispatchesDesc": "Vedic Express handovers",
    "metrics.patrons": "Registered Patrons",
    "metrics.patronsDesc": "94% Returning Rate",
    "metrics.avgValue": "Average Order Value",
    "metrics.avgValueDesc": "Optimized 1L/5L jars",
    
    "charts.growthLedger": "Ghee Revenue Growth Ledger",
    "charts.growthDesc": "Traditional Sales logs generated through online WhatsApp and dial-in interactions",
    "charts.jarDistribution": "Jar Size Distribution",
    "charts.jarDesc": "Demand breakdown by size volume packages",
    "charts.complianceTitle": "Vedic Bilona Standards",
    "charts.complianceDesc": "Every jar represents unadulterated churned ghee sourced from authentic Indian Gir cows, boiled at optimal firewood temperatures on full-moon evenings. Our CRM ensures full-path traceability matching high-standard production logs.",
    "charts.complianceGuard": "Operational Quality Guard",
    "charts.traceability": "Traceability Check: PASSED",
    "charts.registryActive": "Vedic Registry Active",
    "charts.clearanceLedger": "Financial Clearance Ledger",
    "charts.clearanceDesc": "Razorpay gateway payment validation metrics",

    // Orders Tab
    "orders.title": "Daily Dispatches Ledger",
    "orders.desc": "Add, track, and manage all your A2 Bilona Desi Ghee order fulfillments",
    "orders.manualBooking": "Manual Booking",
    "orders.search": "Search by patron name, phone, or order reference ID...",
    "orders.modalTitle": "Log Manual Traditional Booking",
    "orders.phoneLabel": "Patron Phone Number (10 digits) *",
    "orders.nameLabel": "Customer Full Name *",
    "orders.sizeLabel": "Select Product Size *",
    "orders.qtyLabel": "Quantity of Jars *",
    "orders.addressLabel": "Complete Shipping Address *",
    "orders.saveBtn": "Save Order / Log Dispatch",
    "orders.markDelivered": "Mark as Delivered",
    "orders.markDeliveredShort": "Delivered",
    "orders.markCancelled": "Mark as Cancelled",
    "orders.markCancelledShort": "Cancel",
    "orders.printLabel": "Print Shipping Label",
    "orders.printLabelShort": "Print Label",
    
    // Customers Tab
    "customers.title": "Active Patrons & Languages",
    "customers.desc": "Review patron ordering histories, profiles, and communication preferences",
    "customers.searchPlaceholder": "Search by name, phone preference...",
    
    // Logs Tab
    "logs.title": "System Audit Loggers",
    "logs.desc": "Review live external webhooks pings, and dial-in interactive speech call recordings",
    "logs.webhookTab": "Webhook API Logs",
    "logs.callTab": "Voice Call Records",
    "logs.search": "Search webhook JSON events, payloads, timestamps...",
    
    // Profile
    "profile.name": "Daksha Ahir",
    "profile.role": "Business Owner",

    // Inventory & Low Stock Translation
    "analytics.inventoryTitle": "Vedic Ghee Physical Inventory Control",
    "analytics.inventoryDesc": "Monitor remaining stock of glass jar batches and critical bilona replenishment alerts",
    "analytics.item": "Product Name / Premium Package",
    "analytics.size": "Jar Size",
    "analytics.price": "Unit Price",
    "analytics.stockLeft": "Stock Remaining",
    "analytics.status": "Stock Status",
    "analytics.badgeLow": "LOW STOCK",
    "analytics.badgeNormal": "OPTIMAL",
  },
  gu: {
    // Navigation
    "nav.overview": "ઓવરવ્યુ",
    "nav.orders": "ઓર્ડર્સ",
    "nav.customers": "ગ્રાહકો",
    "nav.ai-agent": "એઆઈ એજન્ટ",
    "nav.analytics": "વિશ્લેષણ",
    "nav.integrations": "ઇન્ટિગ્રેશન",
    "nav.logs": "લોગ પ્રવૃત્તિ",

    // Header
    "header.newOrder": "નવો ઓર્ડર",
    "header.searchPlaceholder": "બધા રેકોર્ડ્સ શોધો...",
    "header.alertCenter": "ચેતવણી કેન્દ્ર",
    "header.unread": "અણવાંચેલા",
    "header.markRead": "વાંચેલું માર્ક કરો",
    "header.clearAll": "બધું સાફ કરો",
    "header.liveChannel": "લાઇવ પોલિંગ ચેનલ દ્વારા સિસ્ટમ જોડાયેલ છે",

    // Overview & Metrics
    "metrics.revenue": "કુલ આવક",
    "metrics.revenueDesc": "રીઅલ-ટાઇમ બિલોના લેજર",
    "metrics.dispatches": "કુલ ડિસ્પેચ",
    "metrics.dispatchesDesc": "વૈદિક એક્સપ્રેસ હેન્ડઓવર",
    "metrics.patrons": "રજિસ્ટર્ડ ગ્રાહકો",
    "metrics.patronsDesc": "૯૪% રીટર્નિંગ રેટ",
    "metrics.avgValue": "સરેરાશ ઓર્ડર મૂલ્ય",
    "metrics.avgValueDesc": "ઓપ્ટિમાઇઝ્ડ ૧L/૫L જાર",
    
    "charts.growthLedger": "ઘી વેચાણ વૃદ્ધિ ખાતાવહી",
    "charts.growthDesc": "વોટ્સએપ અને કોલિંગ વાર્તાલાપ દ્વારા ઘી વેચાણ દૈનિક ખાતાવહી પ્રવૃત્તિ",
    "charts.jarDistribution": "જાર સાઇઝ વિતરણ",
    "charts.jarDesc": "પેકેજ સાઇઝ વોલ્યુમ અનુસાર વિભાજન",
    "charts.complianceTitle": "વૈદિક બિલોના ધોરણો",
    "charts.complianceDesc": "દરેક જાર અસલી ભારતીય ગીર ગાયોમાંથી બનેલ મલાઇ વલોણા શુદ્ધ ઘી દર્શાવે છે જેને લાકડાના બળતણ તાપમાન પર ઉકાળવામાં આવેલ છે. અમારું CRM ઉત્પાદન લોગ સાથે સંપૂર્ણ ટ્રેસેબિલિટી સુનિશ્ચિત કરે છે.",
    "charts.complianceGuard": "કાર્યાત્મક ગુણવત્તા ગાર્ડ",
    "charts.traceability": "ટ્રેસેબિલિટી ચેક: પાસ",
    "charts.registryActive": "વૈદિક રજિસ્ટ્રી સક્રિય",
    "charts.clearanceLedger": "નાણાકીય ચુકવણી ખાતાવહી",
    "charts.clearanceDesc": "રેઝરપે પેમેન્ટ ગેટવે ચકાસણી મેટ્રિક્સ",

    // Orders Tab
    "orders.title": "દૈનિક ડિસ્પેચ ખાતાવહી",
    "orders.desc": "તમારા બધા એ૨ બિલોના દેશી ગીર ગાયના ઘી ઓર્ડરનું ટ્રેકિંગ અને સંચાલન કરો",
    "orders.manualBooking": "મેન્યુઅલ બુકિંગ",
    "orders.search": "ગ્રાહકનું નામ, ફોન અથવા ઓર્ડર આઈડી દ્વારા શોધો...",
    "orders.modalTitle": "મેન્યુઅલ ઓર્ડર નોંધણી",
    "orders.phoneLabel": "ગ્રાહકનો ફોન નંબર (૧૦ અંકો) *",
    "orders.nameLabel": "ગ્રાહકનું આખું નામ *",
    "orders.sizeLabel": "જારની સાઇઝ પસંદ કરો *",
    "orders.qtyLabel": "જારની સંખ્યા *",
    "orders.addressLabel": "સંપૂર્ણ શિપિંગ સરનામું *",
    "orders.saveBtn": "ઓર્ડર સાચવો / લોગ ડિસ્પેચ",
    "orders.markDelivered": "ડિલિવર તરીકે માર્ક કરો",
    "orders.markDeliveredShort": "ડિલિવર",
    "orders.markCancelled": "રદ તરીકે માર્ક કરો",
    "orders.markCancelledShort": "રદ કરો",
    "orders.printLabel": "શિપિંગ લેબલ પ્રિન્ટ કરો",
    "orders.printLabelShort": "લેબલ પ્રિન્ટ",
    
    // Customers Tab
    "customers.title": "સક્રિય ગ્રાહકો અને ભાષાઓ",
    "customers.desc": "ગ્રાહકોના ઓર્ડર ઇતિહાસ, પ્રોફાઇલ અને વાતચીત પસંદગીઓની સમીક્ષા કરો",
    "customers.searchPlaceholder": "નામ કે ફોન નંબર દ્વારા શોધો...",
    
    // Logs Tab
    "logs.title": "સિસ્ટમ ઓડિટ લોગ પ્રક્રિયા",
    "logs.desc": "લાઇવ બહારી વેબહુક્સ પિંગ અને ડાયલ-ઇન ઇન્ટરેક્ટિવ સ્પીચ કોલ રેકોર્ડિંગની સમીક્ષા કરો",
    "logs.webhookTab": "વેબહુક API લોગ્ઝ",
    "logs.callTab": "વોઇસ કોલ રેકોર્ડ્સ",
    "logs.search": "વેબહુક JSON કન્ટેન્ટ, પેલોડ, ટાઇમસ્ટેમ્પ દ્વારા શોધો...",
    
    // Profile
    "profile.name": "દક્ષા આહીર",
    "profile.role": "બિઝનેસ માલિક",

    // Inventory & Low Stock Translation
    "analytics.inventoryTitle": "વૈદિક ઘી ભૌતિક સ્ટોક નિયંત્રણ",
    "analytics.inventoryDesc": "ગ્લાસ જાર બેચના બાકીના સ્ટોક અને વૈદિક વલોણા પુનઃપ્રાપ્તિ ચેતવણીઓનું નિરીક્ષણ કરો",
    "analytics.item": "ઉત્પાદન નામ / પ્રીમિયમ પેકેજ",
    "analytics.size": "જાર સાઇઝ",
    "analytics.price": "એકમ કિંમત",
    "analytics.stockLeft": "બાકી રહેલો જથ્થો",
    "analytics.status": "સ્ટોકની સ્થિતિ",
    "analytics.badgeLow": "ઓછો સ્ટોક",
    "analytics.badgeNormal": "પર્યાપ્ત",
  },
};

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("app_language");
      if (saved === "en" || saved === "gu") return saved as Language;
    }
    return "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app_language", lang);
  };

  const t = (key: string): string => {
    const activeDict = translations[language] || translations["en"];
    if (activeDict[key] !== undefined) {
      return activeDict[key];
    }
    // Fallback directly to english if translation missing
    const fallbackDict = translations["en"];
    return fallbackDict[key] !== undefined ? fallbackDict[key] : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
