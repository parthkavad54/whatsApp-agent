import { jsPDF } from "jspdf";
import { Order, Customer, Product } from "../types";

export function exportOrdersCSV(orders: Order[]) {
  const headers = [
    "Order ID",
    "Customer Name",
    "Customer Phone",
    "Product Name",
    "Size",
    "Quantity",
    "Amount (INR)",
    "Payment Status",
    "Shipping Status",
    "Address",
    "Razorpay Payment ID",
    "Created At"
  ];

  const rowMapper = (o: Order) => [
    o.orderId,
    o.customerName,
    o.customerPhone,
    o.productName,
    o.size,
    String(o.quantity),
    String(o.amount),
    o.paymentStatus,
    o.shippingStatus,
    o.address,
    o.razorpayPaymentId || "",
    o.createdAt
  ];

  downloadCSV(orders, "orders_report.csv", headers, rowMapper);
}

export function exportCustomersCSV(customers: Customer[]) {
  const headers = [
    "Phone Number",
    "Customer Name",
    "Preferred Language",
    "Total Orders",
    "Last Order Date",
    "Shipping Address",
    "Tags",
    "Special Notes"
  ];

  const rowMapper = (c: Customer) => [
    c.phone,
    c.name,
    c.preferredLanguage,
    String(c.totalOrders),
    c.lastOrderDate || "",
    c.address || "",
    (c.tags || []).join("; "),
    c.notes || ""
  ];

  downloadCSV(customers, "customers_report.csv", headers, rowMapper);
}

function downloadCSV(data: any[], filename: string, headers: string[], rowMapper: (item: any) => string[]) {
  const csvContent = [
    headers.join(","),
    ...data.map(item => {
      const row = rowMapper(item);
      return row.map(val => {
        const strVal = val === undefined || val === null ? "" : String(val);
        const escaped = strVal.replace(/"/g, '""');
        if (escaped.includes(",") || escaped.includes('"') || escaped.includes("\n") || escaped.includes("\r")) {
          return `"${escaped}"`;
        }
        return escaped;
      }).join(",");
    })
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportConsolidatedPDF(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  totalRevenue: number,
  totalOrders: number,
  averageTicketSize: number
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const primaryColor = [217, 119, 6];      // Amber-600
  const secondaryColor = [38, 38, 38];      // Stone-800
  const accentColor = [16, 185, 129];       // Emerald-500
  const lightBgColor = [250, 250, 249];     // Stone-50

  let currentY = 15;
  const pageHeight = 297;
  const pageWidth = 210;
  const margin = 15;

  const drawFooter = (d: typeof doc) => {
    const pageCount = d.getNumberOfPages();
    d.setFont("Helvetica", "italic");
    d.setFontSize(8);
    d.setTextColor(115, 115, 115);
    d.text(
      `Vedic Ghee Business Ledger Report  |  Page ${pageCount}`,
      margin,
      pageHeight - 10
    );
    // Draw horizontal footer rule
    d.setDrawColor(230, 230, 230);
    d.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  };

  const checkPageOverflow = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - margin - 15) {
      drawFooter(doc);
      doc.addPage();
      currentY = 20; // reset Y for raw page starting margin
    }
  };

  // --- PAGE 1: EXECUTIVES TITLE BLOCK ---
  // Background Header Block
  doc.setFillColor(245, 245, 244); // Stone-100
  doc.rect(0, 0, pageWidth, 50, "F");

  // Title text
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(217, 119, 6); // Amber-600
  doc.text("BILONA ERP AUDITING SYSTEM", margin, 22);

  // Subtitle
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("Executive Analytics & Commercial Inventory Ledger", margin, 29);

  // Timestamp & Information Block
  const timestamp = new Date().toLocaleString();
  doc.setFontSize(8);
  doc.setTextColor(115, 115, 115);
  doc.text(`Generated: ${timestamp}`, margin, 36);
  doc.text(`Database Mirroring Engine: MongoDB Atlas (Live Cloud) + Direct Local Cache`, margin, 41);

  // Decorative brand bar
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 48, pageWidth, 2, "F");

  currentY = 65;

  // KPIs Summary Tiles Group
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("Performance Metrics Dashboard", margin, currentY);
  currentY += 8;

  // Let's draw 4 stats cards!
  const cardWidth = 85;
  const cardHeight = 22;

  // Card 1: Cumulative Sales
  doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
  doc.setDrawColor(230, 230, 230);
  doc.rect(margin, currentY, cardWidth, cardHeight, "FD");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(115, 115, 115);
  doc.text("TOTAL REVENUE (PAID)", margin + 5, currentY + 6);
  doc.setFontSize(14);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`INR ${totalRevenue.toLocaleString("en-IN")}`, margin + 5, currentY + 16);

  // Card 2: Total Orders
  const col2X = pageWidth - margin - cardWidth;
  doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
  doc.rect(col2X, currentY, cardWidth, cardHeight, "FD");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(115, 115, 115);
  doc.text("TOTAL ORDERS PLACED", col2X + 5, currentY + 6);
  doc.setFontSize(14);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`${totalOrders} Orders`, col2X + 5, currentY + 16);

  currentY += cardHeight + 6;

  // Card 3: Active Patrons
  doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
  doc.rect(margin, currentY, cardWidth, cardHeight, "FD");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(115, 115, 115);
  doc.text("ACTIVE CLIENTS ROSTER", margin + 5, currentY + 6);
  doc.setFontSize(14);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`${customers.length} Patrons`, margin + 5, currentY + 16);

  // Card 4: Ticket Size
  doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
  doc.rect(col2X, currentY, cardWidth, cardHeight, "FD");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(115, 115, 115);
  doc.text("AVERAGE TRANSACTION VALUE", col2X + 5, currentY + 6);
  doc.setFontSize(14);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(`INR ${averageTicketSize.toLocaleString("en-IN")}`, col2X + 5, currentY + 16);

  currentY += cardHeight + 15;

  // --- SECTION: PHYSICAL STOCK INVENTORY AUDIT ---
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("Physical Stock Inventory Registry", margin, currentY);
  currentY += 6;

  // Table Headers
  doc.setFillColor(38, 38, 38); // Dark headers
  doc.rect(margin, currentY, pageWidth - (margin * 2), 7, "F");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("PRODUCT NAME", margin + 4, currentY + 5);
  doc.text("SIZE", margin + 75, currentY + 5);
  doc.text("PRICE", margin + 105, currentY + 5);
  doc.text("STOCK LEFT", margin + 135, currentY + 5);
  doc.text("STATUS", margin + 165, currentY + 5);
  currentY += 7;

  // Draw rows
  products.forEach((p, idx) => {
    checkPageOverflow(8);
    // Zebra rows
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(margin, currentY, pageWidth - (margin * 2), 7, "F");

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    // Draw cells
    doc.text(p.name, margin + 4, currentY + 5);
    doc.text(p.size, margin + 75, currentY + 5);
    doc.text(`INR ${p.price.toLocaleString("en-IN")}`, margin + 105, currentY + 5);
    doc.text(`${p.stock} Jars`, margin + 135, currentY + 5);
    
    // Status text
    const isLow = p.stock < 10;
    if (isLow) {
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text("LOW STOCK", margin + 165, currentY + 5);
    } else {
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(16, 185, 129);
      doc.text("ADEQUATE", margin + 165, currentY + 5);
    }

    currentY += 7;
  });

  currentY += 15;

  // --- PAGE 2: SALES AND DISPATCH HISTORIC LEDGER ---
  checkPageOverflow(80); // Ensure enough space or trigger new page
  if (currentY > 150) {
    // If we're already far down, push to next page
    drawFooter(doc);
    doc.addPage();
    currentY = 20;
  }

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("Recent Activity & Sales Dispatch Ledger", margin, currentY);
  currentY += 6;

  // Draw orders table header
  doc.setFillColor(217, 119, 6); // Amber standard bar header
  doc.rect(margin, currentY, pageWidth - (margin * 2), 7, "F");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("ORDER ID", margin + 3, currentY + 5);
  doc.text("PATRON NAME", margin + 30, currentY + 5);
  doc.text("PRODUCT", margin + 75, currentY + 5);
  doc.text("QTY", margin + 120, currentY + 5);
  doc.text("TOTAL", margin + 135, currentY + 5);
  doc.text("PAYMENT", margin + 155, currentY + 5);
  doc.text("SHIPPING", margin + 175, currentY + 5);
  currentY += 7;

  const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  sortedOrders.slice(0, 25).forEach((o, idx) => {
    checkPageOverflow(8);
    // Zebra rows
    if (idx % 2 === 0) {
      doc.setFillColor(252, 251, 250);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(margin, currentY, pageWidth - (margin * 2), 7, "F");

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);

    // Draw values
    doc.text(o.orderId.substring(0, 10), margin + 3, currentY + 5);
    doc.text(o.customerName.length > 20 ? o.customerName.substring(0, 18) + ".." : o.customerName, margin + 30, currentY + 5);
    
    const prodFriendlyName = `${o.size} Jar`;
    doc.text(prodFriendlyName, margin + 75, currentY + 5);
    doc.text(String(o.quantity), margin + 122, currentY + 5);
    doc.text(`INR ${o.amount.toLocaleString("en-IN")}`, margin + 135, currentY + 5);

    // Color code payment
    if (o.paymentStatus === "Paid") {
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(16, 185, 129); // emerald
    } else if (o.paymentStatus === "Failed") {
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(239, 68, 68); // red
    } else {
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(245, 158, 11); // amber
    }
    doc.text(o.paymentStatus, margin + 155, currentY + 5);

    // Color code shipping
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    if (o.shippingStatus === "Delivered") {
      doc.setTextColor(16, 185, 129);
    } else if (o.shippingStatus === "Shipped") {
      doc.setTextColor(59, 130, 246); // blue
    }
    doc.text(o.shippingStatus, margin + 175, currentY + 5);

    currentY += 7;
  });

  currentY += 15;

  // --- SECTION: CLIENT ROSTER REGISTRY ---
  checkPageOverflow(60);
  if (currentY > 180) {
    drawFooter(doc);
    doc.addPage();
    currentY = 20;
  }

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("Registered Clients & Audience Directory", margin, currentY);
  currentY += 6;

  // Draw customers table header
  doc.setFillColor(38, 38, 38);
  doc.rect(margin, currentY, pageWidth - (margin * 2), 7, "F");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("MOBILE PHONE", margin + 3, currentY + 5);
  doc.text("CLIENT NAME", margin + 45, currentY + 5);
  doc.text("LANGUAGE/TAGS", margin + 95, currentY + 5);
  doc.text("TOTAL DISPATCHES", margin + 155, currentY + 5);
  currentY += 7;

  customers.slice(0, 25).forEach((c, idx) => {
    checkPageOverflow(8);
    // Zebra rows
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(margin, currentY, pageWidth - (margin * 2), 7, "F");

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);

    doc.text(c.phone, margin + 3, currentY + 5);
    doc.text(c.name || "Valued Customer", margin + 45, currentY + 5);
    
    // Tag string or preferred language
    const langTag = `${c.preferredLanguage} / ` + (c.tags?.slice(0, 2).join(",") || "Standard");
    doc.text(langTag, margin + 95, currentY + 5);
    doc.text(`${c.totalOrders} standard orders`, margin + 155, currentY + 5);

    currentY += 7;
  });

  // End of report summary text
  checkPageOverflow(25);
  currentY += 10;
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;
  doc.setFont("Helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(115, 115, 115);
  doc.text("This report is digitally certified by Vedic Ghee Cloud Services ERP. Continuous backing via MongoDB Atlas.", margin, currentY);

  drawFooter(doc);

  // Trigger browser download of PDF doc
  doc.save("vedic_ghee_analytics_report.pdf");
}
