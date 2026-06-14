import { Request, Response } from "express";
import https from "https";

type MessageCallback = (from: string, name: string, text: string, type: string) => Promise<any>;
let messageHandlerCallback: MessageCallback | null = null;

/**
 * Register a callback from our main server state engine to handle parsed incoming WhatsApp messages
 */
export const registerWhatsAppMessageHandler = (callback: MessageCallback) => {
  messageHandlerCallback = callback;
};

export const handleWhatsAppVerification = (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("[WhatsApp Webhook] Verification Request received:", { mode, token, challenge });

  if (mode && token) {
    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log("[WhatsApp Webhook] WEBHOOK_VERIFIED matches WHATSAPP_VERIFY_TOKEN perfectly.");
      res.status(200).send(challenge);
    } else {
      console.warn("[WhatsApp Webhook] Verification MISMATCH or unauthorized request.");
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(404);
  }
};

export const handleWhatsAppMessage = async (req: Request, res: Response) => {
  const body = req.body;
  console.log("[WhatsApp Webhook] Received payload:", JSON.stringify(body, null, 2));

  if (body.object === "whatsapp_business_account") {
    try {
      const entries = body.entry;
      for (const entry of entries) {
        const changes = entry.changes;
        for (const change of changes) {
          const val = change.value;
          // Verify we have received actual messages
          if (val && val.messages && val.messages.length > 0) {
            const message = val.messages[0];
            const from = message.from; // Customer phone number
            const contact = val.contacts && val.contacts.length > 0 ? val.contacts[0] : null;
            const customerName = contact?.profile?.name || "WhatsApp Patron";
            
            let messageText = "";
            let messageType = message.type || "text";

            if (messageType === "text" && message.text) {
              messageText = message.text.body;
            } else if (messageType === "button" && message.button) {
              messageText = message.button.text;
            } else if (messageType === "interactive" && message.interactive) {
              if (message.interactive.type === "button_reply" && message.interactive.button_reply) {
                messageText = message.interactive.button_reply.title;
              } else if (message.interactive.type === "list_reply" && message.interactive.list_reply) {
                messageText = message.interactive.list_reply.title;
              }
            } else if (message.audio) {
              messageText = "[Audio Voice Note Voice-to-Text Sim]";
              messageType = "audio";
            } else {
              messageText = `[Received ${messageType} message payload]`;
            }

            console.log(`[WhatsApp Webhook] parsed message from +${from} (${customerName}): "${messageText}" (${messageType})`);

            // Execute the trilingual sales agent logic asynchronously
            if (messageHandlerCallback) {
              messageHandlerCallback(from, customerName, messageText, messageType).catch(err => {
                console.error("[WhatsApp Callback] Callback processing failed:", err);
              });
            } else {
              console.warn("[WhatsApp Webhook] No message callback registered! Please check server.ts integration.");
            }
          }
        }
      }
    } catch (err) {
      console.error("[WhatsApp Webhook] Failed parsing message structure:", err);
    }
  }

  // Always respond with 200 OK to Meta to avoid webhook retry loops
  res.status(200).send("EVENT_RECEIVED");
};

/**
 * Sends a real outbound WhatsApp message using Meta's official Cloud API.
 * Uses native secure HTTPS client for maximum compatibility and zero dependencies.
 */
export function sendActualWhatsAppMessage(to: string, text: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.log("[WhatsApp Service] Either WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing. Running in simulator-only mode.");
    return Promise.resolve(false);
  }

  // Sanitize the target phone number to numbers only
  const cleanTo = to.replace(/\D/g, "");
  console.log(`[WhatsApp Service] Dispatched production REST request to +${cleanTo}`);

  const payload = JSON.stringify({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanTo,
    type: "text",
    text: { preview_url: false, body: text }
  });

  const options = {
    hostname: "graph.facebook.com",
    path: `/v20.0/${phoneId}/messages`,
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload)
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => {
        responseBody += chunk;
      });
      res.on("end", () => {
        console.log(`[WhatsApp Service] Outbound API Response Code: ${res.statusCode}`);
        console.log(`[WhatsApp Service] Response payload: ${responseBody}`);

        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[WhatsApp Service] Successfully delivered message to +${cleanTo}`);
          resolve(true);
        } else {
          console.error(`[WhatsApp Service] Failed delivering message. Status: ${res.statusCode}. Body: ${responseBody}`);
          resolve(false);
        }
      });
    });

    req.on("error", (error) => {
      console.error(`[WhatsApp Service] Network or HTTPS request error targeting Graph API:`, error);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}
