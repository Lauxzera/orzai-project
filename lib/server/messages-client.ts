import "server-only";

import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Conversation, Message, MessageCampaignMetaTemplate, MessagingConnectionState } from "@/lib/messages";
import { getMessageChannelConfig } from "@/lib/server/message-channel-config-store";
import {
  getStoredMessageById,
  listStoredConversations,
  listStoredMessages,
  markStoredConversationAsRead,
  storeInboundWebhookValue,
  storeOutboundMessage,
} from "@/lib/server/messages-store";

export type WhatsAppProvider = "meta";

export type WhatsAppConfig = {
  provider: WhatsAppProvider | null;
  configured: boolean;
  meta: {
    phoneNumberId: string;
    accessToken: string;
    webhookVerifyToken: string;
    appSecret: string;
  };
};

export type WhatsAppConfigDiagnostics = {
  provider: WhatsAppProvider | null;
  configured: boolean;
  webhookUrl: string;
  canSendMessages: boolean;
  phoneNumberIdConfigured: boolean;
  accessTokenConfigured: boolean;
  verifyTokenConfigured: boolean;
  appSecretConfigured: boolean;
  missingRequirements: string[];
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
};

export type MediaMessagePayload = {
  base64: string;
  mimeType: string;
  fileName: string | null;
  mediaType: string | null;
};

type SendMediaInput = {
  phone: string;
  media: string;
  mimeType: string;
  fileName: string;
  caption?: string;
  conversationId?: string;
};

type SendAudioInput = {
  phone: string;
  audio: string;
  mimeType: string;
  caption?: string;
  conversationId?: string;
};

type MetaMessagesApiResponse = {
  messages?: Array<{ id?: string }>;
};

type MetaMessageTemplatesApiResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    language?: string;
    status?: string;
    category?: string;
    components?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

type MetaMediaUploadResponse = {
  id?: string;
};

type MetaOAuthAccessTokenResponse = {
  access_token?: string;
  token_type?: string;
};

const META_GRAPH_VERSION = (process.env.META_GRAPH_API_VERSION || "v23.0").trim();

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function requiredMetaConfig(config: WhatsAppConfig) {
  if (!config.configured || config.provider !== "meta") {
    throw new Error(getWhatsAppUnavailableMessage(config));
  }
  return config.meta;
}

export function getMetaWhatsAppBusinessAccountId() {
  return (
    process.env.META_WABA_ID ||
    process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID ||
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ||
    ""
  ).trim();
}

function countTemplateBodyParameters(bodyText: string) {
  return new Set(Array.from(bodyText.matchAll(/\{\{\s*(\d+)\s*\}\}/g)).map((match) => match[1])).size;
}

function dataUrlToBuffer(input: string) {
  const match = input.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Formato de arquivo invalido para upload de media.");
  }
  return {
    mimeType: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}

/**
 * Erro estruturado da Graph API — preserva o "code" (ex.: 131047 = janela de
 * atendimento de 24h encerrada) em vez de só a mensagem em texto livre, para
 * que chamadores possam diferenciar "fora da janela" de qualquer outra falha.
 */
export class MetaApiError extends Error {
  code?: number;
  subcode?: number;

  constructor(message: string, code?: number, subcode?: number) {
    super(message);
    this.name = "MetaApiError";
    this.code = code;
    this.subcode = subcode;
  }
}

async function metaFetchJson<T>(config: WhatsAppConfig, path: string, init?: RequestInit) {
  const meta = requiredMetaConfig(config);
  const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${meta.accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = text
    ? (JSON.parse(text) as T & { error?: { message?: string; code?: number; error_subcode?: number } })
    : ({} as T & { error?: { message?: string; code?: number; error_subcode?: number } });
  if (!response.ok) {
    throw new MetaApiError(
      data?.error?.message || "Falha ao comunicar com a WhatsApp Business Platform.",
      data?.error?.code,
      data?.error?.error_subcode,
    );
  }
  return data as T;
}

async function uploadMetaMedia(config: WhatsAppConfig, input: { dataUrl: string; mimeType: string; fileName: string }) {
  const meta = requiredMetaConfig(config);
  const parsed = dataUrlToBuffer(input.dataUrl);
  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append("type", input.mimeType || parsed.mimeType);
  formData.append("file", new Blob([parsed.bytes], { type: input.mimeType || parsed.mimeType }), input.fileName);

  const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${meta.phoneNumberId}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${meta.accessToken}`,
    },
    body: formData,
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as MetaMediaUploadResponse & { error?: { message?: string } }) : {};
  if (!response.ok || !data.id) {
    throw new Error(data?.error?.message || "Nao foi possivel enviar a media para o WhatsApp.");
  }

  return data.id;
}

function buildConnectionState(config: WhatsAppConfig): MessagingConnectionState {
  const partiallyConfigured = config.provider === "meta";
  return {
    configured: config.configured,
    provider: config.provider,
    status: config.configured ? "online" : partiallyConfigured ? "waiting" : "offline",
    rawState: config.configured ? "cloud-api-configured" : partiallyConfigured ? "cloud-api-missing-config" : null,
    qrCode: null,
    pairingCode: null,
    instanceName: partiallyConfigured ? "WhatsApp Business Platform" : null,
    connectedPhone: null,
    connectedName: partiallyConfigured ? "Meta Cloud API" : null,
    managerUrl: null,
    updatedAt: new Date().toISOString(),
  };
}

export function getWhatsAppConfig(): WhatsAppConfig {
  const provider = ((process.env.WHATSAPP_PROVIDER ?? "").trim().toLowerCase() === "meta" ? "meta" : null) as
    | WhatsAppProvider
    | null;

  const meta = {
    phoneNumberId: (process.env.META_PHONE_NUMBER_ID ?? "").trim(),
    accessToken: (process.env.META_ACCESS_TOKEN ?? "").trim(),
    webhookVerifyToken: (process.env.META_WEBHOOK_VERIFY_TOKEN ?? "").trim(),
    appSecret: (process.env.META_APP_SECRET ?? "").trim(),
  };

  return {
    provider,
    configured: provider === "meta" && Boolean(meta.phoneNumberId && meta.accessToken && meta.webhookVerifyToken),
    meta,
  };
}

export async function getResolvedWhatsAppConfig(): Promise<WhatsAppConfig> {
  const envConfig = getWhatsAppConfig();

  try {
    const channelConfig = await getMessageChannelConfig();
    const linkedPhoneNumberId = (channelConfig.lastPhoneNumberId || "").trim();
    const linkedAccessToken = (channelConfig.linkedAccessToken || "").trim();

    if (!linkedPhoneNumberId && !linkedAccessToken) {
      return envConfig;
    }

    const meta = {
      ...envConfig.meta,
      phoneNumberId: linkedPhoneNumberId || envConfig.meta.phoneNumberId,
      accessToken: linkedAccessToken || envConfig.meta.accessToken,
    };

    return {
      provider: envConfig.provider,
      configured:
        envConfig.provider === "meta" &&
        Boolean(meta.phoneNumberId && meta.accessToken && meta.webhookVerifyToken && meta.appSecret),
      meta,
    };
  } catch {
    return envConfig;
  }
}

export function getWhatsAppUnavailableMessage(config: WhatsAppConfig = getWhatsAppConfig()) {
  if (config.provider === "meta") {
    const missingRequirements: string[] = [];
    if (!config.meta.phoneNumberId) missingRequirements.push("META_PHONE_NUMBER_ID");
    if (!config.meta.accessToken) missingRequirements.push("META_ACCESS_TOKEN");
    if (!config.meta.webhookVerifyToken) missingRequirements.push("META_WEBHOOK_VERIFY_TOKEN");
    if (!config.meta.appSecret) missingRequirements.push("META_APP_SECRET");
    if (!buildMetaWebhookUrl()) missingRequirements.push("APP_URL com HTTPS publico");
    if (missingRequirements.length > 0) {
      return `A integracao oficial da WhatsApp Business Platform ainda nao esta pronta neste ambiente. Pendencias: ${missingRequirements.join(", ")}.`;
    }
    return "A integracao oficial da WhatsApp Business Platform ainda nao esta configurada por completo neste ambiente.";
  }
  return "Nenhuma integracao oficial de WhatsApp foi configurada nesta instalacao.";
}

export function buildMetaWebhookUrl() {
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (!base) return "";
  return `${base}/api/webhooks/meta`;
}

export function buildMetaEmbeddedSignupCallbackUrl() {
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (!base) return "";
  // /auth/meta/callback is the URL registered in Meta Developers as OAuth Redirect URI.
  // Must match EXACTLY what is set in the Meta App configuration.
  return `${base}/auth/meta/callback`;
}

export async function exchangeMetaEmbeddedSignupCode(code: string) {
  const channelConfig = await getMessageChannelConfig();
  const appId = channelConfig.metaAppId.trim();
  const appSecret = (process.env.META_APP_SECRET || "").trim();
  const redirectUri = (channelConfig.redirectUri || buildMetaEmbeddedSignupCallbackUrl()).trim();

  if (!appId || !appSecret || !redirectUri) {
    throw new Error("Nao foi possivel trocar o code do Embedded Signup porque faltam APP ID, APP SECRET ou Redirect URI.");
  }

  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as MetaOAuthAccessTokenResponse & { error?: { message?: string } }) : {};
  if (!response.ok || !data.access_token) {
    throw new Error(data?.error?.message || "A Meta nao retornou um access token valido para o code de onboarding.");
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type || "bearer",
  };
}

export function maskMetaAccessToken(value: string) {
  if (!value) return "";
  if (value.length <= 10) return "********";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export async function buildMetaEmbeddedSignupLaunchUrl(stateToken: string) {
  const channelConfig = await getMessageChannelConfig();
  const appId = channelConfig.metaAppId.trim();
  const configId = channelConfig.metaAppConfigId.trim();
  const redirectUri = (channelConfig.redirectUri || buildMetaEmbeddedSignupCallbackUrl()).trim();

  if (!appId || !configId || !redirectUri) {
    throw new Error("A configuracao do Embedded Signup ainda nao esta completa para iniciar a coexistencia.");
  }

  const url = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", stateToken);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("override_default_response_type", "true");
  // business_management is deprecated/invalid for Embedded Signup flows.
  // Only whatsapp_business_management and whatsapp_business_messaging are required.
  url.searchParams.set("scope", "whatsapp_business_management,whatsapp_business_messaging");
  url.searchParams.set("config_id", configId);
  url.searchParams.set(
    "extras",
    JSON.stringify({
      setup: {
        solutionID: configId,
      },
      feature: "whatsapp_embedded_signup",
      featureType: "whatsapp_business_app_onboarding",
      sessionInfoVersion: 3,
    }),
  );

  return url.toString();
}

export async function getWhatsAppConfigDiagnostics(config: WhatsAppConfig = getWhatsAppConfig()): Promise<WhatsAppConfigDiagnostics> {
  const missingRequirements: string[] = [];
  const webhookUrl = buildMetaWebhookUrl();
  const phoneNumberIdConfigured = Boolean(config.meta.phoneNumberId);
  const accessTokenConfigured = Boolean(config.meta.accessToken);
  const verifyTokenConfigured = Boolean(config.meta.webhookVerifyToken);
  const appSecretConfigured = Boolean(config.meta.appSecret);

  if (!config.provider) {
    missingRequirements.push("definir WHATSAPP_PROVIDER=meta");
  }
  if (!phoneNumberIdConfigured) {
    missingRequirements.push("META_PHONE_NUMBER_ID");
  }
  if (!accessTokenConfigured) {
    missingRequirements.push("META_ACCESS_TOKEN");
  }
  if (!verifyTokenConfigured) {
    missingRequirements.push("META_WEBHOOK_VERIFY_TOKEN");
  }
  if (!appSecretConfigured) {
    missingRequirements.push("META_APP_SECRET");
  }
  if (!webhookUrl) {
    missingRequirements.push("APP_URL com HTTPS publico");
  }

  const channelConfig = await getMessageChannelConfig();
  const callbackUrl = buildMetaEmbeddedSignupCallbackUrl();
  const appIdConfigured = Boolean(channelConfig.metaAppId);
  const configIdConfigured = Boolean(channelConfig.metaAppConfigId);
  const redirectUriConfigured = Boolean(channelConfig.redirectUri || callbackUrl);
  const embeddedMissingRequirements: string[] = [];

  if (!channelConfig.embeddedSignupEnabled) {
    embeddedMissingRequirements.push("habilitar META_EMBEDDED_SIGNUP_ENABLED");
  }
  if (!channelConfig.coexistenceEnabled) {
    embeddedMissingRequirements.push("habilitar META_COEXISTENCE_ENABLED");
  }
  if (!appIdConfigured) {
    embeddedMissingRequirements.push("META_EMBEDDED_SIGNUP_APP_ID");
  }
  if (!configIdConfigured) {
    embeddedMissingRequirements.push("META_EMBEDDED_SIGNUP_CONFIG_ID");
  }
  if (!redirectUriConfigured) {
    embeddedMissingRequirements.push("APP_URL HTTPS publico ou META_EMBEDDED_SIGNUP_REDIRECT_URI");
  }

  const setupStatus: WhatsAppConfigDiagnostics["embeddedSignup"]["setupStatus"] =
    !channelConfig.embeddedSignupEnabled || !appIdConfigured || !configIdConfigured || !redirectUriConfigured
      ? "not-configured"
      : channelConfig.onboardingStatus === "linked"
        ? "linked"
        : channelConfig.onboardingStatus === "callback-received"
          ? "callback-received"
          : channelConfig.onboardingStatus === "awaiting-callback"
            ? "awaiting-callback"
            : "ready-to-start";

  return {
    provider: config.provider,
    configured: config.configured,
    webhookUrl,
    canSendMessages: config.configured,
    phoneNumberIdConfigured,
    accessTokenConfigured,
    verifyTokenConfigured,
    appSecretConfigured,
    missingRequirements,
    embeddedSignup: {
      enabled: channelConfig.embeddedSignupEnabled,
      coexistenceEnabled: channelConfig.coexistenceEnabled,
      setupStatus,
      appIdConfigured,
      configIdConfigured,
      redirectUriConfigured,
      callbackUrl,
      redirectUri: channelConfig.redirectUri || callbackUrl,
      lastEventType: channelConfig.lastEventType,
      lastCodeCaptured: Boolean(channelConfig.lastCode),
      lastWabaId: channelConfig.lastWabaId,
      lastPhoneNumberId: channelConfig.lastPhoneNumberId,
      businessTokenCaptured: Boolean(channelConfig.linkedAccessToken),
      linkedAt: channelConfig.linkedAt,
      missingRequirements: embeddedMissingRequirements,
    },
  };
}

export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null, config: WhatsAppConfig = getWhatsAppConfig()) {
  if (!config.meta.appSecret) return true;
  if (!signatureHeader) return false;

  const expected = `sha256=${createHmac("sha256", config.meta.appSecret).update(rawBody).digest("hex")}`;
  const left = Buffer.from(expected);
  const right = Buffer.from(signatureHeader);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function handleMetaWebhookPayload(payload: unknown) {
  const entries = Array.isArray((payload as { entry?: unknown[] })?.entry) ? (payload as { entry: unknown[] }).entry : [];

  for (const entry of entries) {
    const changes = Array.isArray((entry as { changes?: unknown[] })?.changes) ? (entry as { changes: unknown[] }).changes : [];
    for (const change of changes) {
      const value = ((change as { value?: unknown }).value ?? null) as import("@/lib/server/messages-store").MetaWebhookValue | null;
      if (!value) continue;
      const eventField = typeof (change as { field?: unknown }).field === "string" ? ((change as { field?: string }).field ?? "") : "";
      await storeInboundWebhookValue({
        ...value,
        eventField,
      });
    }
  }
}

export async function fetchConversationsFromAPI(config: WhatsAppConfig): Promise<Conversation[]> {
  void config;
  return listStoredConversations();
}

export async function fetchMessagesFromAPI(config: WhatsAppConfig, contactId: string): Promise<Message[]> {
  void config;
  return listStoredMessages(contactId);
}

export async function markConversationAsReadViaAPI(
  _config: WhatsAppConfig,
  contactId: string,
  _messages: Message[],
) {
  await markStoredConversationAsRead(contactId);
}

export async function sendMessageViaAPI(
  config: WhatsAppConfig,
  phone: string,
  content: string,
  conversationId?: string,
): Promise<Message> {
  const meta = requiredMetaConfig(config);
  const normalizedPhone = normalizePhone(phone);
  const response = await metaFetchJson<MetaMessagesApiResponse>(config, `/${meta.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone,
      type: "text",
      text: {
        preview_url: false,
        body: content,
      },
    }),
  });

  return storeOutboundMessage({
    conversationId: conversationId || normalizedPhone,
    phone: normalizedPhone,
    content,
    type: "text",
    status: "sent",
    externalMessageId: response.messages?.[0]?.id ?? null,
  });
}

export type SendTemplateInput = {
  phone: string;
  templateName: string;
  languageCode: string;
  bodyParams?: string[];
  conversationId?: string;
};

/**
 * Envia um Message Template aprovado pela Meta — unico tipo de mensagem
 * permitido fora da janela de atendimento de 24h (mensagem de texto livre so
 * funciona dentro dela). O template precisa existir e estar aprovado no Meta
 * Business Manager antes de ser usado aqui.
 */
export async function sendTemplateMessageViaAPI(config: WhatsAppConfig, input: SendTemplateInput): Promise<Message> {
  const meta = requiredMetaConfig(config);
  const normalizedPhone = normalizePhone(input.phone);
  const components = input.bodyParams?.length
    ? [{ type: "body", parameters: input.bodyParams.map((text) => ({ type: "text", text })) }]
    : undefined;

  const response = await metaFetchJson<MetaMessagesApiResponse>(config, `/${meta.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        ...(components ? { components } : {}),
      },
    }),
  });

  return storeOutboundMessage({
    conversationId: input.conversationId || normalizedPhone,
    phone: normalizedPhone,
    content: `[Template aprovado: ${input.templateName}]`,
    type: "text",
    status: "sent",
    externalMessageId: response.messages?.[0]?.id ?? null,
  });
}

export async function listMetaMessageTemplates(config: WhatsAppConfig): Promise<MessageCampaignMetaTemplate[]> {
  const wabaId = getMetaWhatsAppBusinessAccountId();
  if (!wabaId) {
    return [];
  }

  requiredMetaConfig(config);

  const response = await metaFetchJson<MetaMessageTemplatesApiResponse>(
    config,
    `/${wabaId}/message_templates?fields=id,name,language,status,category,components&limit=100`,
    { method: "GET" },
  );

  return (response.data ?? [])
    .map((template) => {
      const body = template.components?.find((component) => component.type?.toUpperCase() === "BODY");
      const bodyText = body?.text?.trim() || "";
      return {
        id: template.id,
        name: template.name?.trim() || "",
        language: template.language?.trim() || "pt_BR",
        status: template.status?.trim().toUpperCase() || "UNKNOWN",
        category: template.category?.trim().toUpperCase(),
        bodyText,
        parameterCount: countTemplateBodyParameters(bodyText),
      };
    })
    .filter((template) => template.name)
    .sort((first, second) => {
      if (first.status !== second.status) return first.status === "APPROVED" ? -1 : 1;
      return first.name.localeCompare(second.name, "pt-BR");
    });
}

export async function sendMediaViaAPI(config: WhatsAppConfig, input: SendMediaInput): Promise<Message> {
  const meta = requiredMetaConfig(config);
  const mediaId = await uploadMetaMedia(config, {
    dataUrl: input.media,
    mimeType: input.mimeType,
    fileName: input.fileName,
  });
  const normalizedPhone = normalizePhone(input.phone);
  const isImage = input.mimeType.startsWith("image/");
  const isVideo = input.mimeType.startsWith("video/");
  // WhatsApp Cloud API rejeita o envio se o "type" declarado no payload nao corresponder
  // ao tipo de midia detectado no upload (ex.: video enviado como "document" falha).
  const metaType = isImage ? "image" : isVideo ? "video" : "document";
  // Sem migracao no enum do banco (ChatMessageType nao tem "video"): guardamos como
  // "document" e usamos mimeType no front para renderizar o player de video inline.
  const storedType = isImage ? "image" : "document";

  const response = await metaFetchJson<MetaMessagesApiResponse>(config, `/${meta.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone,
      type: metaType,
      [metaType]: {
        id: mediaId,
        ...(metaType === "document" ? { filename: input.fileName } : {}),
        ...(input.caption ? { caption: input.caption } : {}),
      },
    }),
  });

  return storeOutboundMessage({
    conversationId: input.conversationId || normalizedPhone,
    phone: normalizedPhone,
    content: input.caption?.trim() || input.fileName,
    type: storedType,
    status: "sent",
    externalMessageId: response.messages?.[0]?.id ?? null,
    externalMediaId: mediaId,
    mimeType: input.mimeType,
    fileName: input.fileName,
  });
}

export async function sendAudioViaAPI(config: WhatsAppConfig, input: SendAudioInput): Promise<Message> {
  const meta = requiredMetaConfig(config);
  const mediaId = await uploadMetaMedia(config, {
    dataUrl: input.audio,
    mimeType: input.mimeType,
    fileName: `audio-${Date.now()}.ogg`,
  });
  const normalizedPhone = normalizePhone(input.phone);

  const response = await metaFetchJson<MetaMessagesApiResponse>(config, `/${meta.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedPhone,
      type: "audio",
      audio: {
        id: mediaId,
      },
    }),
  });

  return storeOutboundMessage({
    conversationId: input.conversationId || normalizedPhone,
    phone: normalizedPhone,
    content: input.caption?.trim() || "Audio enviado",
    type: "audio",
    status: "sent",
    externalMessageId: response.messages?.[0]?.id ?? null,
    externalMediaId: mediaId,
    mimeType: input.mimeType,
    fileName: "audio",
  });
}

export async function fetchConnectionState(config: WhatsAppConfig): Promise<MessagingConnectionState> {
  return buildConnectionState(config);
}

export async function fetchConnectionStateLite(config: WhatsAppConfig): Promise<MessagingConnectionState> {
  return buildConnectionState(config);
}

export async function logoutWhatsApp(config: WhatsAppConfig): Promise<void> {
  throw new Error(
    config.provider === "meta"
      ? "A Cloud API oficial nao possui desconexao por QR code neste CRM."
      : getWhatsAppUnavailableMessage(config),
  );
}

export async function requestQrCode(config: WhatsAppConfig): Promise<MessagingConnectionState> {
  throw new Error(
    config.provider === "meta"
      ? "A API oficial do WhatsApp nao usa QR Code neste CRM."
      : "Nao ha uma integracao de WhatsApp habilitada para gerar QR Code.",
  );
}

export async function fetchMediaMessagePayload(config: WhatsAppConfig, messageId: string): Promise<MediaMessagePayload> {
  const stored = await getStoredMessageById(messageId);
  if (!stored?.externalMediaId) {
    throw new Error("A media solicitada nao esta disponivel para este ambiente.");
  }

  const mediaInfo = await metaFetchJson<{ url?: string; mime_type?: string; file_size?: number }>(
    config,
    `/${stored.externalMediaId}`,
  );
  if (!mediaInfo.url) {
    throw new Error("Nao foi possivel localizar a URL da media no WhatsApp.");
  }

  const meta = requiredMetaConfig(config);
  const response = await fetch(mediaInfo.url, {
    headers: {
      Authorization: `Bearer ${meta.accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel baixar a media do WhatsApp.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    base64: buffer.toString("base64"),
    mimeType: stored.mimeType || mediaInfo.mime_type || "application/octet-stream",
    fileName: stored.fileName || null,
    mediaType: stored.type,
  };
}
