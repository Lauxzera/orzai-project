import "server-only";

import { getSessionUser } from "@/lib/server/auth";
import { encryptToken } from "@/lib/server/encryption";
import { createLogger } from "@/lib/server/logger";
import { exchangeMetaEmbeddedSignupCode } from "@/lib/server/messages-client";
import { updateMessageChannelConfig } from "@/lib/server/message-channel-config-store";

const logger = createLogger("whatsapp/install");

type InstallBody = {
  code: string;
  business_id?: string;
  waba_id: string;
  phone_number_id: string;
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
  }

  if (!process.env.META_APP_SECRET) {
    logger.error("META_APP_SECRET não configurado no servidor", undefined, { userId: user.id });
    return Response.json({ error: "META_APP_SECRET não configurado no servidor." }, { status: 500 });
  }

  let body: Partial<InstallBody> = {};
  try {
    body = (await request.json()) as Partial<InstallBody>;
  } catch {
    return Response.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const { code, waba_id, phone_number_id, business_id } = body;

  logger.info("payload recebido", {
    hasCode: Boolean(code),
    business_id,
    waba_id,
    phone_number_id,
  });

  if (!code || !waba_id || !phone_number_id) {
    return Response.json(
      {
        error: "Os campos code, waba_id e phone_number_id são obrigatórios.",
        received: {
          hasCode: Boolean(code),
          hasWabaId: Boolean(waba_id),
          hasPhoneNumberId: Boolean(phone_number_id),
        },
      },
      { status: 400 },
    );
  }

  logger.info("trocando code por token");

  let accessToken: string;
  let tokenType: string;

  try {
    const exchanged = await exchangeMetaEmbeddedSignupCode(code);
    accessToken = exchanged.accessToken;
    tokenType = exchanged.tokenType;
    logger.info("token recebido com sucesso", { hasAccessToken: Boolean(accessToken), tokenType });
  } catch (err) {
    logger.error("falha na troca do token", err, { userId: user.id });
    const message = err instanceof Error ? err.message : "Erro ao trocar o code pelo token.";
    return Response.json({ error: message }, { status: 502 });
  }

  let encryptedToken: string;
  try {
    encryptedToken = encryptToken(accessToken);
  } catch (err) {
    logger.error("falha na criptografia do token", err, { userId: user.id });
    const message = err instanceof Error ? err.message : "Erro ao criptografar o token.";
    return Response.json({ error: message }, { status: 500 });
  }

  const linkedAt = new Date().toISOString();

  await updateMessageChannelConfig({
    linkedAccessToken: encryptedToken,
    linkedTokenType: tokenType,
    linkedAt,
    lastWabaId: waba_id,
    lastPhoneNumberId: phone_number_id,
    lastBusinessAccountId: business_id || undefined,
    onboardingStatus: "linked",
    lastEventType: "install-api-linked",
    lastEventPayload: {
      installedBy: user.username,
      installedAt: linkedAt,
      waba_id,
      phone_number_id,
      business_id,
    },
  });

  logger.info("instalação concluída", { waba_id, phone_number_id, linkedAt, userId: user.id });

  // NEVER return access_token to frontend
  return Response.json({ ok: true, waba_id, phone_number_id, linked_at: linkedAt });
}
