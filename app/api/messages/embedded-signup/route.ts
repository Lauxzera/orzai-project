import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { getMessageChannelConfig, updateMessageChannelConfig, type MessageChannelConfig } from "@/lib/server/message-channel-config-store";
import { buildMetaEmbeddedSignupCallbackUrl, getResolvedWhatsAppConfig, getWhatsAppConfigDiagnostics } from "@/lib/server/messages-client";

/**
 * Strips sensitive fields from channelConfig before returning to non-admin users.
 * linkedAccessToken (encrypted token), lastCode (OAuth code) and lastEventPayload
 * must never be exposed to SALES or VIEWER roles.
 */
function sanitizeChannelConfig(config: MessageChannelConfig, role: string): Partial<MessageChannelConfig> {
  const isPrivileged = role === "ADMIN" || role === "MANAGER";
  if (isPrivileged) {
    // Still never send the raw encrypted token or OAuth code to the frontend
    return {
      ...config,
      linkedAccessToken: config.linkedAccessToken ? "[encrypted]" : null,
      lastCode: undefined,
    };
  }
  // SALES / VIEWER get only operational status fields
  return {
    id: config.id,
    provider: config.provider,
    mode: config.mode,
    embeddedSignupEnabled: config.embeddedSignupEnabled,
    coexistenceEnabled: config.coexistenceEnabled,
    onboardingStatus: config.onboardingStatus,
    linkedAt: config.linkedAt,
    updatedAt: config.updatedAt,
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const [channelConfig, diagnostics] = await Promise.all([
    getMessageChannelConfig(),
    getResolvedWhatsAppConfig().then((config) => getWhatsAppConfigDiagnostics(config)),
  ]);

  return NextResponse.json({
    provider: "meta",
    callbackUrl: buildMetaEmbeddedSignupCallbackUrl(),
    channelConfig: sanitizeChannelConfig(channelConfig, user.role),
    embeddedSignup: diagnostics.embeddedSignup,
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Sem permissao para configurar o onboarding do WhatsApp." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    embeddedSignupEnabled?: boolean;
    coexistenceEnabled?: boolean;
    metaAppId?: string;
    metaAppConfigId?: string;
    redirectUri?: string;
    onboardingStatus?: "not-started" | "ready" | "awaiting-callback" | "callback-received" | "linked";
    eventType?: string;
    eventPayload?: Record<string, unknown>;
    lastCode?: string;
    lastWabaId?: string;
    lastPhoneNumberId?: string;
    lastBusinessAccountId?: string;
  };

  const next = await updateMessageChannelConfig({
    embeddedSignupEnabled: body.embeddedSignupEnabled,
    coexistenceEnabled: body.coexistenceEnabled,
    metaAppId: body.metaAppId?.trim(),
    metaAppConfigId: body.metaAppConfigId?.trim(),
    redirectUri: body.redirectUri?.trim(),
    onboardingStatus: body.onboardingStatus,
    lastEventType: body.eventType?.trim(),
    lastEventPayload: body.eventPayload,
    lastCode: body.lastCode?.trim(),
    lastWabaId: body.lastWabaId?.trim(),
    lastPhoneNumberId: body.lastPhoneNumberId?.trim(),
    lastBusinessAccountId: body.lastBusinessAccountId?.trim(),
  });

  const diagnostics = await getResolvedWhatsAppConfig().then((config) => getWhatsAppConfigDiagnostics(config));
  return NextResponse.json({
    ok: true,
    channelConfig: sanitizeChannelConfig(next, user.role),
    embeddedSignup: diagnostics.embeddedSignup,
  });
}
