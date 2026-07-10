import { NextResponse } from "next/server";
import { createLogger } from "@/lib/server/logger";
import { getResolvedWhatsAppConfig, handleMetaWebhookPayload, verifyMetaWebhookSignature } from "@/lib/server/messages-client";

const logger = createLogger("webhooks/meta");

export async function GET(request: Request) {
  const config = await getResolvedWhatsAppConfig();
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (config.provider !== "meta" || !config.meta.webhookVerifyToken) {
    return new NextResponse("Webhook oficial nao configurado.", { status: 503 });
  }

  if (mode === "subscribe" && token === config.meta.webhookVerifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Token de verificacao invalido.", { status: 403 });
}

export async function POST(request: Request) {
  if (process.env.PREVIEW_MODE === "true") {
    return NextResponse.json({ ok: true });
  }

  const config = await getResolvedWhatsAppConfig();
  if (config.provider !== "meta") {
    return NextResponse.json({ ok: false, error: "Provedor Meta nao configurado." }, { status: 400 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyMetaWebhookSignature(rawBody, signature, config)) {
    return NextResponse.json({ ok: false, error: "Assinatura do webhook invalida." }, { status: 403 });
  }

  try {
    const payload = rawBody ? JSON.parse(rawBody) : {};
    await handleMetaWebhookPayload(payload);
    return NextResponse.json({ ok: true, received: true });
  } catch (error) {
    logger.error("falha ao processar webhook", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao processar webhook da Meta." },
      { status: 500 },
    );
  }
}
