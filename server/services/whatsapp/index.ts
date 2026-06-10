import { Request, Response } from "express";

export const handleWhatsAppVerification = (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(404);
  }
};

export const handleWhatsAppMessage = (req: Request, res: Response) => {
  console.log("Received WhatsApp webhook:", JSON.stringify(req.body, null, 2));

  // Acknowledge receipt
  res.status(200).send("EVENT_RECEIVED");
};
