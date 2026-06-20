import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { MongoClient } from "mongodb";
import { Product, Customer, Order, Conversation, CallLog, PaymentLog, WebhookLog, QuickReply } from "./src/types";

let DB_PATH = path.join(process.cwd(), "db.sqlite");

if (process.env.VERCEL) {
  const tmpPath = path.join("/tmp", "db.sqlite");
  const localPath = path.join(process.cwd(), "db.sqlite");
  if (!fs.existsSync(tmpPath)) {
    try {
      if (fs.existsSync(localPath)) {
        fs.copyFileSync(localPath, tmpPath);
        console.log("[Vercel Environment] Successfully copied read-only db.sqlite from workspace root to writable /tmp/db.sqlite");
      } else {
        console.log("[Vercel Environment] local workspace db.sqlite not found. A fresh blank sqlite database will be initialized under /tmp/db.sqlite");
      }
    } catch (err: any) {
      console.error("[Vercel Handshake] Failed cloning db.sqlite to writable temp folder:", err.message || err);
    }
  }
  DB_PATH = tmpPath;
}

let dbInstance: Database.Database | null = null;
let isSyncing = false;

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma("journal_mode = WAL");
    dbInstance.pragma("synchronous = NORMAL");
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: Database.Database) {
  // Products table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      size TEXT NOT NULL,
      price INTEGER NOT NULL,
      description TEXT,
      benefits TEXT,
      storageInfo TEXT,
      origin TEXT,
      stock INTEGER NOT NULL
    )
  `).run();

  // Customers table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS customers (
      phone TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      preferredLanguage TEXT NOT NULL,
      totalOrders INTEGER NOT NULL DEFAULT 0,
      lastOrderDate TEXT,
      address TEXT,
      tags TEXT,
      notes TEXT
    )
  `).run();

  // Orders table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
      orderId TEXT PRIMARY KEY,
      customerPhone TEXT NOT NULL,
      customerName TEXT NOT NULL,
      productName TEXT NOT NULL,
      size TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      paymentStatus TEXT NOT NULL,
      shippingStatus TEXT NOT NULL,
      address TEXT NOT NULL,
      razorpayPaymentId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `).run();

  // Conversations table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS conversations (
      customerPhone TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      messages TEXT NOT NULL,
      language TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `).run();

  // Call logs table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      customerPhone TEXT NOT NULL,
      customerName TEXT,
      transcript TEXT NOT NULL,
      summary TEXT NOT NULL,
      duration INTEGER NOT NULL,
      ordersCreated TEXT NOT NULL,
      internalNotes TEXT,
      createdAt TEXT NOT NULL
    )
  `).run();

  // Payments table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS payments (
      razorpayPaymentId TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      customerPhone TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      paidAt TEXT
    )
  `).run();

  // Webhook logs table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      service TEXT NOT NULL,
      event TEXT NOT NULL,
      payload TEXT NOT NULL
    )
  `).run();

  // Quick replies table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS quick_replies (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      shortcut TEXT NOT NULL,
      text TEXT NOT NULL
    )
  `).run();

  // Prompts (settings) table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      whatsappSystem TEXT NOT NULL,
      callsSystem TEXT NOT NULL,
      languageDetection TEXT NOT NULL,
      objectionHandling TEXT NOT NULL,
      selectedModel TEXT DEFAULT 'gemini-3.5-flash'
    )
  `).run();
}

// ==========================================
// MONGODB ATLAS SYNC IMPLEMENTATION
// ==========================================

export async function syncWithMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri || isSyncing) return;
  isSyncing = true;
  console.log("[MongoDB Atlas] Connecting to cluster to pull existing state...");
  let client: MongoClient | null = null;
  try {
    client = new MongoClient(uri);
    await client.connect();
    const mongoDb = client.db("vedic_ghee_db");
    console.log("[MongoDB Atlas] Connection established successfully!");

    // 1. Sync Prompt Config
    const promptsCol = mongoDb.collection("prompts");
    const mongoPrompt = await promptsCol.findOne({ id: 1 });
    if (mongoPrompt) {
      savePromptsLocal({
        whatsappSystem: mongoPrompt.whatsappSystem,
        callsSystem: mongoPrompt.callsSystem,
        languageDetection: mongoPrompt.languageDetection,
        objectionHandling: mongoPrompt.objectionHandling,
        selectedModel: mongoPrompt.selectedModel
      });
    }

    // 2. Sync Products
    const productsCol = mongoDb.collection("products");
    const mongoProducts = await productsCol.find({}).toArray();
    if (mongoProducts.length > 0) {
      const sqliteDb = getDatabase();
      sqliteDb.prepare("DELETE FROM products").run();
      for (const p of mongoProducts) {
        saveProductLocal({
          id: p.id,
          name: p.name,
          size: p.size,
          price: p.price,
          description: p.description,
          benefits: p.benefits,
          storageInfo: p.storageInfo,
          origin: p.origin,
          stock: p.stock
        });
      }
    }

    // 3. Sync Customers
    const customersCol = mongoDb.collection("customers");
    const mongoCustomers = await customersCol.find({}).toArray();
    if (mongoCustomers.length > 0) {
      const sqliteDb = getDatabase();
      sqliteDb.prepare("DELETE FROM customers").run();
      for (const c of mongoCustomers) {
        saveCustomerLocal({
          phone: c.phone,
          name: c.name,
          preferredLanguage: c.preferredLanguage,
          totalOrders: c.totalOrders,
          lastOrderDate: c.lastOrderDate,
          address: c.address,
          tags: c.tags,
          notes: c.notes
        });
      }
    }

    // 4. Sync Orders
    const ordersCol = mongoDb.collection("orders");
    const mongoOrders = await ordersCol.find({}).toArray();
    if (mongoOrders.length > 0) {
      const sqliteDb = getDatabase();
      sqliteDb.prepare("DELETE FROM orders").run();
      for (const o of mongoOrders) {
        saveOrderLocal({
          orderId: o.orderId,
          customerPhone: o.customerPhone,
          customerName: o.customerName,
          productName: o.productName,
          size: o.size,
          quantity: o.quantity,
          amount: o.amount,
          paymentStatus: o.paymentStatus,
          shippingStatus: o.shippingStatus,
          address: o.address,
          razorpayPaymentId: o.razorpayPaymentId,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt
        });
      }
    }

    // 5. Sync Conversations
    const convCol = mongoDb.collection("conversations");
    const mongoConvs = await convCol.find({}).toArray();
    if (mongoConvs.length > 0) {
      const sqliteDb = getDatabase();
      sqliteDb.prepare("DELETE FROM conversations").run();
      for (const c of mongoConvs) {
        saveConversationLocal({
          customerPhone: c.customerPhone,
          channel: c.channel,
          messages: c.messages,
          language: c.language,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        });
      }
    }

    // 6. Sync Call Logs
    const callCol = mongoDb.collection("call_logs");
    const mongoCallLogs = await callCol.find({}).toArray();
    if (mongoCallLogs.length > 0) {
      const sqliteDb = getDatabase();
      sqliteDb.prepare("DELETE FROM call_logs").run();
      for (const l of mongoCallLogs) {
        saveCallLogLocal({
          id: l.id,
          customerPhone: l.customerPhone,
          customerName: l.customerName,
          transcript: l.transcript,
          summary: l.summary,
          duration: l.duration,
          ordersCreated: l.ordersCreated,
          internalNotes: l.internalNotes,
          createdAt: l.createdAt
        });
      }
    }

    // 7. Sync Payments
    const payCol = mongoDb.collection("payments");
    const mongoPayments = await payCol.find({}).toArray();
    if (mongoPayments.length > 0) {
      const sqliteDb = getDatabase();
      sqliteDb.prepare("DELETE FROM payments").run();
      for (const p of mongoPayments) {
        savePaymentLocal({
          razorpayPaymentId: p.razorpayPaymentId,
          orderId: p.orderId,
          customerPhone: p.customerPhone,
          amount: p.amount,
          status: p.status,
          paidAt: p.paidAt
        });
      }
    }

    // 8. Sync Webhook Logs
    const webCol = mongoDb.collection("webhook_logs");
    const mongoWebhooks = await webCol.find({}).toArray();
    if (mongoWebhooks.length > 0) {
      const sqliteDb = getDatabase();
      sqliteDb.prepare("DELETE FROM webhook_logs").run();
      for (const r of mongoWebhooks) {
        saveWebhookLogLocal({
          id: r.id,
          timestamp: r.timestamp,
          service: r.service,
          event: r.event,
          payload: r.payload
        });
      }
    }

    // 9. Sync Quick Replies
    const qrCol = mongoDb.collection("quick_replies");
    const mongoQrs = await qrCol.find({}).toArray();
    if (mongoQrs.length > 0) {
      const sqliteDb = getDatabase();
      sqliteDb.prepare("DELETE FROM quick_replies").run();
      for (const qr of mongoQrs) {
        saveQuickReplyLocal({
          id: qr.id,
          title: qr.title,
          shortcut: qr.shortcut,
          text: qr.text
        });
      }
    }

    console.log("[MongoDB Atlas] local SQLite database cache synchronized with Atlas cluster successfully!");
  } catch (err: any) {
    const isSslAlert = err.message?.includes("0A000438") || err.message?.includes("ssl3_read_bytes") || err.message?.includes("SSL alert number 80");
    let cleanMessage = err.message || String(err);
    if (isSslAlert) {
      cleanMessage = `MongoDB SSL/TLS connection alert (OpenSSL alert 80). Explanation: Your MongoDB Atlas security settings are likely blocking this sandbox container's dynamic IP address. Action required: Log in to your MongoDB Atlas dashboard (cloud.mongodb.com), navigate to "Security" -> "Network Access", and add IP address "0.0.0.0/0" (Allow Access from Anywhere) to permit connection requests.`;
    }
    console.warn("[MongoDB Atlas] Synced phase postponed:", cleanMessage);
    throw new Error(cleanMessage);
  } finally {
    isSyncing = false;
    if (client) {
      try {
        await client.close();
      } catch (e) {}
    }
  }
}

// Async Background replication helpers logic
async function pushSingleToMongo(collectionName: string, idField: string, idValue: any, data: any) {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  let client: MongoClient | null = null;
  try {
    client = new MongoClient(uri);
    await client.connect();
    const mongoDb = client.db("vedic_ghee_db");
    const col = mongoDb.collection(collectionName);
    await col.replaceOne({ [idField]: idValue }, { ...data }, { upsert: true });
  } catch (err: any) {
    const isSslAlert = err.message?.includes("0A000438") || err.message?.includes("ssl3_read_bytes") || err.message?.includes("SSL alert number 80");
    if (isSslAlert) {
      console.warn(`[MongoDB Atlas Whitelist Warning] Write replication failed targeting ${collectionName}! OpenSSL TLS alert 80 suggests your MongoDB Atlas IP Access List is blocking this container. Navigate to Security -> Network Access and ensure 0.0.0.0/0 is whitelisted.`);
    } else {
      console.warn(`[MongoDB Atlas] Error copying write to collection ${collectionName}:`, err.message);
    }
  } finally {
    if (client) {
      try { await client.close(); } catch (e) {}
    }
  }
}

async function deleteSingleFromMongo(collectionName: string, idField: string, idValue: any) {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  let client: MongoClient | null = null;
  try {
    client = new MongoClient(uri);
    await client.connect();
    const mongoDb = client.db("vedic_ghee_db");
    const col = mongoDb.collection(collectionName);
    await col.deleteOne({ [idField]: idValue });
  } catch (err: any) {
    const isSslAlert = err.message?.includes("0A000438") || err.message?.includes("ssl3_read_bytes") || err.message?.includes("SSL alert number 80");
    if (isSslAlert) {
      console.warn(`[MongoDB Atlas Whitelist Warning] Deletion failed targeting ${collectionName}! OpenSSL TLS alert 80 suggests your MongoDB Atlas IP Access List is blocking this container. Navigate to Security -> Network Access and ensure 0.0.0.0/0 allows this connection.`);
    } else {
      console.warn(`[MongoDB Atlas] Error purging record from collection ${collectionName}:`, err.message);
    }
  } finally {
    if (client) {
      try { await client.close(); } catch (e) {}
    }
  }
}

async function pushAllToMongo(state: any) {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  let client: MongoClient | null = null;
  try {
    client = new MongoClient(uri);
    await client.connect();
    const mongoDb = client.db("vedic_ghee_db");

    // Push Products
    if (Array.isArray(state.products)) {
      const col = mongoDb.collection("products");
      await col.deleteMany({});
      if (state.products.length > 0) {
        await col.insertMany(state.products);
      }
    }

    // Push Customers
    if (Array.isArray(state.customers)) {
      const col = mongoDb.collection("customers");
      await col.deleteMany({});
      if (state.customers.length > 0) {
        await col.insertMany(state.customers);
      }
    }

    // Push Orders
    if (Array.isArray(state.orders)) {
      const col = mongoDb.collection("orders");
      await col.deleteMany({});
      if (state.orders.length > 0) {
        await col.insertMany(state.orders);
      }
    }

    // Push Conversations
    if (Array.isArray(state.conversations)) {
      const col = mongoDb.collection("conversations");
      await col.deleteMany({});
      if (state.conversations.length > 0) {
        await col.insertMany(state.conversations);
      }
    }

    // Push Call Logs
    if (Array.isArray(state.callLogs)) {
      const col = mongoDb.collection("call_logs");
      await col.deleteMany({});
      if (state.callLogs.length > 0) {
        await col.insertMany(state.callLogs);
      }
    }

    // Push Payments
    if (Array.isArray(state.payments)) {
      const col = mongoDb.collection("payments");
      await col.deleteMany({});
      if (state.payments.length > 0) {
        await col.insertMany(state.payments);
      }
    }

    // Push Webhook Logs
    if (Array.isArray(state.webhookLogs)) {
      const col = mongoDb.collection("webhook_logs");
      await col.deleteMany({});
      if (state.webhookLogs.length > 0) {
        await col.insertMany(state.webhookLogs);
      }
    }

    // Push Quick Replies
    if (Array.isArray(state.quickReplies)) {
      const col = mongoDb.collection("quick_replies");
      await col.deleteMany({});
      if (state.quickReplies.length > 0) {
        await col.insertMany(state.quickReplies);
      }
    }

    // Push Prompts
    if (state.prompts) {
      const col = mongoDb.collection("prompts");
      await col.replaceOne({ id: 1 }, { ...state.prompts, id: 1 }, { upsert: true });
    }

    console.log("[MongoDB Atlas] Bulk replicated state cleanly on cluster.");
  } catch (err: any) {
    console.warn("[MongoDB Atlas] Bulk replication failed:", err.message);
  } finally {
    if (client) {
      try { await client.close(); } catch (e) {}
    }
  }
}

// ==========================================
// LOCAL SQLITE BASE LOGIC
// ==========================================

function saveProductLocal(product: Product) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO products (id, name, size, price, description, benefits, storageInfo, origin, stock)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    product.id,
    product.name,
    product.size,
    product.price,
    product.description,
    JSON.stringify(product.benefits || []),
    product.storageInfo,
    product.origin,
    product.stock
  );
}

function deleteProductLocal(id: string) {
  const db = getDatabase();
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
}

function saveCustomerLocal(customer: Customer) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO customers (phone, name, preferredLanguage, totalOrders, lastOrderDate, address, tags, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    customer.phone,
    customer.name,
    customer.preferredLanguage,
    customer.totalOrders,
    customer.lastOrderDate || null,
    customer.address || null,
    JSON.stringify(customer.tags || []),
    customer.notes || null
  );
}

function deleteCustomerLocal(phone: string) {
  const db = getDatabase();
  db.prepare("DELETE FROM customers WHERE phone = ?").run(phone);
}

function saveOrderLocal(order: Order) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO orders (orderId, customerPhone, customerName, productName, size, quantity, amount, paymentStatus, shippingStatus, address, razorpayPaymentId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    order.orderId,
    order.customerPhone,
    order.customerName,
    order.productName,
    order.size,
    order.quantity,
    order.amount,
    order.paymentStatus,
    order.shippingStatus,
    order.address,
    order.razorpayPaymentId || null,
    order.createdAt,
    order.updatedAt
  );
}

function deleteOrderLocal(orderId: string) {
  const db = getDatabase();
  db.prepare("DELETE FROM orders WHERE orderId = ?").run(orderId);
}

function saveConversationLocal(conversation: Conversation) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO conversations (customerPhone, channel, messages, language, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    conversation.customerPhone,
    conversation.channel,
    JSON.stringify(conversation.messages || []),
    conversation.language,
    conversation.createdAt,
    conversation.updatedAt
  );
}

function deleteConversationLocal(customerPhone: string) {
  const db = getDatabase();
  db.prepare("DELETE FROM conversations WHERE customerPhone = ?").run(customerPhone);
}

function saveCallLogLocal(log: CallLog) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO call_logs (id, customerPhone, customerName, transcript, summary, duration, ordersCreated, internalNotes, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    log.id,
    log.customerPhone,
    log.customerName || null,
    JSON.stringify(log.transcript || []),
    log.summary,
    log.duration,
    JSON.stringify(log.ordersCreated || []),
    log.internalNotes || null,
    log.createdAt
  );
}

function deleteCallLogLocal(id: string) {
  const db = getDatabase();
  db.prepare("DELETE FROM call_logs WHERE id = ?").run(id);
}

function savePaymentLocal(payment: PaymentLog) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO payments (razorpayPaymentId, orderId, customerPhone, amount, status, paidAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    payment.razorpayPaymentId,
    payment.orderId,
    payment.customerPhone,
    payment.amount,
    payment.status,
    payment.paidAt || null
  );
}

function deletePaymentLocal(razorpayPaymentId: string) {
  const db = getDatabase();
  db.prepare("DELETE FROM payments WHERE razorpayPaymentId = ?").run(razorpayPaymentId);
}

function saveWebhookLogLocal(log: WebhookLog) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO webhook_logs (id, timestamp, service, event, payload)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    log.id,
    log.timestamp,
    log.service,
    log.event,
    JSON.stringify(log.payload || {})
  );
}

function deleteWebhookLogLocal(id: string) {
  const db = getDatabase();
  db.prepare("DELETE FROM webhook_logs WHERE id = ?").run(id);
}

function saveQuickReplyLocal(qr: QuickReply) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO quick_replies (id, title, shortcut, text)
    VALUES (?, ?, ?, ?)
  `).run(qr.id, qr.title, qr.shortcut, qr.text);
}

function deleteQuickReplyLocal(id: string) {
  const db = getDatabase();
  db.prepare("DELETE FROM quick_replies WHERE id = ?").run(id);
}

function savePromptsLocal(p: {
  whatsappSystem: string;
  callsSystem: string;
  languageDetection: string;
  objectionHandling: string;
  selectedModel?: string;
}) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO prompts (id, whatsappSystem, callsSystem, languageDetection, objectionHandling, selectedModel)
    VALUES (1, ?, ?, ?, ?, ?)
  `).run(
    p.whatsappSystem,
    p.callsSystem,
    p.languageDetection,
    p.objectionHandling,
    p.selectedModel || "gemini-3.5-flash"
  );
}

// ==========================================
// EXPOSED PUBLIC API INTEGRATING DUAL-MODES
// ==========================================

export function getProducts(): Product[] {
  const db = getDatabase();
  const rows = db.prepare("SELECT * FROM products").all() as any[];
  return rows.map(r => ({
    ...r,
    benefits: r.benefits ? JSON.parse(r.benefits) : []
  }));
}

export function saveProduct(product: Product) {
  saveProductLocal(product);
  pushSingleToMongo("products", "id", product.id, product);
}

export function deleteProduct(id: string) {
  deleteProductLocal(id);
  deleteSingleFromMongo("products", "id", id);
}

export function getCustomers(): Customer[] {
  const db = getDatabase();
  const rows = db.prepare("SELECT * FROM customers").all() as any[];
  return rows.map(r => ({
    ...r,
    tags: r.tags ? JSON.parse(r.tags) : [],
    lastOrderDate: r.lastOrderDate || undefined,
    address: r.address || undefined,
    notes: r.notes || undefined
  }));
}

export function saveCustomer(customer: Customer) {
  saveCustomerLocal(customer);
  pushSingleToMongo("customers", "phone", customer.phone, customer);
}

export function deleteCustomer(phone: string) {
  deleteCustomerLocal(phone);
  deleteSingleFromMongo("customers", "phone", phone);
}

export function getOrders(): Order[] {
  const db = getDatabase();
  const rows = db.prepare("SELECT * FROM orders ORDER BY createdAt DESC").all() as any[];
  return rows.map(r => ({
    ...r,
    razorpayPaymentId: r.razorpayPaymentId || undefined
  }));
}

export function saveOrder(order: Order) {
  saveOrderLocal(order);
  pushSingleToMongo("orders", "orderId", order.orderId, order);
}

export function deleteOrder(orderId: string) {
  deleteOrderLocal(orderId);
  deleteSingleFromMongo("orders", "orderId", orderId);
}

export function getConversations(): Conversation[] {
  const db = getDatabase();
  const rows = db.prepare("SELECT * FROM conversations").all() as any[];
  return rows.map(r => ({
    ...r,
    messages: JSON.parse(r.messages)
  }));
}

export function saveConversation(conversation: Conversation) {
  saveConversationLocal(conversation);
  pushSingleToMongo("conversations", "customerPhone", conversation.customerPhone, conversation);
}

export function deleteConversation(customerPhone: string) {
  deleteConversationLocal(customerPhone);
  deleteSingleFromMongo("conversations", "customerPhone", customerPhone);
}

export function getCallLogs(): CallLog[] {
  const db = getDatabase();
  const rows = db.prepare("SELECT * FROM call_logs ORDER BY createdAt DESC").all() as any[];
  return rows.map(r => ({
    ...r,
    transcript: JSON.parse(r.transcript),
    ordersCreated: JSON.parse(r.ordersCreated),
    customerName: r.customerName || undefined,
    internalNotes: r.internalNotes || undefined
  }));
}

export function saveCallLog(log: CallLog) {
  saveCallLogLocal(log);
  pushSingleToMongo("call_logs", "id", log.id, log);
}

export function deleteCallLog(id: string) {
  deleteCallLogLocal(id);
  deleteSingleFromMongo("call_logs", "id", id);
}

export function getPayments(): PaymentLog[] {
  const db = getDatabase();
  const rows = db.prepare("SELECT * FROM payments").all() as any[];
  return rows.map(r => ({
    ...r,
    paidAt: r.paidAt || undefined
  }));
}

export function savePayment(payment: PaymentLog) {
  savePaymentLocal(payment);
  pushSingleToMongo("payments", "razorpayPaymentId", payment.razorpayPaymentId, payment);
}

export function deletePayment(razorpayPaymentId: string) {
  deletePaymentLocal(razorpayPaymentId);
  deleteSingleFromMongo("payments", "razorpayPaymentId", razorpayPaymentId);
}

export function getWebhookLogs(): WebhookLog[] {
  const db = getDatabase();
  const rows = db.prepare("SELECT * FROM webhook_logs ORDER BY timestamp DESC").all() as any[];
  return rows.map(r => ({
    ...r,
    payload: JSON.parse(r.payload)
  }));
}

export function saveWebhookLog(log: WebhookLog) {
  saveWebhookLogLocal(log);
  pushSingleToMongo("webhook_logs", "id", log.id, log);
}

export function deleteWebhookLog(id: string) {
  deleteWebhookLogLocal(id);
  deleteSingleFromMongo("webhook_logs", "id", id);
}

export function getQuickReplies(): QuickReply[] {
  const db = getDatabase();
  const rows = db.prepare("SELECT * FROM quick_replies").all() as any[];
  return rows;
}

export function saveQuickReply(qr: QuickReply) {
  saveQuickReplyLocal(qr);
  pushSingleToMongo("quick_replies", "id", qr.id, qr);
}

export function deleteQuickReply(id: string) {
  deleteQuickReplyLocal(id);
  deleteSingleFromMongo("quick_replies", "id", id);
}

export function getPrompts() {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM prompts WHERE id = 1").get() as any;
  if (!row) return null;
  return {
    whatsappSystem: row.whatsappSystem,
    callsSystem: row.callsSystem,
    languageDetection: row.languageDetection,
    objectionHandling: row.objectionHandling,
    selectedModel: row.selectedModel
  };
}

export function savePrompts(p: {
  whatsappSystem: string;
  callsSystem: string;
  languageDetection: string;
  objectionHandling: string;
  selectedModel?: string;
}) {
  savePromptsLocal(p);
  pushSingleToMongo("prompts", "id", 1, {
    ...p,
    id: 1,
    selectedModel: p.selectedModel || "gemini-3.5-flash"
  });
}

// Bulk Sync State Persist All
export function saveAll(state: any) {
  const db = getDatabase();
  const transaction = db.transaction(() => {
    // 1. Products
    if (Array.isArray(state.products)) {
      db.prepare("DELETE FROM products").run();
      for (const p of state.products) {
        saveProductLocal(p);
      }
    }

    // 2. Customers
    if (Array.isArray(state.customers)) {
      db.prepare("DELETE FROM customers").run();
      for (const c of state.customers) {
        saveCustomerLocal(c);
      }
    }

    // 3. Orders
    if (Array.isArray(state.orders)) {
      db.prepare("DELETE FROM orders").run();
      for (const o of state.orders) {
        saveOrderLocal(o);
      }
    }

    // 4. Conversations
    if (Array.isArray(state.conversations)) {
      db.prepare("DELETE FROM conversations").run();
      for (const c of state.conversations) {
        saveConversationLocal(c);
      }
    }

    // 5. Call Logs
    if (Array.isArray(state.callLogs)) {
      db.prepare("DELETE FROM call_logs").run();
      for (const l of state.callLogs) {
        saveCallLogLocal(l);
      }
    }

    // 6. Payments
    if (Array.isArray(state.payments)) {
      db.prepare("DELETE FROM payments").run();
      for (const p of state.payments) {
        savePaymentLocal(p);
      }
    }

    // 7. Webhook Logs
    if (Array.isArray(state.webhookLogs)) {
      db.prepare("DELETE FROM webhook_logs").run();
      for (const w of state.webhookLogs) {
        saveWebhookLogLocal(w);
      }
    }

    // 8. Quick Replies
    if (Array.isArray(state.quickReplies)) {
      db.prepare("DELETE FROM quick_replies").run();
      for (const q of state.quickReplies) {
        saveQuickReplyLocal(q);
      }
    }

    // 9. Prompts
    if (state.prompts) {
      savePromptsLocal(state.prompts);
    }
  });

  transaction();

  // Push bulk update to Mongo concurrently
  pushAllToMongo(state);
}

export function loadAll(fallbackState: any): any {
  const db = getDatabase();
  
  const products = getProducts();
  const customers = getCustomers();
  const orders = getOrders();
  const conversations = getConversations();
  const callLogs = getCallLogs();
  const payments = getPayments();
  const webhookLogs = getWebhookLogs();
  const quickReplies = getQuickReplies();
  const prompts = getPrompts();

  // First sync pull if Mongo config is available
  if (process.env.MONGODB_URI) {
    // Fire and forget startup sync
    syncWithMongo().catch(err => {
      console.log("[MongoDB Atlas Sync] Background startup sync postponed/restricted. Please check network. Details:", err.message || err);
    });
  }

  // If any critical collection is empty, seed it from fallbackState
  if (products.length === 0 && Array.isArray(fallbackState.products) && fallbackState.products.length > 0) {
    saveAll(fallbackState);
    return loadAll(fallbackState);
  }

  return {
    products: products.length > 0 ? products : fallbackState.products,
    customers: customers.length > 0 ? customers : fallbackState.customers,
    orders: orders.length > 0 ? orders : fallbackState.orders,
    conversations: conversations.length > 0 ? conversations : fallbackState.conversations,
    callLogs: callLogs.length > 0 ? callLogs : fallbackState.callLogs,
    payments: payments.length > 0 ? payments : fallbackState.payments,
    webhookLogs: webhookLogs.length > 0 ? webhookLogs : fallbackState.webhookLogs,
    quickReplies: quickReplies.length > 0 ? quickReplies : fallbackState.quickReplies,
    prompts: prompts || fallbackState.prompts
  };
}
