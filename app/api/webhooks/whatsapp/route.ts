import "server-only";

import { createLogger } from "@/lib/server/logger";
import { getWhatsAppConfig, handleMetaWebhookPayload, verifyMetaWebhookSignature } from "@/lib/server/messages-client";

const logger = createLogger("webhooks/whatsapp");

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  // Use META_WEBHOOK_VERIFY_TOKEN (same as /api/webhooks/meta).
  // WHATSAPP_VERIFY_TOKEN is accepted as alias for backwards compatibility.
  const verifyToken = (process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || "").trim();

  if (mode === "subscribe" && token === verifyToken && verifyToken) {
    logger.info("verificação de hub aceita");
    return new Response(challenge ?? "", { status: 200 });
  }

  logger.warn("verificação de hub falhou", { mode, tokenMatch: token === verifyToken });
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  // Responder 200 imediatamente para o Meta não retentativa
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  const config = getWhatsAppConfig();
  if (!verifyMetaWebhookSignature(rawBody, signature, config)) {
    logger.warn("assinatura HMAC inválida");
    return new Response("Forbidden", { status: 403 });
  }

  let payload: unknown = null;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as unknown) : null;
  } catch {
    logger.warn("payload não é JSON válido");
  }

  logger.info("payload recebido", { preview: rawBody.slice(0, 500) });

  if (payload) {
    handleMetaWebhookPayload(payload).catch((err: unknown) => {
      logger.error("erro ao processar payload", err);
    });
  }

  return new Response("OK", { status: 200 });
}
