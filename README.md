# Supr Ghee Sales OS

AI-powered Sales Agent and Admin Dashboard for Gir cow Bilona Desi Ghee business managing WhatsApp, Calls, and Orders.

## WhatsApp Cloud API Webhook

This application includes a backend service to handle WhatsApp Cloud API webhooks.

### Configuration

To receive incoming WhatsApp messages, configure the following environment variables in your environment:

- `WHATSAPP_TOKEN`: Your WhatsApp Cloud API access token.
- `WHATSAPP_VERIFY_TOKEN`: A custom token used for webhook verification.

### API Endpoints

- **GET `/api/whatsapp`**: Used by the WhatsApp Cloud API for webhook URL verification.
- **POST `/api/whatsapp`**: The endpoint to receive incoming WhatsApp messages and events.

## Deployment

This application is configured to be deployed on Vercel.

1. Push your code to a GitHub repository.
2. Connect your repository to Vercel.
3. Configure the environment variables `WHATSAPP_TOKEN` and `WHATSAPP_VERIFY_TOKEN` in the Vercel project dashboard under Settings -> Environment Variables.
4. Deploy the project.
