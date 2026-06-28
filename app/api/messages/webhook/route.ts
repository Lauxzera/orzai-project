import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { buildMetaWebhookUrl, getResolvedWhatsAppConfig } from "@/lib/server/messages-client";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const config = await getResolvedWhatsAppConfig();
  return NextResponse.json({
    provider: config.provider,
    configured: config.configured,
    webhookUrl: buildMetaWebhookUrl(),
    verifyTokenConfigured: Boolean(config.meta.webhookVerifyToken),
    appSecretConfigured: Boolean(config.meta.appSecret),
  });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const config = await getResolvedWhatsAppConfig();
  if (config.provider !== "meta") {
    return NextResponse.json(
      {
        error: "O provedor oficial do WhatsApp nao esta configurado nesta instalacao.",
      },
      { status: 400 },
    );
  }

  const webhookUrl = buildMetaWebhookUrl();
  if (!webhookUrl) {
    return NextResponse.json(
      {
        error: "Defina APP_URL com uma URL publica HTTPS para usar o webhook oficial da Meta.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    provider: "meta",
    configuredUrl: webhookUrl,
    verifyTokenConfigured: Boolean(config.meta.webhookVerifyToken),
    appSecretConfigured: Boolean(config.meta.appSecret),
    message:
      "O webhook oficial da Meta usa configuracao externa no painel da WhatsApp Business Platform. Esta rota expõe a URL publica que deve ser cadastrada.",
  });
}
