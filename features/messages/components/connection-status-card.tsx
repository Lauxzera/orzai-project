"use client";

import * as React from "react";
import { AlertCircle, LoaderCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MessagingConnectionState } from "@/lib/messages";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// FB SDK types
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    FB?: {
      init: (params: Record<string, unknown>) => void;
      login: (callback: (response: FBLoginResponse) => void, params: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type FBLoginResponse = {
  authResponse?: {
    code?: string;
    accessToken?: string;
  };
  status?: string;
};

type WaEmbeddedSignupData = {
  type: string;
  event: string;
  data?: {
    phone_number_id?: string;
    waba_id?: string;
    business_id?: string;
    error_message?: string;
  };
};

type SignupData = {
  business_id?: string;
  waba_id: string;
  phone_number_id: string;
};

type InstallStatus = "idle" | "waiting-code" | "waiting-signup" | "installing" | "connected" | "error" | "cancelled";

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------
type Props = {
  connection: MessagingConnectionState | null;
  connectionDebug: {
    provider: string | null;
    webhookUrl: string;
    missingRequirements: string[];
    phoneNumberIdConfigured: boolean;
    accessTokenConfigured: boolean;
    verifyTokenConfigured: boolean;
    appSecretConfigured: boolean;
    embeddedSignup: {
      enabled: boolean;
      coexistenceEnabled: boolean;
      setupStatus: "not-configured" | "ready-to-start" | "awaiting-callback" | "callback-received" | "linked";
      appIdConfigured: boolean;
      configIdConfigured: boolean;
      redirectUriConfigured: boolean;
      callbackUrl: string;
      redirectUri: string;
      lastEventType: string | null;
      lastCodeCaptured: boolean;
      lastWabaId: string | null;
      lastPhoneNumberId: string | null;
      businessTokenCaptured: boolean;
      linkedAt: string | null;
      missingRequirements: string[];
    };
  } | null;
  statusMeta: {
    label: string;
    hint: string;
    badge: "success" | "gold" | "danger";
    icon: "online" | "waiting" | "offline";
  };
  loading: boolean;
  qrLoading: boolean;
  disconnectLoading: boolean;
  webhookLoading: boolean;
  embeddedSignupLoading: boolean;
  embeddedSignupExchangeLoading: boolean;
  webhookMessage: string;
  isAdmin: boolean;
  onRefresh: () => void;
  onGenerateQrCode: () => void;
  onDisconnect: () => void;
  onConfigureWebhook: () => void;
  onStartEmbeddedSignup: () => void;
  onExchangeEmbeddedSignupCode: () => void;
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function StatusIcon({ status }: { status: "online" | "waiting" | "offline" }) {
  if (status === "online") return <Wifi className="h-3 w-3" />;
  if (status === "waiting") return <RefreshCw className="h-3 w-3 animate-spin" />;
  return <WifiOff className="h-3 w-3" />;
}

function statusLabel(status: InstallStatus, hasCode: boolean, hasSignup: boolean): string {
  if (status === "connected") return "WhatsApp vinculado com sucesso!";
  if (status === "installing") return "Instalando integração do WhatsApp...";
  if (status === "error") return "";
  if (status === "cancelled") return "Embedded Signup cancelado.";
  if (hasCode && !hasSignup) return "Código de autorização recebido. Aguardando dados do WhatsApp...";
  if (!hasCode && hasSignup) return "Dados do WhatsApp recebidos. Aguardando código de autorização da Meta...";
  return "";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ConnectionStatusCard({
  connection,
  connectionDebug,
  statusMeta,
  loading,
  qrLoading,
  disconnectLoading,
  webhookLoading,
  embeddedSignupLoading,
  embeddedSignupExchangeLoading,
  webhookMessage,
  isAdmin,
  onRefresh,
  onGenerateQrCode,
  onDisconnect,
  onConfigureWebhook,
  onStartEmbeddedSignup,
  onExchangeEmbeddedSignupCode,
}: Props) {
  void qrLoading;
  void disconnectLoading;
  void webhookLoading;
  void isAdmin;
  void onGenerateQrCode;
  void onDisconnect;

  // ----- FB SDK state -----
  const [fbSdkLoaded, setFbSdkLoaded] = React.useState(false);
  const [installStatus, setInstallStatus] = React.useState<InstallStatus>("idle");
  const [installError, setInstallError] = React.useState<string | null>(null);
  const [successInfo, setSuccessInfo] = React.useState<{ waba_id: string; phone_number_id: string } | null>(null);

  // ----- Refs to avoid stale closure issues -----
  const authCodeRef = React.useRef<string | null>(null);
  const signupDataRef = React.useRef<SignupData | null>(null);
  const installInProgressRef = React.useRef(false);
  const installCompletedRef = React.useRef(false);
  const messageListenerRef = React.useRef<((e: MessageEvent) => void) | null>(null);

  // ----- Load FB SDK -----
  React.useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID || "";
    if (!appId) {
      console.warn("[Meta][SDK] NEXT_PUBLIC_META_APP_ID não configurado — SDK não será carregado.");
      return;
    }

    if (document.getElementById("facebook-jssdk")) {
      if (window.FB) {
        setFbSdkLoaded(true);
      }
      return;
    }

    window.fbAsyncInit = function () {
      window.FB?.init({
        appId,
        version: process.env.NEXT_PUBLIC_META_GRAPH_API_VERSION || "v23.0",
        xfbml: true,
        cookie: true,
      });
      console.log("[Meta][SDK carregado] appId:", appId);
      setFbSdkLoaded(true);
    };

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  // ----- Cleanup message listener on unmount -----
  React.useEffect(() => {
    return () => {
      if (messageListenerRef.current) {
        window.removeEventListener("message", messageListenerRef.current);
        messageListenerRef.current = null;
      }
    };
  }, []);

  // ----- Core install function (uses refs — safe to call from any callback) -----
  async function tryInstallWhatsApp() {
    const code = authCodeRef.current;
    const signupData = signupDataRef.current;

    if (!code) {
      console.log("[Meta][tryInstall] Aguardando authorization code...");
      return;
    }
    if (!signupData?.waba_id || !signupData?.phone_number_id) {
      console.log("[Meta][tryInstall] Aguardando dados do WA_EMBEDDED_SIGNUP...");
      return;
    }
    if (installInProgressRef.current || installCompletedRef.current) {
      console.log("[Meta][tryInstall] Instalação já em andamento ou concluída — ignorando.");
      return;
    }

    installInProgressRef.current = true;
    setInstallStatus("installing");
    setInstallError(null);

    const payload = {
      code,
      business_id: signupData.business_id,
      waba_id: signupData.waba_id,
      phone_number_id: signupData.phone_number_id,
    };

    console.log("[Meta][tryInstall] Chamando /api/whatsapp/install", {
      hasCode: true,
      waba_id: payload.waba_id,
      phone_number_id: payload.phone_number_id,
    });

    try {
      const res = await fetch("/api/whatsapp/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string; waba_id?: string; phone_number_id?: string };

      if (!res.ok || !data.ok) {
        const msg = data.error || "Erro ao instalar WhatsApp.";
        console.error("[WhatsApp][Erro ao instalar]", data);
        setInstallError(msg);
        setInstallStatus("error");
        return;
      }

      console.log("[WhatsApp][Instalação concluída]", { waba_id: data.waba_id, phone_number_id: data.phone_number_id });
      installCompletedRef.current = true;
      setSuccessInfo({ waba_id: data.waba_id || signupData.waba_id, phone_number_id: data.phone_number_id || signupData.phone_number_id });
      setInstallStatus("connected");
    } catch (err) {
      console.error("[WhatsApp][Erro inesperado na instalação]", err);
      setInstallError("Erro de rede ao instalar WhatsApp.");
      setInstallStatus("error");
    } finally {
      installInProgressRef.current = false;
      // Remove message listener after completion
      if (messageListenerRef.current) {
        window.removeEventListener("message", messageListenerRef.current);
        messageListenerRef.current = null;
      }
    }
  }

  // ----- Message event handler (WA_EMBEDDED_SIGNUP) -----
  function buildMessageHandler() {
    return function onEmbeddedSignupMessage(event: MessageEvent) {
      const allowedOrigins = ["https://www.facebook.com", "https://web.facebook.com", "https://business.facebook.com"];
      const isAllowed = allowedOrigins.includes(event.origin) || event.origin.endsWith(".facebook.com");
      if (!isAllowed) return;

      let data: WaEmbeddedSignupData;
      try {
        data = (typeof event.data === "string" ? JSON.parse(event.data) : event.data) as WaEmbeddedSignupData;
      } catch {
        return;
      }

      if (data?.type !== "WA_EMBEDDED_SIGNUP") return;

      console.log("[Meta][WA_EMBEDDED_SIGNUP event]", data);

      if (data.event === "FINISH" || data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
        const wabaId = data.data?.waba_id || "";
        const phoneNumberId = data.data?.phone_number_id || "";
        const businessId = data.data?.business_id;

        if (!wabaId || !phoneNumberId) {
          console.error("[Meta][Dados incompletos do Embedded Signup]", data.data);
          setInstallError("O Embedded Signup finalizou, mas não retornou waba_id ou phone_number_id.");
          setInstallStatus("error");
          return;
        }

        signupDataRef.current = { business_id: businessId, waba_id: wabaId, phone_number_id: phoneNumberId };
        console.log("[Meta][signupData salvo]", signupDataRef.current);
        void tryInstallWhatsApp();
      } else if (data.event === "ERROR") {
        console.error("[Meta][Erro no Embedded Signup]", data.data);
        setInstallError(data.data?.error_message || "Erro no Embedded Signup. Verifique o console.");
        setInstallStatus("error");
      } else if (data.event === "CANCEL") {
        console.warn("[Meta][Usuário cancelou o Embedded Signup]");
        setInstallStatus("cancelled");
      }
    };
  }

  // ----- Button click handler -----
  function handleFbConnect() {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID;

    if (!appId) {
      setInstallError("NEXT_PUBLIC_META_APP_ID não configurado.");
      return;
    }
    if (!configId) {
      setInstallError("NEXT_PUBLIC_META_CONFIG_ID não configurado.");
      return;
    }
    if (!window.FB) {
      setInstallError("SDK do Facebook ainda não carregou. Aguarde e tente novamente.");
      return;
    }

    // Reset state for new attempt
    authCodeRef.current = null;
    signupDataRef.current = null;
    installInProgressRef.current = false;
    installCompletedRef.current = false;
    setInstallStatus("idle");
    setInstallError(null);
    setSuccessInfo(null);

    // Remove any previous listener
    if (messageListenerRef.current) {
      window.removeEventListener("message", messageListenerRef.current);
    }
    const handler = buildMessageHandler();
    messageListenerRef.current = handler;
    window.addEventListener("message", handler);

    console.log("[Meta][Iniciando Embedded Signup]", { configId });

    window.FB.login(
      function (response: FBLoginResponse) {
        console.log("[Meta][FB.login response]", response);

        const code = response?.authResponse?.code;

        if (code) {
          console.log("[Meta][Authorization code recebido]", code);
          authCodeRef.current = code;
          setInstallStatus((prev) => (prev === "idle" ? "waiting-signup" : prev));
          void tryInstallWhatsApp();
        } else {
          console.error("[Meta][Nenhum authorization code recebido]", response);

          let message: string;
          if (response?.status === "unknown") {
            message =
              "O popup de login da Meta foi fechado ou bloqueado antes da autorização. Verifique se pop-ups estão liberados e se este domínio está cadastrado em App Domains / Site URL no app da Meta.";
          } else if (response?.status === "not_authorized") {
            message =
              "Login feito, mas o app não foi autorizado. Verifique se o usuário tem papel (Admin/Developer/Tester) no app da Meta e se as permissões whatsapp_business_management e whatsapp_business_messaging estão liberadas.";
          } else if (response?.status === "connected") {
            message =
              "A Meta concluiu o login (status connected) mas não devolveu o authorization code. Verifique se NEXT_PUBLIC_META_CONFIG_ID aponta para uma configuração de Facebook Login for Business do tipo WhatsApp Embedded Signup (whatsapp_business_app_onboarding) com response_type=code habilitado.";
          } else {
            message =
              "A Meta não retornou o código de autorização. Verifique config_id, response_type, override_default_response_type e permissões do app.";
          }

          setInstallError(message);
          setInstallStatus("error");
          if (messageListenerRef.current) {
            window.removeEventListener("message", messageListenerRef.current);
            messageListenerRef.current = null;
          }
        }
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          sessionInfoVersion: "3",
          featureType: "whatsapp_business_app_onboarding",
        },
      },
    );
  }

  // ----- Render helpers -----
  const isOnline = connection?.status === "online";
  const hasCode = Boolean(authCodeRef.current);
  const hasSignup = Boolean(signupDataRef.current);
  const progressLabel = statusLabel(installStatus, hasCode, hasSignup);

  const requirements = [
    { label: "WHATSAPP_PROVIDER=meta", ready: connectionDebug?.provider === "meta" },
    { label: "META_PHONE_NUMBER_ID", ready: Boolean(connectionDebug?.phoneNumberIdConfigured) },
    { label: "META_ACCESS_TOKEN", ready: Boolean(connectionDebug?.accessTokenConfigured) },
    { label: "META_WEBHOOK_VERIFY_TOKEN", ready: Boolean(connectionDebug?.verifyTokenConfigured) },
    { label: "META_APP_SECRET", ready: Boolean(connectionDebug?.appSecretConfigured) },
    { label: "APP_URL HTTPS", ready: Boolean(connectionDebug?.webhookUrl) },
  ];
  const embeddedRequirements = [
    { label: "META_EMBEDDED_SIGNUP_ENABLED", ready: Boolean(connectionDebug?.embeddedSignup.enabled) },
    { label: "META_COEXISTENCE_ENABLED", ready: Boolean(connectionDebug?.embeddedSignup.coexistenceEnabled) },
    { label: "NEXT_PUBLIC_META_APP_ID", ready: Boolean(process.env.NEXT_PUBLIC_META_APP_ID) },
    { label: "NEXT_PUBLIC_META_CONFIG_ID", ready: Boolean(process.env.NEXT_PUBLIC_META_CONFIG_ID) },
    { label: "META_EMBEDDED_SIGNUP_APP_ID (backend)", ready: Boolean(connectionDebug?.embeddedSignup.appIdConfigured) },
    { label: "Redirect URI / Callback", ready: Boolean(connectionDebug?.embeddedSignup.redirectUriConfigured) },
  ];

  const connectButtonLabel = () => {
    if (installStatus === "installing") return "Instalando...";
    if (installStatus === "connected") return "Conectado";
    if (connectionDebug?.embeddedSignup.setupStatus === "linked") return "WhatsApp vinculado";
    return "Conectar WhatsApp";
  };

  return (
    <>
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <span className="text-sm font-semibold">Mensagens</span>
        <div className="flex items-center gap-1.5">
          <Badge variant={statusMeta.badge} className="gap-1.5 px-2 py-1 text-[10px]">
            <StatusIcon status={statusMeta.icon} />
            {statusMeta.label}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Recarregar conversas"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="border-b px-2.5 py-2.5">
        <div className="rounded-xl border p-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Canal WhatsApp</p>
              <p className="mt-1 text-sm font-semibold">
                {connection?.provider === "meta" ? "WhatsApp Business Platform" : "Sem integracao ativa"}
              </p>
              {isOnline && connection?.connectedPhone ? (
                <p className="mt-0.5 text-xs text-muted-foreground">+{connection.connectedPhone}</p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">{statusMeta.hint}</p>
            </div>
          </div>

          {!connection?.configured ? (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                O inbox oficial da Meta ja esta preparado no CRM, mas este ambiente ainda precisa concluir a
                configuracao para liberar envio e validacao publica do webhook.
              </span>
            </div>
          ) : null}

          {connectionDebug ? (
            <div className="mt-3 rounded-lg border bg-muted/35 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Checklist da Cloud API
              </p>
              <div className="mt-2 grid gap-1.5">
                {requirements.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-foreground/85">{item.label}</span>
                    <span className={item.ready ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                      {item.ready ? "ok" : "pendente"}
                    </span>
                  </div>
                ))}
              </div>
              {connectionDebug.webhookUrl ? (
                <p className="mt-2 break-all text-[10px] leading-relaxed text-muted-foreground">
                  Webhook publico esperado: {connectionDebug.webhookUrl}
                </p>
              ) : null}
            </div>
          ) : null}

          {connectionDebug?.embeddedSignup ? (
            <div className="mt-3 rounded-lg border bg-muted/35 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Conectar WhatsApp Business
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Conecte um número já usado no WhatsApp Business App à API oficial da Meta via Embedded Signup com Coexistence.
              </p>

              {connection?.configured ? (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    O envio e recebimento de mensagens via Cloud API já está ativo e o número já funciona em
                    coexistência com o WhatsApp Business App / Web. Este botão é opcional e serve apenas para
                    re-vincular o número via Embedded Signup — a Meta pode bloquear esse fluxo com a mensagem
                    &quot;Embedded signup is only available for BSPs or TPs&quot;, o que não afeta o funcionamento
                    atual do WhatsApp no CRM.
                  </span>
                </div>
              ) : null}

              <div className="mt-2 grid gap-1.5">
                {embeddedRequirements.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-foreground/85">{item.label}</span>
                    <span className={item.ready ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                      {item.ready ? "ok" : "pendente"}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-2 text-[11px] text-muted-foreground">
                Status: {connectionDebug.embeddedSignup.setupStatus}
              </p>

              {connectionDebug.embeddedSignup.lastEventType ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Ultimo evento: {connectionDebug.embeddedSignup.lastEventType}
                </p>
              ) : null}
              {connectionDebug.embeddedSignup.lastCodeCaptured ? (
                <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                  Codigo de onboarding ja recebido pelo CRM.
                </p>
              ) : null}
              {connectionDebug.embeddedSignup.businessTokenCaptured ? (
                <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                  Token operacional da coexistencia ja capturado pelo backend.
                </p>
              ) : null}
              {connectionDebug.embeddedSignup.lastWabaId || connectionDebug.embeddedSignup.lastPhoneNumberId ? (
                <p className="mt-1 break-all text-[10px] text-muted-foreground">
                  WABA: {connectionDebug.embeddedSignup.lastWabaId || "pendente"} · Phone ID:{" "}
                  {connectionDebug.embeddedSignup.lastPhoneNumberId || "pendente"}
                </p>
              ) : null}
              {connectionDebug.embeddedSignup.linkedAt ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Vinculado em: {connectionDebug.embeddedSignup.linkedAt}
                </p>
              ) : null}

              {/* ---- Main action buttons ---- */}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={handleFbConnect}
                  disabled={
                    installStatus === "installing" ||
                    installStatus === "connected" ||
                    !fbSdkLoaded ||
                    connectionDebug.embeddedSignup.setupStatus === "linked"
                  }
                >
                  {installStatus === "installing" ? (
                    <>
                      <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Instalando
                    </>
                  ) : (
                    connectButtonLabel()
                  )}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={onStartEmbeddedSignup}
                  disabled={
                    embeddedSignupLoading ||
                    connectionDebug.embeddedSignup.missingRequirements.length > 0 ||
                    connectionDebug.embeddedSignup.setupStatus === "linked"
                  }
                >
                  {embeddedSignupLoading ? (
                    <>
                      <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Iniciando
                    </>
                  ) : connectionDebug.embeddedSignup.setupStatus === "linked" ? (
                    "Coexistencia vinculada"
                  ) : (
                    "Iniciar via backend"
                  )}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onConfigureWebhook}
                  disabled={webhookLoading}
                >
                  {webhookLoading ? (
                    <>
                      <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Aplicando webhook
                    </>
                  ) : (
                    "Aplicar webhook"
                  )}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onExchangeEmbeddedSignupCode}
                  disabled={
                    embeddedSignupExchangeLoading ||
                    !connectionDebug.embeddedSignup.lastCodeCaptured ||
                    connectionDebug.embeddedSignup.setupStatus === "linked"
                  }
                >
                  {embeddedSignupExchangeLoading ? (
                    <>
                      <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Trocando code
                    </>
                  ) : (
                    "Concluir troca do code"
                  )}
                </Button>
              </div>

              {/* ---- Status messages ---- */}
              {progressLabel ? (
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{progressLabel}</p>
              ) : null}

              {installStatus === "connected" && successInfo ? (
                <p className="mt-2 text-[10px] leading-relaxed text-emerald-600 dark:text-emerald-400">
                  WhatsApp vinculado! WABA: {successInfo.waba_id} · Phone ID: {successInfo.phone_number_id}
                </p>
              ) : null}

              {installError ? (
                <div className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-red-600 dark:text-red-400">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{installError}</span>
                </div>
              ) : null}

              {!fbSdkLoaded && process.env.NEXT_PUBLIC_META_APP_ID ? (
                <p className="mt-2 text-[10px] text-muted-foreground">Carregando SDK do Facebook...</p>
              ) : null}
              {!process.env.NEXT_PUBLIC_META_APP_ID ? (
                <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400">
                  NEXT_PUBLIC_META_APP_ID não configurado — botão desabilitado.
                </p>
              ) : null}
            </div>
          ) : null}

          {webhookMessage ? (
            <p className="mt-2 break-all text-[10px] leading-relaxed text-muted-foreground">{webhookMessage}</p>
          ) : null}

          {loading ? (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Atualizando status do canal.
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
