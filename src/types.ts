export interface Product {
  id: string;
  name: string;
  size: string; // e.g. "500ml", "1L", "5L"
  price: number; // in INR
  description: string;
  benefits: string[];
  storageInfo: string;
  origin: string;
}

export interface Customer {
  phone: string; // Unique mobile number as ID
  name: string;
  preferredLanguage: 'English' | 'Gujarati' | 'Gujlish';
  totalOrders: number;
  lastOrderDate?: string;
  address?: string;
  tags: string[]; // e.g. "New", "Returning", "Wholesale", "VIP"
  notes?: string;
}

export interface Order {
  orderId: string;
  customerPhone: string;
  customerName: string;
  productName: string; // e.g. "Gir Cow A2 Desi Ghee"
  size: string; // e.g. "1L"
  quantity: number;
  amount: number;
  paymentStatus: 'Pending' | 'Paid' | 'Failed';
  shippingStatus: 'Processing' | 'Shipped' | 'Delivered' | 'Returned';
  address: string;
  razorpayPaymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageLine {
  sender: 'customer' | 'agent' | 'system';
  text: string;
  timestamp: string;
  type?: 'text' | 'audio';
  duration?: number; // for audio
}

export interface Conversation {
  customerPhone: string;
  channel: 'whatsapp' | 'call';
  messages: MessageLine[];
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpeechPhrase {
  speaker: 'customer' | 'agent' | 'system';
  phrase: string;
  time: string;
}

export interface CallLog {
  id: string;
  customerPhone: string;
  customerName?: string;
  transcript: SpeechPhrase[];
  summary: string;
  duration: number; // in seconds
  ordersCreated: string[]; // Order IDs
  internalNotes?: string;
  createdAt: string;
}

export interface PaymentLog {
  orderId: string;
  razorpayPaymentId: string;
  customerPhone: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  paidAt?: string;
}

export interface WebhookLog {
  id: string;
  timestamp: string;
  service: 'WhatsApp' | 'Razorpay' | 'Sheets' | 'Call';
  event: string;
  payload: any;
}

export interface QuickReply {
  id: string;
  title: string;
  shortcut: string;
  text: string;
}
