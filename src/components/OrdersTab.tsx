import React, { useState } from "react";
import { 
  Plus, 
  Search, 
  Download, 
  Truck, 
  X, 
  Package, 
  Box, 
  Coins, 
  MapPin, 
  CheckCircle, 
  AlertCircle, 
  Calendar,
  AlertTriangle,
  Printer
} from "lucide-react";
import { Order, Product, Customer } from "../types";
import { useLanguage } from "../context/LanguageContext";

interface OrdersTabProps {
  orders: Order[];
  products: Product[];
  customers: Customer[];
  onCreateManualOrder: (args: {
    customerPhone: string;
    customerName: string;
    productName: string;
    size: string;
    quantity: number;
    amount: number;
    address: string;
  }) => Promise<void>;
  onUpdateOrderStatus: (orderId: string, paymentStatus?: string, shippingStatus?: string) => Promise<void>;
  searchQuery?: string;
  onSearchQueryChange?: (val: string) => void;
}

export default function OrdersTab({
  orders,
  products,
  customers,
  onCreateManualOrder,
  onUpdateOrderStatus,
  searchQuery: propSearchQuery,
  onSearchQueryChange
}: OrdersTabProps) {
  const { t } = useLanguage();
  // Filters & State
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : localSearchQuery;
  const setSearchQuery = onSearchQueryChange !== undefined ? onSearchQueryChange : setLocalSearchQuery;
  const [paymentFilter, setPaymentFilter] = useState<"all" | "Paid" | "Pending" | "Failed" | "Cancelled">("all");
  const [shippingFilter, setShippingFilter] = useState<"all" | "Processing" | "Shipped" | "Delivered" | "Returned" | "Cancelled">("all");
  const [selectedTimelineOrder, setSelectedTimelineOrder] = useState<Order | null>(null);
  const [selectedLabelOrder, setSelectedLabelOrder] = useState<Order | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Predefined default thresholds block for specific Ghee sizes
  const [thresholds, setThresholds] = useState<Record<string, number>>({
    "500ml": 15,
    "1L": 20,
    "5L": 5,
    "2 x 1L": 8
  });
  // Toggle for thresholds editor controller configuration
  const [showThresholdConfig, setShowThresholdConfig] = useState(false);

  // Identify products with stock below threshold
  const lowStockProducts = products.filter(p => {
    const size = p.size || "1L";
    const threshold = thresholds[size] !== undefined ? thresholds[size] : 10;
    return p.stock < threshold;
  });

  const handleModifyStatus = async (orderId: string, paymentVal?: string, shippingVal?: string) => {
    setUpdatingOrderId(orderId);
    try {
      await onUpdateOrderStatus(orderId, paymentVal, shippingVal);
    } catch (err) {
      console.error("Error updating order status:", err);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Helper with highlight tracking for clean dashboard match highlights
  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return (
      <span className="inline-block">
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} className="bg-amber-100 text-stone-900 font-semibold px-0.5 rounded-sm">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };
  
  // Manual adding order form state
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newSize, setNewSize] = useState("1L");
  const [newQty, setNewQty] = useState(1);
  const [newAddress, setNewAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Product helper to compute price automatically
  const availableProduct = products[0] || { price: 2100, name: "Gir Cow A2 Desi Bilona Ghee" };
  const getCalculatedPrice = (size: string) => {
    switch (size) {
      case "500ml": return 1100;
      case "5L": return 10000;
      case "1L":
      default: return 2100;
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone || !newName || !newAddress) {
      alert("Please check all mandatory fields");
      return;
    }
    setIsSubmitting(true);
    try {
      const pricePerUnit = getCalculatedPrice(newSize);
      const calculatedAmount = pricePerUnit * newQty;
      await onCreateManualOrder({
        customerPhone: newPhone.replace(/\D/g, ""),
        customerName: newName,
        productName: "Authentic A2 Gir Bilona Ghee",
        size: newSize,
        quantity: newQty,
        amount: calculatedAmount,
        address: newAddress
      });
      // reset form
      setNewPhone("");
      setNewName("");
      setNewSize("1L");
      setNewQty(1);
      setNewAddress("");
      setIsAddingOrder(false);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered orders listing
  const filteredOrders = orders.filter(o => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      o.customerName.toLowerCase().includes(searchLower) ||
      o.customerPhone.includes(searchQuery) ||
      o.orderId.toLowerCase().includes(searchLower) ||
      (o.address && o.address.toLowerCase().includes(searchLower)) ||
      (o.size && o.size.toLowerCase().includes(searchLower)) ||
      (o.productName && o.productName.toLowerCase().includes(searchLower)) ||
      (o.paymentStatus && o.paymentStatus.toLowerCase().includes(searchLower)) ||
      (o.shippingStatus && o.shippingStatus.toLowerCase().includes(searchLower)) ||
      (o.amount && String(o.amount).includes(searchQuery)) ||
      (o.quantity && String(o.quantity).includes(searchQuery)) ||
      (o.createdAt && new Date(o.createdAt).toLocaleDateString().includes(searchLower));
    
    const matchesPayment = paymentFilter === "all" || o.paymentStatus === paymentFilter;
    const matchesShipping = shippingFilter === "all" || o.shippingStatus === shippingFilter;
    
    return matchesSearch && matchesPayment && matchesShipping;
  });

  // Calculate shipment offset times (Vedic Timeline simulation)
  const renderShipmentTimeline = (o: Order) => {
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
          ? `Ledger clearance checked. ₹${o.amount} securely credited via Razorpay.`
          : "Financial settlement pending customer payment activation trigger.",
        isCompleted: o.paymentStatus === "Paid",
        time: o.paymentStatus === "Paid" ? formatOffsetDate(0.2) : "Pending Gateway Verification",
        icon: <Coins className="w-4 h-4" />
      },
      {
        id: "processing",
        title: "Traditional Bilona Heating & Packed in Glass",
        desc: "Batch filtered, placed into sterile visual protection glass jars and wrapped in wood shavings.",
        isCompleted: o.shippingStatus === "Shipped" || o.shippingStatus === "Delivered",
        isActive: o.shippingStatus === "Processing" && o.paymentStatus === "Paid",
        time: (o.shippingStatus === "Shipped" || o.shippingStatus === "Delivered") ? formatOffsetDate(4) : "In Batch Selection Queue",
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
        time: (o.shippingStatus === "Shipped" || o.shippingStatus === "Delivered" || o.shippingStatus === "Returned") ? formatOffsetDate(18) : "Pending Courier Pickup",
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
          ? "Delivered directly to designated patron address. Pure ghee hand-delivered with care."
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
                <Truck className="w-5 h-5 text-amber-500" />
                <span>Shipment Tracking Ledger</span>
              </h3>
              <p className="text-[10px] text-stone-400 mt-0.5">Order Ref: {o.orderId}</p>
            </div>
            <button
              onClick={() => setSelectedTimelineOrder(null)}
              className="text-stone-400 hover:text-stone-100 p-1.5 rounded-lg hover:bg-stone-800 transition"
              id="btn-close-tracking-modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-5 scrollbar-none">
            {/* Meta Summary Block */}
            <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 grid grid-cols-2 gap-3 text-[11px] text-stone-600">
              <div>
                <span className="block font-semibold uppercase tracking-wider text-[9px] text-stone-400">Patron</span>
                <strong className="text-stone-900 block mt-0.5">{o.customerName}</strong>
                <span className="text-[10px] font-mono block mt-0.5">+{o.customerPhone}</span>
              </div>
              <div>
                <span className="block font-semibold uppercase tracking-wider text-[9px] text-stone-400">Ghee Jar Details</span>
                <strong className="text-stone-900 block mt-0.5">{o.productName}</strong>
                <span className="text-[10px] font-semibold text-amber-800 block mt-0.5">{o.size} jar x {o.quantity} qty</span>
              </div>
            </div>

            {/* Simulated Live status actions */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest block mb-1.5">Interactive Operations Control</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] block text-stone-500 font-semibold uppercase">Finance Status</label>
                  <select 
                    value={o.paymentStatus}
                    onChange={(e) => onUpdateOrderStatus(o.orderId, e.target.value as any, undefined)}
                    className="w-full text-xs mt-1 bg-white border border-stone-200 rounded px-1.5 py-1"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Failed">Failed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] block text-stone-500 font-semibold uppercase">Transit Status</label>
                  <select 
                    value={o.shippingStatus}
                    onChange={(e) => onUpdateOrderStatus(o.orderId, undefined, e.target.value as any)}
                    className="w-full text-xs mt-1 bg-white border border-stone-200 rounded px-1.5 py-1"
                  >
                    <option value="Processing">Processing</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Returned">Returned</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Timeline vertical stack */}
            <div className="relative pl-6 space-y-6 py-2 border-l border-stone-200 ml-3">
              {steps.map((step) => {
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
                        <CheckCircle className="w-3.5 h-3.5 text-white" />
                      ) : (
                        step.icon
                      )}
                    </div>

                    {/* Timeline Details */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className={`text-xs ${titleStyle}`}>{step.title}</h4>
                        <span className="text-[9px] font-mono text-stone-400 select-none whitespace-nowrap shrink-0">
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
            <span className="text-[9px] text-stone-400 flex items-center gap-1 font-mono">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></div>
              <span>Satcom Link Synchronized</span>
            </span>
            <button
              onClick={() => setSelectedTimelineOrder(null)}
              className="bg-stone-900 hover:bg-stone-800 text-stone-100 font-bold px-4 py-1.5 text-xs rounded-lg cursor-pointer transition"
            >
              Close Ledger
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Print Shipping Label through a silent hidden iframe to ensure seamless printing inside sandboxed iframes
  const printViaIframe = (o: Order) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    const content = `
      <html>
        <head>
          <title>Shipping Label - ${o.orderId}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              padding: 10px;
              margin: 0;
              color: #000;
              background: #fff;
            }
            .label-container {
              border: 3px solid #000;
              padding: 15px;
              max-width: 400px;
              margin: 0 auto;
              box-sizing: border-box;
            }
            .header {
              text-align: center;
              border-bottom: 3px double #000;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .header h2 {
              margin: 0;
              font-family: Georgia, serif;
              font-size: 20px;
              letter-spacing: 1px;
              text-transform: uppercase;
              font-weight: bold;
            }
            .section {
              border-bottom: 1px solid #000;
              padding-bottom: 10px;
              margin-bottom: 10px;
            }
            .section-title {
              font-family: monospace;
              font-size: 10px;
              font-weight: bold;
              text-transform: uppercase;
              color: #444;
              margin-bottom: 3px;
            }
            .address {
              font-size: 13px;
              line-height: 1.35;
              font-weight: bold;
            }
            .row {
              display: flex;
              justify-content: space-between;
            }
            .barcode-container {
              text-align: center;
              margin-top: 15px;
              padding-top: 10px;
              border-top: 2px dashed #000;
            }
            .barcode-visual {
              height: 50px;
              background-image: repeating-linear-gradient(90deg, #000, #000 2px, transparent 2px, transparent 5px);
              width: 85%;
              margin: 0 auto;
            }
            .order-ref {
              font-family: monospace;
              font-size: 11px;
              font-weight: bold;
              letter-spacing: 2px;
              margin-top: 5px;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="label-container">
            <div class="header">
              <h2>DESI GHEE</h2>
              <div style="font-family: monospace; font-size: 9px; margin-top: 2px; letter-spacing: 1px;">PURE VEDIC BILONA A2 GHEE</div>
            </div>
            <div class="section">
              <div class="section-title">SENDER (FROM):</div>
              <div class="address" style="font-weight: normal; font-size: 11px;">
                Desi Ghee (Daksha Ahir)<br/>
                Pure Vedic Dairy Farms, India<br/>
                Support: Registered Business Line
              </div>
            </div>
            <div class="section">
              <div class="section-title">SHIP TO (TO):</div>
              <div class="address">
                ${o.customerName.toUpperCase()}<br/>
                Phone: +${o.customerPhone}<br/>
                Address:<br/>
                ${o.address}
              </div>
            </div>
            <div class="section">
              <div class="row">
                <div>
                  <div class="section-title">ITEM DETAILS:</div>
                  <div style="font-size: 12px; font-weight: bold;">A2 Gir Cow Desi Ghee (${o.size})</div>
                </div>
                <div style="text-align: right;">
                  <div class="section-title">QTY:</div>
                  <div style="font-size: 14px; font-weight: bold;">x${o.quantity}</div>
                </div>
              </div>
            </div>
            <div class="section" style="border-bottom: none; margin-bottom: 0; padding-bottom: 0;">
              <div class="row" style="font-family: monospace; font-size: 10px;">
                <div>DATE: ${new Date(o.createdAt).toLocaleDateString()}</div>
                <div>WT: ${o.size === "1L" ? "1.0 kg" : o.size === "500ml" ? "0.5 kg" : "2.0 kg"}</div>
              </div>
            </div>
            <div class="barcode-container">
              <div class="barcode-visual"></div>
              <div class="order-ref">${o.orderId}</div>
            </div>
          </div>
        </body>
      </html>
    `;

    doc.open();
    doc.write(content);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
         try {
           document.body.removeChild(iframe);
         } catch (e) {
           console.error("Iframe removal skipped or already finished: ", e);
         }
      }, 1000);
    }, 250);
  };

  const renderShippingLabelModal = (o: Order) => {
    return (
      <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="modal-shipping-label">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-stone-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="bg-stone-950 text-stone-100 px-5 py-4 flex justify-between items-center shrink-0">
            <div>
              <h3 className="font-serif font-bold text-amber-100 text-sm flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-500" />
                <span>{t("orders.printLabel")}</span>
              </h3>
              <p className="text-[10px] text-stone-400 mt-0.5">Physical dispatch helper</p>
            </div>
            <button
              onClick={() => setSelectedLabelOrder(null)}
              className="text-stone-400 hover:text-stone-100 p-1.5 rounded-lg hover:bg-stone-800 transition cursor-pointer"
              id="btn-close-label-modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal content: The Thermal Label Preview */}
          <div className="p-6 bg-stone-100 dark:bg-zinc-950 overflow-y-auto flex-1 flex flex-col items-center justify-center">
            {/* Visual thermal sticker replica */}
            <div className="w-full bg-white border-[3px] border-stone-900 p-4 shadow-sm font-mono text-[11px] text-stone-900 rounded-xs select-none max-w-[320px]">
              <div className="text-center font-bold text-sm border-b-2 border-double border-stone-900 pb-2 mb-3">
                DESI GHEE (Daksha Ahir)
                <div className="text-[9px] font-normal tracking-wide mt-0.5 spelling-none">VEDIC BILONA CHURNED</div>
              </div>
              
              <div className="border-b border-stone-900 pb-2 mb-2">
                <span className="text-[9px] block text-stone-400 font-bold uppercase">SENDER (FROM)</span>
                <span className="font-semibold block text-[10px]">Desi Ghee (Daksha Ahir)</span>
                <span className="text-[10px] block">Pure Vedic Dairy Farms, India</span>
              </div>

              <div className="border-b border-stone-900 pb-2 mb-2">
                <span className="text-[9px] block text-stone-400 font-bold uppercase">SHIP TO (TO)</span>
                <span className="font-bold block text-xs underline decoration-stone-900">{o.customerName.toUpperCase()}</span>
                <span className="font-bold block">Phone: +{o.customerPhone}</span>
                <span className="block mt-1 font-medium bg-stone-50 p-1 border border-stone-200 rounded-sm leading-snug whitespace-pre-wrap">{o.address}</span>
              </div>

              <div className="border-b border-stone-900 pb-2 mb-2 flex justify-between">
                <div>
                  <span className="text-[9px] block text-stone-400 font-bold uppercase">PRODUCT DETAILS</span>
                  <span className="font-bold text-[10px]">A2 Gir Cow Ghee ({o.size})</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] block text-stone-400 font-bold uppercase">QTY</span>
                  <span className="font-bold text-lg">x{o.quantity}</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[9px] text-stone-400 font-bold pb-2">
                <span>DATE: {new Date(o.createdAt).toLocaleDateString()}</span>
                <span>WT: {o.size === "1L" ? "1.0 kg" : o.size === "500ml" ? "0.5 kg" : "2.0 kg"}</span>
              </div>

              {/* Barcode representation */}
              <div className="border-t-2 border-dashed border-stone-900 pt-3 text-center">
                <div className="h-10 w-full mb-1 flex items-center justify-center">
                  <div className="h-full w-[85%] bg-stone-900" style={{
                    backgroundImage: 'repeating-linear-gradient(90deg, #000, #000 2px, transparent 2px, transparent 6px)',
                    backgroundSize: '100% 100%'
                  }}></div>
                </div>
                <span className="text-[10px] font-bold tracking-widest">{o.orderId}</span>
              </div>
            </div>
            
            <p className="text-[10px] text-stone-500 dark:text-zinc-400 text-center mt-3 max-w-[280px]">
              Ready for high-quality thermal label sticker generation. Align with any label or laser desktop printer.
            </p>
          </div>

          {/* Footer buttons */}
          <div className="px-5 py-3.5 bg-stone-50 dark:bg-zinc-900/60 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
            <button
              onClick={() => setSelectedLabelOrder(null)}
              className="px-3 py-1.5 border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-zinc-300 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 font-medium text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => printViaIframe(o)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-1.5 text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition hover:shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t("orders.printLabelShort")}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Plain Text Invoice Export trigger (replaces jsPDF fallback dependency issues)
  const extractReceiptText = (o: Order) => {
    const textData = `
--------------------------------------------------
       SUPR GHEE BILLING & DISPATCH INVOICE       
--------------------------------------------------
Order Reference ID: ${o.orderId}
Timestamp: ${new Date(o.createdAt).toLocaleString()}
Customer Phone: +${o.customerPhone}
Customer Name: ${o.customerName}
--------------------------------------------------
Product: Authentic A2 Gir Bilona Desi Ghee
Container Volume: ${o.size} Jar
Quantity: ${o.quantity} unit(s)
Total Settlement Amount: INR ${o.amount}
--------------------------------------------------
Payment status: ${o.paymentStatus.toUpperCase()}
Shipping status: ${o.shippingStatus.toUpperCase()}
Delivery Address:
${o.address}
--------------------------------------------------
Thank you for supporting pure traditional dairy.
      Supr Ghee Operational System (Vedic OS)     
--------------------------------------------------
`;
    const element = document.createElement("a");
    const file = new Blob([textData], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `Invoice-${o.orderId}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="font-serif font-bold text-stone-900 text-lg">{t("orders.title")}</h2>
          <p className="text-xs text-stone-500">{t("orders.desc")}</p>
        </div>
        <button
          onClick={() => setIsAddingOrder(true)}
          className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition ml-auto"
          id="btn-add-manual-order"
        >
          <Plus className="w-4 h-4" />
          <span>{t("orders.manualBooking")}</span>
        </button>
      </div>

      {/* Automated Stock Level Alert Panel */}
      <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3" id="automated-stock-alert-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${lowStockProducts.length > 0 ? "bg-rose-105 text-rose-700 animate-pulse" : "bg-emerald-100 text-emerald-700"}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-stone-900 text-xs flex items-center gap-2">
                <span>Automated Stock Security Sentinel</span>
                {lowStockProducts.length > 0 ? (
                  <span className="bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                    {lowStockProducts.length} Size{lowStockProducts.length === 1 ? "" : "s"} Low
                  </span>
                ) : (
                  <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                    All Sizes Secure
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-stone-500 mt-0.5">
                Monitoring physical dispatch buffer limits to guarantee rapid customer order fulfillment.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowThresholdConfig(!showThresholdConfig)}
            className="text-[10px] font-bold text-amber-700 hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            id="toggle-threshold-config-btn"
          >
            {showThresholdConfig ? "Hide Threshold Safety Limits" : "Configure Custom Threshold Limits"}
          </button>
        </div>

        {/* Configurator Slider controls expanded state */}
        {showThresholdConfig && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2.5 border-t border-stone-200/50 transition-all duration-300">
            {Object.keys(thresholds).map((size) => (
              <div key={size} className="bg-white p-2.5 rounded-xl border border-stone-200 flex flex-col space-y-1">
                <span className="text-[10px] font-bold text-stone-500 block">
                  {size} Safe Stock
                </span>
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={thresholds[size] || 10}
                    onChange={(e) => setThresholds({
                      ...thresholds,
                      [size]: parseInt(e.target.value) || 10
                    })}
                    className="w-full h-1 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <span className="text-[11px] font-mono font-bold text-stone-800 w-5 text-right">
                    {thresholds[size]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dynamic Warning Alert Boxes for Low Stocks */}
        {lowStockProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 animate-fadeIn">
            {lowStockProducts.map(p => {
              const currentThreshold = thresholds[p.size] || 10;
              const unitMissing = currentThreshold - p.stock;
              return (
                <div 
                  key={p.id} 
                  className="bg-rose-50 border-l-4 border-rose-505 p-2.5 rounded-r-xl flex items-start gap-2.5"
                  id={`alert-size-${p.size}`}
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-xs text-rose-900 font-serif font-semibold">
                        {p.size} Packaging Bottleneck Detected
                      </strong>
                      <span className="text-[10px] font-mono font-bold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded">
                        Stock: {p.stock}
                      </span>
                    </div>
                    <p className="text-[10px] text-rose-700 mt-1 leading-snug">
                      Alert! Available physical inventory ({p.stock} units) has dropped below your requested custom threshold of <strong className="font-semibold">{currentThreshold} jars</strong>. Please authorize batch replenishment of <span className="font-bold underline">{unitMissing} jar{unitMissing > 1 ? "s" : ""}</span> of {p.size} design size immediately.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-emerald-50/50 border-l-4 border-emerald-500 p-2.5 rounded-r-xl flex items-center gap-2.5 text-emerald-800">
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-[10px] leading-snug">
              Excellent! All Ghee packaging configurations meet active safe thresholds. Available buffers are perfectly sized to handle incoming demand.
            </span>
          </div>
        )}
      </div>

      {/* Filter and search parameters */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
            <input
              type="text"
              placeholder={t("orders.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-10 pr-10 py-2.5 bg-stone-50 border border-stone-200 focus:bg-white rounded-xl focus:outline-hidden focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-stone-800 transition"
              id="search-orders"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition"
                title="Clear Search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-2 text-xs">
            <div className="relative">
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as any)}
                className="bg-stone-50 border border-stone-200 hover:border-stone-300 focus:bg-white rounded-xl px-3 py-2.5 text-stone-700 outline-hidden transition cursor-pointer appearance-none pr-8"
                id="filter-payment"
              >
                <option value="all">All Payments</option>
                <option value="Paid">Status: Paid</option>
                <option value="Pending">Status: Pending</option>
                <option value="Failed">Status: Failed</option>
                <option value="Cancelled">Status: Cancelled</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                <span className="text-[10px]">▼</span>
              </div>
            </div>

            <div className="relative">
              <select
                value={shippingFilter}
                onChange={(e) => setShippingFilter(e.target.value as any)}
                className="bg-stone-50 border border-stone-200 hover:border-stone-300 focus:bg-white rounded-xl px-3 py-2.5 text-stone-700 outline-hidden transition cursor-pointer appearance-none pr-8"
                id="filter-shipping"
              >
                <option value="all">All Shipping</option>
                <option value="Processing">Processing</option>
                <option value="Shipped">In Transit</option>
                <option value="Delivered">Delivered</option>
                <option value="Returned">Returned</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                <span className="text-[10px]">▼</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic active search filters state & Reset trigger */}
        {(searchQuery || paymentFilter !== "all" || shippingFilter !== "all") && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 px-3.5 bg-stone-50 border border-stone-200/50 rounded-xl text-[11px] text-stone-600 animate-fadeIn">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>Found <strong className="text-stone-900">{filteredOrders.length}</strong> {filteredOrders.length === 1 ? "order" : "orders"} matching active criteria:</span>
              {searchQuery && (
                <span className="bg-amber-100/70 border border-amber-200/50 text-amber-900 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[10px] font-medium">
                  Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery("")} className="hover:text-amber-950 font-bold ml-0.5 text-xs">×</button>
                </span>
              )}
              {paymentFilter !== "all" && (
                <span className="bg-emerald-50 border border-emerald-200/50 text-emerald-900 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[10px] font-medium">
                  Payment: {paymentFilter}
                  <button onClick={() => setPaymentFilter("all")} className="hover:text-emerald-950 font-bold ml-0.5 text-xs">×</button>
                </span>
              )}
              {shippingFilter !== "all" && (
                <span className="bg-indigo-50 border border-indigo-200/50 text-indigo-900 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[10px] font-medium">
                  Shipping: {shippingFilter}
                  <button onClick={() => setShippingFilter("all")} className="hover:text-indigo-950 font-bold ml-0.5 text-xs">×</button>
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setSearchQuery("");
                setPaymentFilter("all");
                setShippingFilter("all");
              }}
              className="text-amber-600 hover:text-amber-700 hover:underline font-semibold text-xs transition"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Orders Table view */}
      <div className="overflow-x-auto text-xs text-stone-800">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-100 text-stone-400 font-bold uppercase tracking-wider bg-stone-50/50">
              <th className="px-4 py-3">Order ID</th>
              <th className="px-4 py-3">Patron Name</th>
              <th className="px-4 py-3">Ghee Package</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Payment Status</th>
              <th className="px-4 py-3">Dispatch Stage</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredOrders.length > 0 ? (
              filteredOrders.map((o) => (
                <tr key={o.orderId} className="hover:bg-stone-50/40 transition">
                  <td className="px-4 py-3.5 font-mono font-medium text-stone-600">
                    {highlightText(o.orderId, searchQuery)}
                  </td>
                  <td className="px-4 py-3.5">
                    <strong className="text-stone-900 block font-serif">
                      {highlightText(o.customerName, searchQuery)}
                    </strong>
                    <span className="text-[10px] text-stone-400">
                      +{highlightText(o.customerPhone, searchQuery)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-stone-800">{o.size} Traditional Jar</div>
                    <span className="text-[10px] text-stone-400">Qty: {o.quantity} unit</span>
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-amber-900">₹{o.amount}</td>
                  <td className="px-4 py-3.5">
                    {(() => {
                      const status = o.paymentStatus;
                      let bgClass = "bg-stone-50 text-stone-600 border-stone-200";
                      let dotClass = "bg-stone-400";
                      if (status === "Paid") {
                        bgClass = "bg-emerald-50 text-emerald-700 border-emerald-200/60";
                        dotClass = "bg-emerald-500";
                      } else if (status === "Pending") {
                        bgClass = "bg-amber-50 text-amber-700 border-amber-200/60";
                        dotClass = "bg-amber-500";
                      } else if (status === "Failed" || status === "Cancelled") {
                        bgClass = "bg-rose-50 text-rose-700 border-rose-200/60";
                        dotClass = "bg-rose-500";
                      }
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${bgClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></span>
                          {status}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3.5">
                    {(() => {
                      const status = o.shippingStatus;
                      let bgClass = "bg-stone-50 text-stone-600 border-stone-200";
                      let dotClass = "bg-stone-400";
                      if (status === "Delivered") {
                        bgClass = "bg-emerald-50 text-emerald-700 border-emerald-200/60";
                        dotClass = "bg-emerald-500";
                      } else if (status === "Shipped") {
                        bgClass = "bg-indigo-50 text-indigo-700 border-indigo-200/60";
                        dotClass = "bg-indigo-500";
                      } else if (status === "Processing") {
                        bgClass = "bg-amber-50 text-amber-800 border-amber-200/60";
                        dotClass = "bg-amber-500";
                      } else if (status === "Returned" || status === "Cancelled") {
                        bgClass = "bg-rose-50 text-rose-700 border-rose-200/60";
                        dotClass = "bg-rose-500";
                      }
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${bgClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></span>
                          {status}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                    {o.shippingStatus !== "Delivered" && o.shippingStatus !== "Cancelled" && o.shippingStatus !== "Returned" && (
                      <button
                        onClick={() => handleModifyStatus(o.orderId, "Paid", "Delivered")}
                        disabled={updatingOrderId !== null}
                        className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 hover:text-emerald-800 px-2.5 py-1 rounded-lg text-[10px] font-bold transition disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer align-middle"
                        title={t("orders.markDelivered")}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{t("orders.markDeliveredShort")}</span>
                      </button>
                    )}
                    {o.shippingStatus !== "Cancelled" && o.shippingStatus !== "Returned" && o.shippingStatus !== "Delivered" && (
                      <button
                        onClick={() => handleModifyStatus(o.orderId, "Cancelled", "Cancelled")}
                        disabled={updatingOrderId !== null}
                        className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-800 px-2.5 py-1 rounded-lg text-[10px] font-bold transition disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer align-middle"
                        title={t("orders.markCancelled")}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>{t("orders.markCancelledShort")}</span>
                      </button>
                    )}
                    {(o.paymentStatus === "Pending" || o.shippingStatus === "Processing") && (
                      <button
                        onClick={() => setSelectedLabelOrder(o)}
                        className="bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 px-2.5 py-1 rounded-lg text-[10px] font-bold transition inline-flex items-center gap-1 cursor-pointer align-middle"
                        title={t("orders.printLabel")}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>{t("orders.printLabelShort")}</span>
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedTimelineOrder(o)}
                      className="border border-stone-200 hover:border-amber-400 hover:bg-amber-50 text-stone-600 hover:text-amber-800 px-2.5 py-1 rounded-lg transition inline-flex items-center gap-1 align-middle"
                      title="Track Live Shipment Ledger"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Track</span>
                    </button>
                    <button
                      onClick={() => extractReceiptText(o)}
                      className="border border-stone-200 hover:border-stone-800 hover:bg-stone-50 text-stone-500 hover:text-stone-900 p-1.5 rounded-lg transition inline-flex items-center align-middle"
                      title="Download Invoice File"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-10 text-stone-400 font-serif italic">
                  No ghee orders matching the specific filters are registered.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Shipment Tracker overlay */}
      {selectedTimelineOrder && renderShipmentTimeline(selectedTimelineOrder)}

      {/* Shipping Label Print Preview Modal */}
      {selectedLabelOrder && renderShippingLabelModal(selectedLabelOrder)}

      {/* Modal: Add manual order */}
      {isAddingOrder && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="modal-add-order">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-stone-200 flex flex-col max-h-[90vh]">
            <div className="bg-stone-950 text-stone-100 px-5 py-4 flex justify-between items-center shrink-0">
              <h3 className="font-serif font-bold text-amber-100 text-sm">{t("orders.modalTitle")}</h3>
              <button
                onClick={() => setIsAddingOrder(false)}
                className="text-stone-400 hover:text-stone-100 p-1 rounded hover:bg-stone-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-[10px] font-bold uppercase text-stone-400 block mb-1">{t("orders.phoneLabel")}</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-stone-400 block mb-1">{t("orders.nameLabel")}</label>
                <input
                  type="text"
                  placeholder="e.g. Arvindbhai Patel"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-stone-400 block mb-1">{t("orders.sizeLabel")}</label>
                  <select
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white"
                  >
                    <option value="500ml">500 ml (₹1100)</option>
                    <option value="1L">1 Litre (₹2100)</option>
                    <option value="5L">5 Litre (₹10000)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-stone-400 block mb-1">{t("orders.qtyLabel")}</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newQty}
                    onChange={(e) => setNewQty(parseInt(e.target.value) || 1)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-stone-400 block mb-1">Estimated Direct cost</label>
                <div className="bg-amber-50 p-2 rounded-lg border border-amber-100 text-xs font-serif font-semibold text-amber-900">
                  Total booking value: ₹{(getCalculatedPrice(newSize) * newQty).toLocaleString("en-IN")}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-stone-400 block mb-1">{t("orders.addressLabel")}</label>
                <textarea
                  placeholder="Street, City, Gujarat pincode..."
                  rows={2}
                  required
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-amber-500"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-stone-200 text-stone-950 font-bold py-2.5 rounded-xl text-xs transition uppercase mt-2 cursor-pointer"
              >
                {isSubmitting ? "Syncing with Database..." : t("orders.saveBtn")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
