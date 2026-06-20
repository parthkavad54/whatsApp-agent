import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Send, 
  Phone, 
  Settings, 
  Volume2, 
  Mic, 
  MicOff, 
  CheckCircle, 
  ChevronRight, 
  RotateCcw, 
  Database, 
  Plus, 
  Trash2, 
  MessageSquare, 
  Sliders, 
  VolumeX,
  Play,
  Square,
  AlertTriangle
} from "lucide-react";
import { Customer, Product, Conversation, QuickReply, CallLog } from "../types";

interface AIAgentTabProps {
  customers: Customer[];
  products: Product[];
  conversations: Conversation[];
  quickReplies: QuickReply[];
  isGeminiConfigured: boolean;
  isQuotaExhausted: boolean;
  isLiteQuotaExhausted: boolean;
  prompts: {
    whatsappSystem: string;
    callsSystem: string;
    languageDetection: string;
    objectionHandling: string;
  };
  onUpdatePrompts: (prompts: any) => Promise<void>;
  onResetQuota: () => Promise<void>;
  onSaveQuickReply: (reply: { title: string; shortcut: string; text: string }) => Promise<void>;
  onDeleteQuickReply: (id: string) => Promise<void>;
  onSimulateWhatsApp: (phone: string, text: string, type?: string) => Promise<{ response: string; toolsUsed?: string[] }>;
  onSimulateCallPhrase: (phone: string, phrase: string) => Promise<{ response: string; parsedData?: any }>;
  onEndCall: (phone: string, notes?: string) => Promise<{ log: CallLog }>;
  onRefreshData: () => void;
  mongoEnabled?: boolean;
}

export default function AIAgentTab({
  customers,
  products,
  conversations,
  quickReplies = [],
  isGeminiConfigured,
  isQuotaExhausted,
  isLiteQuotaExhausted,
  prompts,
  onUpdatePrompts,
  onResetQuota,
  onSaveQuickReply,
  onDeleteQuickReply,
  onSimulateWhatsApp,
  onSimulateCallPhrase,
  onEndCall,
  onRefreshData,
  mongoEnabled = false
}: AIAgentTabProps) {
  // Tabs "prompt" | "simulator-whatsapp" | "simulator-call" | "replies"
  const [subTab, setSubTab] = useState<"simulator-whatsapp" | "simulator-call" | "prompt" | "replies">("simulator-whatsapp");

  // Prompt edit states
  const [waPrompt, setWaPrompt] = useState(prompts.whatsappSystem || "");
  const [callPrompt, setCallPrompt] = useState(prompts.callsSystem || "");
  const [objectionPlaybook, setObjectionPlaybook] = useState(prompts.objectionHandling || "");
  const [isSavingPrompts, setIsSavingPrompts] = useState(false);

  // Quick Replies list / management
  const [newReplyTitle, setNewReplyTitle] = useState("");
  const [newReplyShortcut, setNewReplyShortcut] = useState("");
  const [newReplyText, setNewReplyText] = useState("");

  // WhatsApp simulation states
  const [selectedPhone, setSelectedPhone] = useState(customers[0]?.phone || "9876543210");
  const [chatMessage, setChatMessage] = useState("");
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Calling simulation states
  const [callActive, setCallActive] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [micActive, setMicActive] = useState(true);
  const [speakingPhrase, setSpeakingPhrase] = useState("");
  const [incomingCallAudio, setIncomingCallAudio] = useState<string | null>(null);
  const [callTranscript, setCallTranscript] = useState<{ speaker: "customer" | "agent"; text: string; time: string }[]>([]);
  const [matchingTracker, setMatchingTracker] = useState({
    size: false,
    quantity: false,
    address: false,
    orderBooked: false
  });
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [loadingPhrase, setLoadingPhrase] = useState(false);

  // SQLite Database Migration States
  const [migrationStatus, setMigrationStatus] = useState<"idle" | "migrating" | "success" | "error">("idle");
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [migrationError, setMigrationError] = useState("");

  // MongoDB Atlas Synchronization States
  const [mongoStatus, setMongoStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [mongoMsg, setMongoMsg] = useState("");

  const handleRunSqlMigration = async () => {
    setMigrationStatus("migrating");
    setMigrationResult(null);
    setMigrationError("");
    try {
      const res = await fetch("/api/db/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned a non-JSON response. This usually indicates a 500 internal server error or 404 endpoint mismatch on the backend.");
      }
      const data = await res.json();
      if (res.ok && data.success) {
        setMigrationStatus("success");
        setMigrationResult(data);
        onRefreshData();
      } else {
        setMigrationStatus("error");
        setMigrationError(data.error || "Migration failed due to server error.");
      }
    } catch (err: any) {
      setMigrationStatus("error");
      setMigrationError(err.message || "Network request failed while migrating.");
    }
  };

  const handleMongoSync = async () => {
    setMongoStatus("syncing");
    setMongoMsg("");
    try {
      const res = await fetch("/api/db/mongo-sync", {
        method: "POST"
      });
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned a non-JSON response. This usually indicates a 500 internal server error or 404 endpoint mismatch on the backend.");
      }
      const data = await res.json();
      if (res.ok && data.success) {
        setMongoStatus("success");
        setMongoMsg(data.message || "Connected and bidirectionally synced state successfully!");
        onRefreshData();
      } else {
        setMongoStatus("error");
        setMongoMsg(data.error || "Sync with MongoDB Atlas timed out or was rejected.");
      }
    } catch (err: any) {
      setMongoStatus("error");
      setMongoMsg(err.message || "Network request failed while synchronizing with cluster.");
    }
  };

  useEffect(() => {
    if (prompts) {
      setWaPrompt(prompts.whatsappSystem || "");
      setCallPrompt(prompts.callsSystem || "");
      setObjectionPlaybook(prompts.objectionHandling || "");
    }
  }, [prompts]);

  // Handle auto scrolling in whatsapp chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversations, selectedPhone]);

  // Call timer simulation
  useEffect(() => {
    let interval: any;
    if (callActive) {
      interval = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    } else {
      setCallTimer(0);
    }
    return () => clearInterval(interval);
  }, [callActive]);

  const activeConversation = conversations.find(c => c.customerPhone === selectedPhone);

  const handleUpdatePrompts = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPrompts(true);
    try {
      await onUpdatePrompts({
        whatsappSystem: waPrompt,
        callsSystem: callPrompt,
        languageDetection: prompts.languageDetection,
        objectionHandling: objectionPlaybook
      });
      alert("Traditional Prompting Playbooks saved in database.");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingPrompts(false);
    }
  };

  const handleCreateReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReplyTitle || !newReplyShortcut || !newReplyText) return;
    try {
      await onSaveQuickReply({
        title: newReplyTitle,
        shortcut: newReplyShortcut,
        text: newReplyText
      });
      setNewReplyTitle("");
      setNewReplyShortcut("");
      setNewReplyText("");
    } catch (err) {
      console.error(err);
    }
  };

  const executeWhatsAppSend = async (messageText: string, simulateVoice = false) => {
    if (!messageText.trim()) return;
    setSendingWhatsApp(true);
    try {
      const textToSimulate = messageText;
      setChatMessage("");
      
      // Perform API call
      await onSimulateWhatsApp(selectedPhone, textToSimulate, simulateVoice ? "audio" : "text");
      onRefreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setSendingWhatsApp(false);
    }
  };

  // Speaks using HTML5 voice synthesis (vocalizes AI responses mock text-to-speech)
  const invokeTts = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Try to select a warm premium voice
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find(v => v.lang.includes("en-IN") || v.name.includes("Google") || v.lang.includes("en-US"));
      if (selectedVoice) utterance.voice = selectedVoice;
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCustomerSpeaking = async (phraseText: string) => {
    if (!phraseText || loadingPhrase) return;
    setLoadingPhrase(true);
    setCallTranscript(prev => [...prev, {
      speaker: "customer",
      text: phraseText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }]);

    try {
      const res = await onSimulateCallPhrase(selectedPhone, phraseText);
      const aiResponse = res.response;

      setCallTranscript(prev => [...prev, {
        speaker: "agent",
        text: aiResponse,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }]);

      // Play vocal synthesized audio for voice call simulator feels!
      invokeTts(aiResponse);

      // Verify keywords parsed in interactive speech engine
      if (res.parsedData) {
        setMatchingTracker({
          size: res.parsedData.parsedSize || matchingTracker.size,
          quantity: res.parsedData.parsedQty || matchingTracker.quantity,
          address: res.parsedData.parsedAddress || matchingTracker.address,
          orderBooked: res.parsedData.orderGenerated || matchingTracker.orderBooked
        });
      }
      
      setSpeakingPhrase("");
      onRefreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPhrase(false);
    }
  };

  const handleCallInitiation = () => {
    setCallActive(true);
    setCallTranscript([{
      speaker: "agent",
      text: "Pranam! Supr Ghee Sales Line. How can I help you regarding high quality Gir cow Bilona Desi Ghee today?",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    invokeTts("Pranam! Supr Ghee Sales Line. How can I help you regarding high quality Gir cow Bilona Desi Ghee today?");
    setMatchingTracker({
      size: false,
      quantity: false,
      address: false,
      orderBooked: false
    });
  };

  const handleCallWrapup = async () => {
    if (!callActive) return;
    try {
      await onEndCall(selectedPhone, "Interacted through voice line calling simulator.");
      setCallActive(false);
      alert("Call completed & transcribed. Notes stored in operational CRM logs.");
      onRefreshData();
    } catch (e) {
      console.error(e);
    }
  };

  // Quick sound generator waveform bar mock
  const renderAudioWaveform = () => (
    <div className="flex items-center gap-0.5 mt-1.5 px-2 py-1 bg-amber-50 rounded-lg max-w-[130px] border border-amber-100">
      <Play className="w-3.5 h-3.5 text-amber-700 mr-1 cursor-pointer shrink-0 fill-amber-700" />
      {[2, 4, 3, 5, 2, 6, 3, 2, 4, 2].map((h, i) => (
        <span 
          key={i} 
          className="w-0.5 bg-amber-500 rounded-xs" 
          style={{ height: `${h * 2.5}px` }} 
        />
      ))}
      <span className="text-[9px] text-amber-700 ml-1.5 font-mono select-none">0:04</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Controller Ribbon */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-stone-200 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs transition-colors">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 p-2 text-amber-900 rounded-lg">
            <Bot className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm">Gemini AI Sales Workspace</h2>
            <p className="text-[10px] text-stone-500 dark:text-zinc-400">Traditional Bilona trilingual operational engines configured</p>
          </div>
        </div>

        {/* Gemini model state indicators */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] text-stone-400 font-mono">Service Hub:</span>
          
          {isGeminiConfigured ? (
            <div className={`px-2.5 py-1 rounded-lg border font-mono text-[10px] flex items-center gap-1.5 font-bold ${
              isQuotaExhausted 
                ? "bg-amber-50 border-amber-200 text-amber-705" 
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isQuotaExhausted ? "bg-amber-500" : "bg-emerald-500"}`} />
              <span>
                {isQuotaExhausted 
                  ? "Standard Quota Limit Hit, switched to Flash Lite backup (No-rate-limit)" 
                  : "Gemini 3.5 Active (High Precision)"
                }
              </span>
            </div>
          ) : (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-1 rounded-lg font-mono text-[10px] flex items-center gap-1.5 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Offline heuristic model sandbox</span>
            </div>
          )}

          {isQuotaExhausted && (
            <button
              onClick={onResetQuota}
              className="bg-stone-900 hover:bg-stone-800 text-white border border-stone-800 px-3 py-1 text-[10px] font-bold rounded-lg transition"
            >
              Reset Limit
            </button>
          )}
        </div>
      </div>

      {/* Sub tabs selectors */}
      <div className="flex gap-2 border-b border-stone-100 pb-px text-xs">
        <button
          onClick={() => setSubTab("simulator-whatsapp")}
          className={`px-4 py-2.5 font-serif font-bold border-b-2 transition ${
            subTab === "simulator-whatsapp" 
              ? "border-amber-500 text-amber-800 scale-102" 
              : "border-transparent text-stone-500 hover:text-stone-900"
          }`}
        >
          WhatsApp Live Terminal
        </button>
        <button
          onClick={() => setSubTab("simulator-call")}
          className={`px-4 py-2.5 font-serif font-bold border-b-2 transition ${
            subTab === "simulator-call" 
              ? "border-amber-500 text-amber-800 scale-102" 
              : "border-transparent text-stone-500 hover:text-stone-900"
          }`}
        >
          Dial-In Call Simulator
        </button>
        <button
          onClick={() => setSubTab("prompt")}
          className={`px-4 py-2.5 font-serif font-bold border-b-2 transition ${
            subTab === "prompt" 
              ? "border-amber-500 text-amber-800 scale-102" 
              : "border-transparent text-stone-500 hover:text-stone-900"
          }`}
        >
          System Prompt Studio
        </button>
        <button
          onClick={() => setSubTab("replies")}
          className={`px-4 py-2.5 font-serif font-bold border-b-2 transition ${
            subTab === "replies" 
              ? "border-amber-500 text-amber-800 scale-102" 
              : "border-transparent text-stone-500 hover:text-stone-900"
          }`}
        >
          Canned Quick Replies
        </button>
      </div>

      {/* Sub Tab Panel: WhatsApp Simulator */}
      {subTab === "simulator-whatsapp" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6" id="whatsapp-sim-dashboard">
          {/* List of customer chat channels */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-stone-200 dark:border-zinc-800 md:col-span-4 flex flex-col space-y-3 transition-colors">
            <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-xs uppercase tracking-wider">Patron Threads</h3>
            <div className="space-y-1.5 overflow-y-auto max-h-[350px]">
              {customers.map(c => {
                const isActive = c.phone === selectedPhone;
                return (
                  <div
                    key={c.phone}
                    onClick={() => setSelectedPhone(c.phone)}
                    className={`p-3 rounded-xl cursor-pointer text-xs transition border flex items-center justify-between ${
                      isActive 
                        ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 font-medium" 
                        : "bg-stone-50/50 dark:bg-zinc-950/20 hover:bg-stone-50 dark:hover:bg-zinc-800/40 border-stone-200/50 dark:border-zinc-800 text-stone-700 dark:text-zinc-300"
                    }`}
                  >
                    <div>
                      <strong className="block font-serif text-stone-900 dark:text-zinc-100">{c.name}</strong>
                      <span className="text-[9px] text-stone-400 font-mono">+{c.phone}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Chat Window */}
          <div className="bg-stone-900 text-stone-200 rounded-2xl md:col-span-8 border border-stone-800 flex flex-col h-[450px]">
            {/* Window header */}
            <div className="bg-stone-950 p-4 border-b border-stone-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div>
                  <h4 className="text-xs font-serif font-bold text-white">
                    {customers.find(c => c.phone === selectedPhone)?.name || "Simulator Patron"}
                  </h4>
                  <span className="text-[9px] text-stone-500">WhatsApp Live Link</span>
                </div>
              </div>
              <span className="bg-neutral-800 text-[9px] text-stone-400 uppercase font-bold px-2 py-0.5 rounded font-mono">
                Bilona CRM Agent
              </span>
            </div>

            {/* Live Message History */}
            <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto scrollbar-none space-y-3">
              {activeConversation && activeConversation.messages.map((m, idx) => {
                const isCustomer = m.sender === "customer";
                const isSystem = m.sender === "system";

                if (isSystem) {
                  return (
                    <div key={idx} className="flex justify-center">
                      <span className="bg-stone-850 border border-stone-800 text-stone-400 text-[10px] px-2.5 py-0.5 rounded-md font-mono">
                        {m.text}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={idx} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[75%] p-3 rounded-2xl text-xs space-y-1 ${
                      isCustomer 
                        ? "bg-stone-800 text-stone-100 rounded-tl-none border border-stone-700/55" 
                        : "bg-amber-600 text-stone-950 rounded-tr-none font-medium border border-amber-500/30"
                    }`}>
                      <p className="leading-relaxed">{m.text}</p>
                      
                      {m.type === "audio" && renderAudioWaveform()}

                      <span className="block text-[9px] text-stone-400 text-right font-mono select-none">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
              {!activeConversation || activeConversation.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-500">
                  <MessageSquare className="w-8 h-8 text-stone-700 mb-2" />
                  <p className="font-serif italic text-xs">No previous message logs. Simulate a new query below.</p>
                </div>
              ) : null}
            </div>

            {/* Message inputs & simulators triggers */}
            <div className="bg-stone-950 p-3 border-t border-stone-850 space-y-2">
              {/* Shortcut template text boxes */}
              <div className="flex flex-wrap gap-1.5 pb-1">
                <span className="text-[9px] text-stone-500 self-center font-mono pr-1 select-none">Quick Sim:</span>
                <button
                  onClick={() => setChatMessage("Price list ketli chhe?")}
                  className="bg-stone-800 hover:bg-stone-700 text-stone-300 px-2 py-0.5 rounded text-[10px]"
                >
                  Price list?
                </button>
                <button
                  onClick={() => setChatMessage("Is this ghee authentic Cow Bilona method?")}
                  className="bg-stone-800 hover:bg-stone-700 text-stone-300 px-2 py-0.5 rounded text-[10px]"
                >
                  Is it authentic?
                </button>
                <button
                  onClick={() => setChatMessage("Mane 1 litre Vadodara moklo.")}
                  className="bg-stone-800 hover:bg-stone-700 text-stone-300 px-2 py-0.5 rounded text-[10px]"
                >
                  Order 1L to Vadodara
                </button>
                <button
                  onClick={() => executeWhatsAppSend("Sent a 5-sec Gujlish voice note", true)}
                  className="bg-amber-950/40 hover:bg-amber-950/80 text-amber-400 border border-amber-900/40 px-2.5 py-0.5 rounded text-[10px] flex items-center gap-1"
                >
                  <Mic className="w-3 h-3" />
                  <span>Simulate Voice Note</span>
                </button>
              </div>

              {/* Enter client simulator input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type simulated message text on behalf of the customer..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && executeWhatsAppSend(chatMessage)}
                  className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-4 py-2 text-xs focus:outline-hidden text-stone-100"
                  id="chat-simulator-input"
                />
                <button
                  onClick={() => executeWhatsAppSend(chatMessage)}
                  disabled={sendingWhatsApp || !chatMessage.trim()}
                  className="bg-amber-500 hover:bg-amber-600 disabled:bg-stone-800 text-stone-950 px-4 py-2 rounded-xl text-xs font-bold font-serif transition flex items-center gap-1 cursor-pointer"
                  id="btn-chat-send"
                >
                  <span>{sendingWhatsApp ? "AI Thinking..." : "Send"}</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Meta/Facebook WhatsApp Developer Sandbox Guide */}
          <div className="col-span-12 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-6 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm">
                    Meta Sandbox Configuration: Recipient Phone Number Allowed List Setup
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">Resolve OAuthException 400 Sandbox delivery restrictions in 5 minutes</p>
                </div>
              </div>
              <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg">
                Recommended Developer Prerequisite
              </span>
            </div>

            <div className="text-xs text-stone-600 dark:text-zinc-300 space-y-3 leading-relaxed">
              <p>
                Meta's WhatsApp Cloud API operates in a strict <strong className="text-stone-800 dark:text-zinc-100">Sandbox Test Mode</strong> initially. To send simulated or real outbound automated messages to customers, you must explicitly register and verify those target numbers on your Facebook Developer dashboard.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-stone-200/70 dark:border-zinc-800 space-y-2">
                  <span className="bg-stone-100 dark:bg-zinc-805 text-stone-700 dark:text-zinc-300 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded">STEP 1</span>
                  <strong className="block text-stone-800 dark:text-zinc-200 font-serif text-[12px]">Access Settings Portal</strong>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                    Log in to the <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">Meta Developer Dashboard</a>, choose your App, and navigate to <strong className="dark:text-zinc-100">WhatsApp</strong> &gt; <strong className="dark:text-zinc-100">API Setup</strong> or <strong className="dark:text-zinc-100">Getting Started</strong> on the left side-rail.
                  </p>
                </div>

                <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-stone-200/70 dark:border-zinc-800 space-y-2">
                  <span className="bg-stone-100 dark:bg-zinc-805 text-stone-700 dark:text-zinc-300 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded">STEP 2</span>
                  <strong className="block text-stone-800 dark:text-zinc-200 font-serif text-[12px]">Add Recipient List</strong>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                    Scroll down to the <strong className="dark:text-zinc-100">"To"</strong> drop-down menu situated under the "Send and receive messages" panel. Select and click <strong className="dark:text-zinc-100">"Manage phone number list"</strong>.
                  </p>
                </div>

                <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-stone-200/70 dark:border-zinc-800 space-y-2">
                  <span className="bg-stone-100 dark:bg-zinc-805 text-stone-700 dark:text-zinc-300 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded">STEP 3</span>
                  <strong className="block text-stone-800 dark:text-zinc-200 font-serif text-[12px]">Validate via Outbound OTP</strong>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                    Enter your recipient mobile number including country code (e.g., <code className="bg-stone-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono text-[10px] text-stone-850 dark:text-zinc-250 font-semibold">+919XXXXXXXXX</code>) and receive a test verification OTP code on that WhatsApp client.
                  </p>
                </div>

                <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-stone-200/70 dark:border-zinc-800 space-y-2">
                  <span className="bg-stone-100 dark:bg-zinc-850 text-stone-700 dark:text-zinc-300 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded">STEP 4</span>
                  <strong className="block text-stone-800 dark:text-zinc-200 font-serif text-[12px]">Unlock Real Transmission</strong>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                    Input the OTP code onto the popup modal. The verified target is immediately whitelisted in sandbox, eliminating any further <code className="text-rose-500 select-all font-mono font-bold">131030 / OAuthException (400)</code> delivery failures.
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/60 p-4 rounded-xl flex gap-3 mt-4">
                <CheckCircle className="w-4.5 h-4.5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <div className="text-[11px] text-stone-600 dark:text-zinc-400 space-y-1">
                  <strong className="block text-stone-800 dark:text-zinc-200">Sandbox Limitation Awareness</strong>
                  <p>
                    Up to 5 unique recipient phone numbers can be whitelisted per developer sandbox. To broadcast to any random customer, you must migrate your account from Sandbox to the Live production tier by adding a Business payment setup in Meta Console.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub Tab Panel: Interactive Call Simulator */}
      {subTab === "simulator-call" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="call-sim-panel">
          {/* Quick instructions and call logs */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-stone-200 dark:border-zinc-800 lg:col-span-4 space-y-4 transition-colors">
            <div>
              <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm">Interactive Dial Simulator</h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">
                Call simulation emulates a live telephone line. Initiate a virtual call, type phrases to mimic the customer, and use browser SpeechSynthesis to vocalize the AI’s real responses.
              </p>
            </div>

            {/* Simulated telephone panel box mockup */}
            <div className="bg-stone-50 dark:bg-zinc-950/40 p-4 rounded-xl border border-stone-200 dark:border-zinc-800 text-center space-y-3 transition-colors">
              <span className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-zinc-500 font-bold">Patron Phone Terminal</span>
              <div className="space-y-1">
                <strong className="block text-stone-800 text-sm font-serif">
                  {customers.find(c => c.phone === selectedPhone)?.name || "Select Customer First"}
                </strong>
                <span className="font-mono text-stone-500 text-xs text-xs">+{selectedPhone}</span>
              </div>

              {!callActive ? (
                <button
                  onClick={handleCallInitiation}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/10"
                  id="btn-initiate-call"
                >
                  <Phone className="w-4 h-4 fill-white" />
                  <span>Connect Vedic Call Link</span>
                </button>
              ) : (
                <button
                  onClick={handleCallWrapup}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer animate-pulse shrink-0"
                  id="btn-end-call"
                >
                  <Phone className="w-4 h-4 rotate-135 fill-white" />
                  <span>Hang Up (Disconnect)</span>
                </button>
              )}
            </div>

            {/* Keyword Tracking Ledger */}
            <div className="p-3.5 bg-amber-50/45 rounded-xl border border-amber-100 text-[11px] text-stone-600 space-y-2">
              <span className="font-bold text-[9px] text-amber-800 uppercase tracking-widest block">Interactive Intent Check</span>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span>Size volume identified?</span>
                  <span className={`px-2 py-0.2 rounded text-[9px] font-bold ${matchingTracker.size ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-400"}`}>
                    {matchingTracker.size ? "DETECTED" : "AWAITING"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Exact qty identified?</span>
                  <span className={`px-2 py-0.2 rounded text-[9px] font-bold ${matchingTracker.quantity ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-400"}`}>
                    {matchingTracker.quantity ? "DETECTED" : "AWAITING"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Address identified?</span>
                  <span className={`px-2 py-0.2 rounded text-[9px] font-bold ${matchingTracker.address ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-400"}`}>
                    {matchingTracker.address ? "DETECTED" : "AWAITING"}
                  </span>
                </div>
                <hr className="border-amber-100 my-1" />
                <div className="flex justify-between items-center font-bold">
                  <span>Automated Database Order Booked?</span>
                  <span className={`px-2 py-0.2 rounded text-[9px] ${matchingTracker.orderBooked ? "bg-emerald-500 text-white" : "bg-stone-100 text-stone-400"}`}>
                    {matchingTracker.orderBooked ? "CONVERTED" : "PENDING"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Call screen overlay/transcript simulator */}
          <div className="bg-stone-900 border border-stone-850 rounded-2xl lg:col-span-8 flex flex-col h-[450px]">
            {/* Header */}
            <div className="bg-stone-950 p-4 border-b border-stone-850 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${callActive ? "bg-emerald-500 animate-ping" : "bg-stone-600"}`} />
                <span className="text-white text-xs font-serif font-bold">
                  {callActive ? `TELEPHONE CHANNEL ACTIVE (Timer: ${Math.floor(callTimer / 60)}:${String(callTimer % 60).padStart(2, '0')})` : "LINE IDLE"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <Mic className="w-3.5 h-3.5 text-stone-500" />
                <span>Operator Speech Simulator</span>
              </div>
            </div>

            {/* Stream Transcript */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 scrollbar-none">
              {callTranscript.map((line, idx) => {
                const isCustomer = line.speaker === "customer";
                return (
                  <div key={idx} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[80%] rounded-xl p-3 text-xs flex gap-3 ${
                      isCustomer 
                        ? "bg-stone-800 border border-stone-700 text-stone-100" 
                        : "bg-stone-850 border border-amber-900/40 text-stone-200"
                    }`}>
                      <Volume2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-[9px] uppercase tracking-wider text-amber-500 font-mono">
                          {isCustomer ? "Customer Speaks" : "AI Ghee Agent"}
                        </strong>
                        <p className="mt-0.5 leading-relaxed">{line.text}</p>
                        <span className="block text-[8px] text-stone-500 text-right mt-1 font-mono">{line.time}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!callActive && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-500 select-none">
                  <Phone className="w-10 h-10 text-stone-700 mb-2" />
                  <p className="font-serif italic text-xs">Awaiting dial trigger from left control deck.</p>
                </div>
              )}
            </div>

            {/* Operational Speech Actions */}
            {callActive && (
              <div className="bg-stone-950 p-4 border-t border-stone-850 space-y-3 shrink-0">
                {/* Phrases helpers */}
                <div className="flex flex-wrap gap-1.5 pb-1">
                  <span className="text-[9px] text-stone-500 self-center font-mono">Quotes:</span>
                  <button
                    onClick={() => setSpeakingPhrase("Kem cho? Ghee ketla nu chhe?")}
                    className="bg-stone-800 hover:bg-stone-700 text-stone-300 px-2.5 py-1 rounded text-[10px]"
                  >
                    "Kem cho? Prising ketlu chhe?"
                  </button>
                  <button
                    onClick={() => setSpeakingPhrase("Mane ek-litre moko, Vadodara address par.")}
                    className="bg-stone-800 hover:bg-stone-700 text-stone-300 px-2.5 py-1 rounded text-[10px]"
                  >
                    "Send me 1L to Vadodara!"
                  </button>
                  <button
                    onClick={() => setSpeakingPhrase("Bilona ghee to organic chhe ne? badhi details apo.")}
                    className="bg-stone-800 hover:bg-stone-700 text-stone-300 px-2.5 py-1 rounded text-[10px]"
                  >
                    "Is it pure organic Ghee?"
                  </button>
                </div>

                {/* Submit simulated speech block */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={speakingPhrase}
                    onChange={(e) => setSpeakingPhrase(e.target.value)}
                    placeholder="Enter what the customer says (English / Gujarati / Gujlish)..."
                    className="flex-1 bg-stone-900 border border-stone-800 text-stone-100 rounded-xl px-4 py-2 text-xs focus:outline-hidden"
                  />
                  <button
                    onClick={() => handleCustomerSpeaking(speakingPhrase)}
                    disabled={loadingPhrase || !speakingPhrase}
                    className="bg-amber-500 hover:bg-amber-600 disabled:bg-stone-800 text-stone-950 px-4 py-2 rounded-xl text-xs font-bold font-serif transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>{loadingPhrase ? "Agent Listening..." : "Customer Speaks"}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub Tab Panel: System Prompt Studio */}
      {subTab === "prompt" && (
        <div className="space-y-6">
          <form onSubmit={handleUpdatePrompts} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs space-y-5 transition-colors" id="form-prompt-studio">
            <div>
              <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm">System Prompts & Trilingual Dictionary</h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400">Fine-tune translation patterns, objection protocols, or Vedic core definitions</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-stone-400 block mb-1.5">WhatsApp Chat Assistant Instructions (System Rules)</label>
                <textarea
                  value={waPrompt}
                  onChange={(e) => setWaPrompt(e.target.value)}
                  rows={4}
                  required
                  className="w-full text-xs font-mono border border-stone-205 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-stone-400 block mb-1.5">Interactive Call Script System Rules</label>
                <textarea
                  value={callPrompt}
                  onChange={(e) => setCallPrompt(e.target.value)}
                  rows={4}
                  required
                  className="w-full text-xs font-mono border border-stone-205 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-stone-400 block mb-1.5">Objection & Bilona Ghee FAQ playbook</label>
                <textarea
                  value={objectionPlaybook}
                  onChange={(e) => setObjectionPlaybook(e.target.value)}
                  rows={4}
                  required
                  className="w-full text-xs font-mono border border-stone-205 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingPrompts}
              className="bg-amber-500 hover:bg-amber-600 border border-amber-500 text-stone-950 px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:bg-stone-200"
              id="btn-save-prompts"
            >
              <Sliders className="w-4 h-4" />
              <span>{isSavingPrompts ? "Saving to Database..." : "Commit Playbooks"}</span>
            </button>
          </form>

          {/* SQLite Database Migration Portal */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs space-y-4 transition-colors" id="sqlite-migration-settings-card">
            <div className="flex gap-2.5 items-center">
              <Database className="w-5 h-5 text-amber-500" />
              <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm">SQLite Relational Engine Migration</h3>
            </div>
            
            <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">
              If you have legacy files containing Orders, Customers, and operational Logs, you can safely trigger a one-time migration to transfer all of them from the file-based <code className="bg-stone-50 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono text-[10px]">db.json</code> structure directly into the high-performance SQLite database context.
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleRunSqlMigration}
                disabled={migrationStatus === "migrating"}
                className="bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-stone-950 dark:text-stone-100 font-bold py-2.5 px-5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-stone-200 dark:disabled:bg-zinc-800 border-none"
                id="btn-sqlite-migration-settings"
              >
                <RotateCcw className={`w-4 h-4 ${migrationStatus === "migrating" ? "animate-spin" : ""}`} />
                <span>{migrationStatus === "migrating" ? "Commencing Relational Migration..." : "Migrate db.json to SQLite Database"}</span>
              </button>
            </div>

            {migrationStatus === "success" && migrationResult && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/40 p-4 rounded-xl space-y-2">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 block">✓ Relational Data Sync Successful!</span>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  Source parsed and written to <code className="bg-emerald-100/50 dark:bg-emerald-950 px-1.5 py-0.5 rounded font-mono text-[10px]">db.sqlite</code> database successfully. Zero data loss achieved.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-[10px] text-stone-605 dark:text-zinc-400 pt-2.5 border-t border-emerald-200/30 dark:border-emerald-900/10">
                  <div>Customers: <strong className="text-stone-800 dark:text-zinc-300">{migrationResult.migratedCounts?.customers ?? 0}</strong></div>
                  <div>Orders: <strong className="text-stone-800 dark:text-zinc-300">{migrationResult.migratedCounts?.orders ?? 0}</strong></div>
                  <div>Call Logs: <strong className="text-stone-800 dark:text-zinc-300">{migrationResult.migratedCounts?.callLogs ?? 0}</strong></div>
                  <div>Webhooks: <strong className="text-stone-800 dark:text-zinc-300">{migrationResult.migratedCounts?.webhookLogs ?? 0}</strong></div>
                </div>
              </div>
            )}

            {migrationStatus === "error" && (
              <div className="bg-red-50 dark:bg-rose-950/20 border border-red-200 dark:border-rose-900/40 p-4 rounded-xl flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="text-xs text-red-800 dark:text-rose-300">
                  <strong className="font-bold">Migration Failed</strong>
                  <p className="mt-1 leading-normal">{migrationError}</p>
                </div>
              </div>
            )}
          </div>

          {/* MongoDB Atlas Portal Card */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs space-y-4 transition-colors animate-fade-in" id="mongo-atlas-replication-card">
            <div className="flex gap-2.5 items-center justify-between flex-wrap gap-y-3">
              <div className="flex gap-2.5 items-center">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                  <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-sm">MongoDB Atlas Cloud Replication</h3>
                  <p className="text-[10px] text-stone-400 dark:text-zinc-500 font-mono">Continuous Sync Mirror Engine</p>
                </div>
              </div>
              <div className="flex items-center">
                {mongoEnabled ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    CONNECTED & ACTIVE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-150 text-amber-800 dark:bg-amber-955/20 dark:text-amber-450 border border-amber-200/40 dark:border-amber-900/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    LOCAL PERSISTENCE ONLY
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">
              {mongoEnabled ? (
                <span>Your sales system is actively mirrored in the cloud! Every write or deletion made to Products, Customers, Orders, Conversations, and Call Logs is pushed asynchronously to your remote <strong>MongoDB Atlas Cluster</strong>. Local page hits load instantly from lightning-fast cached SQLite tables.</span>
              ) : (
                <span>Your sales backend database is executing locally. To hook up real-time cloud storage and continuous backup with your <strong>MongoDB Atlas Cluster</strong>, locate the settings menu in your AI Studio dashboard and define the <code className="bg-stone-50 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono text-[10px]">MONGODB_URI</code> environment variable.</span>
              )}
            </p>

            <div className="pt-1 flex flex-wrap gap-3 items-center">
              <button
                type="button"
                onClick={handleMongoSync}
                disabled={mongoStatus === "syncing" || !mongoEnabled}
                className={`font-semibold py-2 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  mongoEnabled 
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-700 dark:hover:bg-emerald-800 border-none" 
                    : "bg-stone-100 text-stone-400 dark:bg-zinc-800 dark:text-zinc-500 border border-stone-205 dark:border-zinc-700"
                }`}
                id="btn-mongo-sync-trigger"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${mongoStatus === "syncing" ? "animate-spin" : ""}`} />
                <span>{mongoStatus === "syncing" ? "Syncing cluster state..." : "Trigger Cloud Connection Sync"}</span>
              </button>
            </div>

            {mongoStatus === "success" && mongoMsg && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-4 rounded-xl space-y-2 animate-fade-in">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 block flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Replication Sync Complete!
                </span>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  {mongoMsg}
                </p>
              </div>
            )}

            {mongoStatus === "error" && mongoMsg && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-4 rounded-xl flex gap-3 animate-fade-in">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="text-xs text-red-800 dark:text-rose-300">
                  <span className="font-bold block">Sync Attempt Failed</span>
                  <p className="mt-1 leading-normal">{mongoMsg}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub Tab Panel: Quick replies */}
      {subTab === "replies" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="quick-replies-management">
          {/* Form to add quick response */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-stone-200 dark:border-zinc-800 lg:col-span-5 transition-colors">
            <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-xs uppercase tracking-wider mb-4">Register Quick canned message</h3>
            <form onSubmit={handleCreateReply} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wide block mb-1">Shortcut Headline *</label>
                <input
                  type="text"
                  placeholder="e.g. Traditional Price"
                  required
                  value={newReplyTitle}
                  onChange={(e) => setNewReplyTitle(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wide block mb-1">Slash Keyboard Trigger Shortcut *</label>
                <input
                  type="text"
                  placeholder="e.g. /price"
                  required
                  value={newReplyShortcut}
                  onChange={(e) => setNewReplyShortcut(e.target.value)}
                  className="w-full text-xs font-mono border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wide block mb-1">Full Replacements Text *</label>
                <textarea
                  placeholder="e.g. Standard rate is ₹2100/- for 1L glass jar..."
                  rows={4}
                  required
                  value={newReplyText}
                  onChange={(e) => setNewReplyText(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-amber-500"
                ></textarea>
              </div>

              <button
                type="submit"
                className="bg-stone-900 hover:bg-stone-800 text-white font-serif font-bold w-full py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Save replies shortcut
              </button>
            </form>
          </div>

          {/* Quick reply shortcuts listings */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-stone-200 dark:border-zinc-800 lg:col-span-7 flex flex-col space-y-3 transition-colors">
            <h3 className="font-serif font-bold text-stone-900 dark:text-zinc-100 text-xs uppercase tracking-wider">Canned Shortcuts Catalogue</h3>
            <div className="space-y-3 overflow-y-auto max-h-[350px] text-xs">
              {quickReplies && quickReplies.map(item => (
                <div key={item.id} className="p-3.5 bg-stone-50 dark:bg-zinc-950/40 border border-stone-205 dark:border-zinc-800 rounded-xl flex justify-between items-start gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <strong className="font-serif text-stone-900 dark:text-zinc-100 text-[13px]">{item.title}</strong>
                      <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-350 border border-amber-200 dark:border-amber-900/30 font-mono text-[9px] font-bold px-1.5 rounded">
                        {item.shortcut}
                      </span>
                    </div>
                    <p className="text-stone-500 dark:text-zinc-400 leading-relaxed text-[11px]">{item.text}</p>
                  </div>
                  <button
                    onClick={() => onDeleteQuickReply(item.id)}
                    className="text-stone-400 hover:text-rose-600 p-1 rounded-md hover:bg-white transition"
                    title="Remove canned shortcut"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(!quickReplies || quickReplies.length === 0) && (
                <div className="text-center py-10 text-stone-400 font-serif italic text-xs">
                  No canned repliers configured. Save one on the left.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
