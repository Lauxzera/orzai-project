import "server-only";

/**
 * Shared handler for WhatsApp Embedded Signup OAuth callbacks.
 * Used by both:
 *   - /auth/meta/callback          (registered in Meta Developers as OAuth Redirect URI)
 *   - /api/messages/embedded-signup/callback  (internal legacy route)
 *
 * The access token is ALWAYS encrypted before being stored in the database.
 */

import { encryptToken } from "@/lib/server/encryption";
import { getMessageChannelConfig, updateMessageChannelConfig } from "@/lib/server/message-channel-config-store";
import { exchangeMetaEmbeddedSignupCode, maskMetaAccessToken } from "@/lib/server/messages-client";

function html(message: string, details: string) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Base CRM - WhatsApp Embedded Signup</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f4f7fb; color: #1f3043; padding: 32px; }
      .card { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #d8e1ec; border-radius: 16px; padding: 24px; box-shadow: 0 12px 30px rgba(31,48,67,.08); }
      h1 { margin: 0 0 12px; font-size: 22px; }
      p { line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${message}</h1>
      <p>${details}</p>
    </div>
  </body>
</html>`;
}

export type CallbackParams = {
  code: string;
  state: string;
  wabaId: string;
  phoneNumberId: string;
  businessAccountId: string;
  error: string;
  errorReason: string;
  errorDescription: string;
};

export async function handleMetaOAuthCallback(params: CallbackParams): Promise<Response> {
  const { code, state, wabaId, phoneNumberId, businessAccountId, error, errorReason, errorDescription } = params;

  // --- State mismatch check ---
  const previousConfig = await getMessageChannelConfig();
  const expectedState =
    previousConfig.lastEventPayload &&
    typeof previousConfig.lastEventPayload === "object" &&
    typeof previousConfig.lastEventPayload.state === "string"
      ? previousConfig.lastEventPayload.state
      : "";

  if (state && expectedState && state !== expectedState) {
    await updateMessageChannelConfig({
      onboardingStatus: "awaiting-callback",
      lastEventType: "embedded-signup-callback-state-mismatch",
      lastEventPayload: { receivedState: state, expectedState, codePresent: Boolean(code), wabaId, phoneNumberId, businessAccountId },
    });

    return new Response(
      html("Callback recebido com state invalido",
        "O CRM recebeu o retorno da Meta, mas o identificador de seguranca do fluxo nao bateu com a sessao iniciada. Reinicie o Embedded Signup."),
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 },
    );
  }

  // --- OAuth error from Meta ---
  if (error) {
    await updateMessageChannelConfig({
      onboardingStatus: "awaiting-callback",
      lastEventType: "embedded-signup-error",
      lastEventPayload: { error, errorReason, errorDescription, state },
    });

    return new Response(
      html("Fluxo de coexistencia interrompido",
        `A Meta retornou um erro: ${error}. Revise a configuracao do app e da conta WhatsApp antes de tentar novamente.`),
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 },
    );
  }

  // --- Token exchange ---
  let tokenExchangeSucceeded = false;
  let maskedToken = "";
  let tokenType = "";
  let tokenExchangeError = "";

  if (code) {
    try {
      const exchanged = await exchangeMetaEmbeddedSignupCode(code);
      tokenExchangeSucceeded = true;
      maskedToken = maskMetaAccessToken(exchanged.accessToken);
      tokenType = exchanged.tokenType;

      // SECURITY: encrypt before storing — never save plaintext access token
      let encryptedToken: string;
      try {
        encryptedToken = encryptToken(exchanged.accessToken);
      } catch {
        // If ENCRYPTION_SECRET is not set, fall back to masking to avoid data loss
        // but log a warning — this should never happen in production
        console.error("[whatsapp-callback] ENCRYPTION_SECRET nao configurado — token NAO foi salvo. Configure ENCRYPTION_SECRET.");
        tokenExchangeSucceeded = false;
        tokenExchangeError = "ENCRYPTION_SECRET nao configurado no servidor. O token nao pode ser armazenado com seguranca.";
        encryptedToken = "";
      }

      if (encryptedToken) {
        await updateMessageChannelConfig({
          linkedAccessToken: encryptedToken,
          linkedTokenType: tokenType,
          linkedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      tokenExchangeError = err instanceof Error ? err.message : "Nao foi possivel trocar o code por token.";
      console.error("[whatsapp-callback] Erro na troca do token:", tokenExchangeError);
    }
  }

  // --- Final status update ---
  await updateMessageChannelConfig({
    onboardingStatus:
      tokenExchangeSucceeded && wabaId && phoneNumberId ? "linked"
      : code ? "callback-received"
      : "awaiting-callback",
    lastEventType: code
      ? tokenExchangeSucceeded ? "embedded-signup-code-exchanged" : "embedded-signup-code-exchange-failed"
      : "embedded-signup-callback-empty",
    lastEventPayload: {
      state,
      codePresent: Boolean(code),
      tokenExchangeSucceeded,
      tokenType,
      businessTokenMasked: maskedToken || undefined,
      tokenExchangeError: tokenExchangeError || undefined,
      wabaId,
      phoneNumberId,
      businessAccountId,
    },
    lastCode: code || undefined,
    lastWabaId: wabaId || undefined,
    lastPhoneNumberId: phoneNumberId || undefined,
    lastBusinessAccountId: businessAccountId || undefined,
    linkedAccessToken: tokenExchangeSucceeded ? undefined : null,
    linkedTokenType: tokenExchangeSucceeded ? undefined : null,
    linkedAt: tokenExchangeSucceeded ? new Date().toISOString() : null,
  });

  return new Response(
    html(
      "Callback recebido pelo CRM",
      code
        ? tokenExchangeSucceeded
          ? "O CRM recebeu o retorno do Embedded Signup e concluiu a troca do code com seguranca. Revise se os IDs foram capturados para confirmar a vinculacao completa."
          : `O CRM recebeu o retorno do Embedded Signup, mas a troca do code falhou. Motivo: ${tokenExchangeError || "erro nao identificado"}.`
        : "Callback OAuth da Meta ativo no CRM. No fluxo via JavaScript SDK (popup), o authorization code e capturado pelo FB.login() e nao por este redirect.",
    ),
    { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 200 },
  );
}

export function extractCallbackParamsFromUrl(url: URL): CallbackParams {
  return {
    code: url.searchParams.get("code")?.trim() || "",
    state: url.searchParams.get("state")?.trim() || "",
    wabaId: url.searchParams.get("waba_id")?.trim() || "",
    phoneNumberId: url.searchParams.get("phone_number_id")?.trim() || "",
    businessAccountId: url.searchParams.get("business_account_id")?.trim() || "",
    error: url.searchParams.get("error")?.trim() || "",
    errorReason: url.searchParams.get("error_reason")?.trim() || "",
    errorDescription: url.searchParams.get("error_description")?.trim() || "",
  };
}

export async function extractCallbackParamsFromRequest(request: Request): Promise<CallbackParams> {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, string>;
      return {
        code: body.code?.trim() || "",
        state: body.state?.trim() || "",
        wabaId: body.waba_id?.trim() || "",
        phoneNumberId: body.phone_number_id?.trim() || "",
        businessAccountId: body.business_account_id?.trim() || "",
        error: body.error?.trim() || "",
        errorReason: body.error_reason?.trim() || "",
        errorDescription: body.error_description?.trim() || "",
      };
    }
    const form = await request.formData();
    return {
      code: (form.get("code") as string | null)?.trim() || "",
      state: (form.get("state") as string | null)?.trim() || "",
      wabaId: (form.get("waba_id") as string | null)?.trim() || "",
      phoneNumberId: (form.get("phone_number_id") as string | null)?.trim() || "",
      businessAccountId: (form.get("business_account_id") as string | null)?.trim() || "",
      error: (form.get("error") as string | null)?.trim() || "",
      errorReason: (form.get("error_reason") as string | null)?.trim() || "",
      errorDescription: (form.get("error_description") as string | null)?.trim() || "",
    };
  } catch {
    return { code: "", state: "", wabaId: "", phoneNumberId: "", businessAccountId: "", error: "", errorReason: "", errorDescription: "" };
  }
}
