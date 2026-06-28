import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { getMessageChannelConfig, updateMessageChannelConfig } from "@/lib/server/message-channel-config-store";
import { buildMetaEmbeddedSignupLaunchUrl, getResolvedWhatsAppConfig, getWhatsAppConfigDiagnostics } from "@/lib/server/messages-client";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Sem permissao para iniciar o Embedded Signup." }, { status: 403 });
  }

  const [channelConfig, diagnostics] = await Promise.all([
    getMessageChannelConfig(),
    getResolvedWhatsAppConfig().then((config) => getWhatsAppConfigDiagnostics(config)),
  ]);

  if (diagnostics.embeddedSignup.missingRequirements.length > 0) {
    return NextResponse.json(
      {
        error: `O Embedded Signup ainda nao pode ser iniciado. Pendencias: ${diagnostics.embeddedSignup.missingRequirements.join(", ")}.`,
        missingRequirements: diagnostics.embeddedSignup.missingRequirements,
      },
      { status: 400 },
    );
  }

  const stateToken = `belart-meta-${randomUUID()}`;
  const launchUrl = await buildMetaEmbeddedSignupLaunchUrl(stateToken);

  const nextConfig = await updateMessageChannelConfig({
    onboardingStatus: "awaiting-callback",
    lastEventType: "embedded-signup-started",
    lastEventPayload: {
      state: stateToken,
      startedBy: user.username,
      startedAt: new Date().toISOString(),
      appId: channelConfig.metaAppId,
      configId: channelConfig.metaAppConfigId,
    },
    lastCode: null,
    lastWabaId: null,
    lastPhoneNumberId: null,
    lastBusinessAccountId: null,
    linkedAccessToken: null,
    linkedTokenType: null,
    linkedAt: null,
  });

  return NextResponse.json({
    ok: true,
    launchUrl,
    stateToken,
    channelConfig: nextConfig,
  });
}
