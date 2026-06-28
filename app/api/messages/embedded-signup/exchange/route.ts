import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { encryptToken } from "@/lib/server/encryption";
import { getMessageChannelConfig, updateMessageChannelConfig } from "@/lib/server/message-channel-config-store";
import { exchangeMetaEmbeddedSignupCode, maskMetaAccessToken } from "@/lib/server/messages-client";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Sem permissao para concluir a vinculacao do WhatsApp." }, { status: 403 });
  }

  const current = await getMessageChannelConfig();
  if (!current.lastCode) {
    return NextResponse.json({ error: "Nenhum code de onboarding foi armazenado no CRM." }, { status: 400 });
  }

  try {
    const exchanged = await exchangeMetaEmbeddedSignupCode(current.lastCode);
    const next = await updateMessageChannelConfig({
      onboardingStatus:
        current.lastWabaId && current.lastPhoneNumberId ? "linked" : "callback-received",
      lastEventType: "embedded-signup-code-exchanged-manually",
      lastEventPayload: {
        retriedBy: user.username,
        retriedAt: new Date().toISOString(),
        tokenExchangeSucceeded: true,
        tokenType: exchanged.tokenType,
        businessTokenMasked: maskMetaAccessToken(exchanged.accessToken),
        wabaId: current.lastWabaId || undefined,
        phoneNumberId: current.lastPhoneNumberId || undefined,
        businessAccountId: current.lastBusinessAccountId || undefined,
      },
      linkedAccessToken: encryptToken(exchanged.accessToken),
      linkedTokenType: exchanged.tokenType,
      linkedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      onboardingStatus: next.onboardingStatus,
      channelConfig: next,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel trocar o code do onboarding.";
    const next = await updateMessageChannelConfig({
      onboardingStatus: current.lastCode ? "callback-received" : current.onboardingStatus,
      lastEventType: "embedded-signup-code-exchange-failed-manually",
      lastEventPayload: {
        retriedBy: user.username,
        retriedAt: new Date().toISOString(),
        tokenExchangeSucceeded: false,
        tokenExchangeError: message,
        wabaId: current.lastWabaId || undefined,
        phoneNumberId: current.lastPhoneNumberId || undefined,
        businessAccountId: current.lastBusinessAccountId || undefined,
      },
      linkedAccessToken: null,
      linkedTokenType: null,
      linkedAt: null,
    });

    return NextResponse.json(
      {
        error: message,
        onboardingStatus: next.onboardingStatus,
        channelConfig: next,
      },
      { status: 400 },
    );
  }
}
