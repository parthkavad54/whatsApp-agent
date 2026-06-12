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
  AlertTriangle
} from "lucide-react";
import { Order, Product, Customer } from "../types";

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
}

export default function OrdersTab({
  orders,
  products,
  customers,
  onCreateManualOrder,
  onUpdateOrderStatus
}: OrdersTabProps) {
  // Filters & State
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "Paid" | "Pending" | "Failed">("all");
  const [shippingFilter, setShippingFilter] = useState<"all" | "Processing" | "Shipped" | "Delivered" | "Returned">("all");
  const [selectedTimelineOrder, setSelectedTimelineOrder] = useState<Order | null>(null);
  
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
    const matchesSearch = 
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerPhone.includes(searchQuery) ||
      o.orderId.toLowerCase().includes(searchQuery.toLowerCase());
    
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
          <h2 className="font-serif font-bold text-stone-900 text-lg">Daily Dispatches Ledger</h2>
          <p className="text-xs text-stone-500">Add, track, and manage all your A2 Bilona Desi Ghee order fulfillments</p>
        </div>
        <button
          onClick={() => setIsAddingOrder(true)}
          className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition ml-auto"
          id="btn-add-manual-order"
        >
          <Plus className="w-4 h-4" />
          <span>Manual Booking</span>
        </button>
      </div>

      {/* Filter and search parameters */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by patron name, phone, or order reference ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 focus:bg-white rounded-xl focus:outline-hidden focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-stone-800"
            id="search-orders"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 text-xs">
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as any)}
            className="bg-stone-50 border border-stone-200 focus:bg-white rounded-xl px-3 py-2 text-stone-700 outline-hidden"
            id="filter-payment"
          >
            <option value="all">All Payments</option>
            <option value="Paid">Status: Paid</option>
            <option value="Pending">Status: Pending</option>
            <option value="Failed">Status: Failed</option>
          </select>

          <select
            value={shippingFilter}
            onChange={(e) => setShippingFilter(e.target.value as any)}
            className="bg-stone-50 border border-stone-200 focus:bg-white rounded-xl px-3 py-2 text-stone-700 outline-hidden"
            id="filter-shipping"
          >
            <option value="all">All Shipping</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">In Transit</option>
            <option value="Delivered">Delivered</option>
            <option value="Returned">Returned</option>
          </select>
        </div>
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
                  <td className="px-4 py-3.5 font-mono font-medium text-stone-600">{o.orderId}</td>
                  <td className="px-4 py-3.5">
                    <strong className="text-stone-900 block font-serif">{o.customerName}</strong>
                    <span className="text-[10px] text-stone-400">+{o.customerPhone}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-stone-800">{o.size} Traditional Jar</div>
                    <span className="text-[10px] text-stone-400">Qty: {o.quantity} unit</span>
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-amber-900">₹{o.amount}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      o.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                      o.paymentStatus === "Pending" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                      "bg-rose-50 text-rose-700 border border-rose-100"
                    }`}>
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      o.shippingStatus === "Delivered" ? "bg-emerald-50 text-emerald-700" :
                      o.shippingStatus === "Shipped" ? "bg-indigo-50 text-indigo-700" :
                      o.shippingStatus === "Returned" ? "bg-stone-100 text-stone-600" :
                      "bg-amber-50 text-amber-600"
                    }`}>
                      {o.shippingStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedTimelineOrder(o)}
                      className="border border-stone-200 hover:border-amber-400 hover:bg-amber-50 text-stone-600 hover:text-amber-800 px-2.5 py-1 rounded-lg transition"
                      title="Track Live Shipment Ledger"
                    >
                      <Truck className="w-3.5 h-3.5 inline mr-1" />
                      <span>Track</span>
                    </button>
                    <button
                      onClick={() => extractReceiptText(o)}
                      className="border border-stone-200 hover:border-stone-800 hover:bg-stone-50 text-stone-500 hover:text-stone-900 p-1 rounded-lg transition"
                      title="Download Invoice File"
                    >
                      <Download className="w-3.5 h-3.5 inline" />
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

      {/* Modal: Add manual order */}
      {isAddingOrder && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="modal-add-order">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-stone-200">
            <div className="bg-stone-950 text-stone-100 px-5 py-4 flex justify-between items-center">
              <h3 className="font-serif font-bold text-amber-100 text-sm">Log Manual Traditional Booking</h3>
              <button
                onClick={() => setIsAddingOrder(false)}
                className="text-stone-400 hover:text-stone-100 p-1 rounded hover:bg-stone-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-stone-400 block mb-1">Patron Phone Number (10 digits) *</label>
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
                <label className="text-[10px] font-bold uppercase text-stone-400 block mb-1">Patron Full Name *</label>
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
                  <label className="text-[10px] font-bold uppercase text-stone-400 block mb-1">Jar Size Volume</label>
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
                  <label className="text-[10px] font-bold uppercase text-stone-400 block mb-1">Jar Quantity</label>
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
                <label className="text-[10px] font-bold uppercase text-stone-400 block mb-1">Delivery Address *</label>
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
                {isSubmitting ? "Syncing with Database..." : "Commit Standard Order"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
