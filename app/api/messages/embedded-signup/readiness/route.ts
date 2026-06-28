import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { getMessageChannelConfig } from "@/lib/server/message-channel-config-store";
import {
  buildMetaEmbeddedSignupCallbackUrl,
  buildMetaEmbeddedSignupLaunchUrl,
  buildMetaWebhookUrl,
  getResolvedWhatsAppConfig,
  getWhatsAppConfigDiagnostics,
} from "@/lib/server/messages-client";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const [channelConfig, diagnostics] = await Promise.all([
    getMessageChannelConfig(),
    getResolvedWhatsAppConfig().then((config) => getWhatsAppConfigDiagnostics(config)),
  ]);

  const stateToken = "belart-meta-readiness-check";
  let launchUrl = "";
  let launchUrlReady = false;

  try {
    launchUrl = await buildMetaEmbeddedSignupLaunchUrl(stateToken);
    launchUrlReady = Boolean(launchUrl);
  } catch {
    launchUrl = "";
    launchUrlReady = false;
  }

  const checklist = [
    {
      key: "app_url_https",
      label: "APP_URL publica com HTTPS",
      ready: Boolean(buildMetaWebhookUrl() && buildMetaEmbeddedSignupCallbackUrl()),
      detail: buildMetaWebhookUrl() || "Defina APP_URL publica antes do teste.",
    },
    {
      key: "cloud_api_env",
      label: "Credenciais base da Cloud API",
      ready: diagnostics.missingRequirements.length === 0,
      detail: diagnostics.missingRequirements.length
        ? diagnostics.missingRequirements.join(", ")
        : "META_PHONE_NUMBER_ID, META_ACCESS_TOKEN, META_WEBHOOK_VERIFY_TOKEN e META_APP_SECRET ok.",
    },
    {
      key: "embedded_signup_env",
      label: "Configuracao do Embedded Signup / Coexistencia",
      ready: diagnostics.embeddedSignup.missingRequirements.length === 0,
      detail: diagnostics.embeddedSignup.missingRequirements.length
        ? diagnostics.embeddedSignup.missingRequirements.join(", ")
        : "App ID, Config ID, Redirect URI e flags de coexistencia ok.",
    },
    {
      key: "launch_url",
      label: "URL de inicio do Embedded Signup",
      ready: launchUrlReady,
      detail: launchUrlReady ? "Pronta para abrir no navegador." : "A URL ainda nao pode ser montada.",
    },
    {
      key: "callback_route",
      label: "Callback do onboarding",
      ready: Boolean(diagnostics.embeddedSignup.callbackUrl),
      detail: diagnostics.embeddedSignup.callbackUrl || "Callback ainda nao resolvido.",
    },
  ];

  return NextResponse.json({
    provider: "meta",
    appUrl: (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim(),
    webhookUrl: buildMetaWebhookUrl(),
    callbackUrl: buildMetaEmbeddedSignupCallbackUrl(),
    launchUrl,
    launchUrlReady,
    setupStatus: diagnostics.embeddedSignup.setupStatus,
    channelConfig,
    diagnostics,
    checklist,
    testSteps: [
      "Publicar o CRM em uma URL HTTPS e confirmar APP_URL.",
      "Aplicar o webhook da Meta no ambiente publico.",
      "Abrir o Embedded Signup pelo botao do CRM.",
      "Concluir o fluxo na Meta e voltar pelo callback.",
      "Conferir se o CRM capturou code, WABA ID e Phone Number ID.",
      "Se necessario, usar 'Concluir troca do code' para retry manual.",
      "Validar envio e recebimento reais no inbox.",
    ],
  });
}
