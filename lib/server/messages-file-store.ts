import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Conversation, Message, MessageStatus, MessageType } from "@/lib/messages";
import { ensureAutomaticLeadForWhatsappContact } from "@/lib/server/lead-auto-assign";

const STORE_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(STORE_DIR, "messages-store.json");

type StoredConversation = {
  contactPhone: string;
  contactName: string;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageDirection?: Message["direction"] | null;
  unreadCount: number;
  updatedAt: string;
  source?: string;
};

type StoredMessage = Message & {
  externalMessageId?: string | null;
  externalMediaId?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  sortIndex?: number;
};

type MessageStoreData = {
  conversations: Record<string, StoredConversation>;
  messages: Record<string, StoredMessage[]>;
};

type MetaWebhookContact = {
  wa_id?: string;
  profile?: { name?: string };
};

type MetaWebhookMessage = {
  id?: string;
  from?: string;
  to?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
  audio?: { id?: string; mime_type?: string };
  video?: { id?: string; mime_type?: string; caption?: string };
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
};

type MetaWebhookStatus = {
  id?: string;
  status?: string;
  errors?: Array<{
    code?: number;
    title?: string;
    message?: string;
    error_data?: { details?: string };
  }>;
};

export function describeWebhookStatusError(statusEvent: MetaWebhookStatus): string | null {
  const error = statusEvent.errors?.[0];
  if (!error) return null;
  const detail = error.error_data?.details?.trim();
  const title = error.title?.trim() || error.message?.trim();
  const parts = [title, detail].filter(Boolean);
  const reason = parts.length > 0 ? parts.join(" - ") : "Falha ao entregar a mensagem.";
  return error.code ? `[${error.code}] ${reason}` : reason;
}

export type MetaWebhookValue = {
  eventField?: string;
  contacts?: MetaWebhookContact[];
  messages?: MetaWebhookMessage[];
  statuses?: MetaWebhookStatus[];
};

let writeQueue = Promise.resolve();

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export function buildConversationId(phone: string) {
  return normalizePhone(phone);
}

function messageTimestampToIso(timestamp: string | undefined) {
  const numeric = Number(timestamp || "0");
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return new Date().toISOString();
  }
  return new Date(numeric * 1000).toISOString();
}

function toRenderableMediaUrl(messageId: string, externalMediaId?: string | null) {
  if (!externalMediaId) return undefined;
  return `meta-media://${messageId}`;
}

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function normalizeWebhookMessageType(type: string | undefined) {
  if (!type) return "text";
  if (type.startsWith("smb_message_echoes.")) {
    return type.slice("smb_message_echoes.".length);
  }
  return type;
}

function mapMessageType(message: MetaWebhookMessage): MessageType {
  const normalizedType = normalizeWebhookMessageType(message.type);
  if (normalizedType === "image") return "image";
  if (normalizedType === "audio") return "audio";
  // Video nao tem tipo dedicado no enum do banco; tratamos como "document" e o front
  // detecta o player de video pelo mimeType (sem precisar de migracao no schema).
  if (normalizedType === "document" || normalizedType === "video") return "document";
  return "text";
}

function buildMessageContent(message: MetaWebhookMessage) {
  const normalizedType = normalizeWebhookMessageType(message.type);
  if (normalizedType === "text") return message.text?.body?.trim() ?? "";
  if (normalizedType === "image") return message.image?.caption?.trim() ?? "";
  if (normalizedType === "video") return message.video?.caption?.trim() ?? "";
  if (normalizedType === "document") return message.document?.caption?.trim() || message.document?.filename?.trim() || "";
  return "";
}

function isCoexistenceEchoMessage(message: MetaWebhookMessage, eventField?: string) {
  return eventField === "smb_message_echoes" || message.type?.startsWith("smb_message_echoes.") === true;
}

function mapStoredConversation(id: string, data: Partial<StoredConversation>): Conversation | null {
  if (!data.contactPhone || !data.contactName || !data.lastMessageAt) {
    return null;
  }

  return {
    id,
    contactPhone: data.contactPhone,
    contactName: data.contactName,
    lastMessage: data.lastMessage ?? "",
    lastMessageAt: data.lastMessageAt,
    lastMessageDirection: data.lastMessageDirection ?? null,
    unreadCount: typeof data.unreadCount === "number" ? data.unreadCount : 0,
    leadId: null,
    leadStatus: null,
    ownerName: null,
  };
}

function mapStoredMessage(id: string, data: Partial<StoredMessage>): StoredMessage | null {
  if (!data.conversationId || !data.direction || !data.type || !data.status || !data.timestamp) {
    return null;
  }

  return {
    id,
    conversationId: data.conversationId,
    direction: data.direction,
    type: data.type,
    content: data.content ?? "",
    mediaUrl: data.mediaUrl,
    status: data.status,
    timestamp: data.timestamp,
    externalMessageId: data.externalMessageId ?? null,
    externalMediaId: data.externalMediaId ?? null,
    mimeType: data.mimeType ?? null,
    fileName: data.fileName ?? null,
    statusError: data.statusError ?? null,
    sortIndex: typeof data.sortIndex === "number" ? data.sortIndex : undefined,
  };
}

function compareMessages(a: Message, b: Message) {
  return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
}

function compareConversations(a: Conversation, b: Conversation) {
  return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
}

function toConversationPatch(message: Message, contactPhone: string, contactName: string, unreadCount: number): StoredConversation {
  return {
    contactPhone,
    contactName: contactName || contactPhone,
    lastMessage: message.content,
    lastMessageAt: message.timestamp,
    lastMessageDirection: message.direction,
    unreadCount: Math.max(0, unreadCount),
    updatedAt: new Date().toISOString(),
    source: "meta",
  };
}

async function ensureStore() {
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.mkdir(STORE_DIR, { recursive: true });
    const initialState: MessageStoreData = { conversations: {}, messages: {} };
    await fs.writeFile(STORE_FILE, JSON.stringify(initialState, null, 2), "utf8");
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  try {
    return JSON.parse(raw) as MessageStoreData;
  } catch {
    const fallback: MessageStoreData = { conversations: {}, messages: {} };
    await fs.writeFile(STORE_FILE, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

async function mutateStore(mutator: (store: MessageStoreData) => MessageStoreData | Promise<MessageStoreData>) {
  writeQueue = writeQueue.then(async () => {
    const current = await readStore();
    const next = await mutator(current);
    await fs.writeFile(STORE_FILE, JSON.stringify(next, null, 2), "utf8");
  });
  await writeQueue;
  return readStore();
}

export async function exportLegacyMessageStoreSnapshot() {
  const conversations = await listStoredConversationsFromFile();
  const messages = await Promise.all(
    conversations.map(async (conversation) => ({
      conversationId: conversation.id,
      messages: await listStoredMessagesFromFile(conversation.id),
    })),
  );
  return { conversations, messages };
}

export async function listStoredConversationsFromFile() {
  const store = await readStore();
  return Object.entries(store.conversations)
    .map(([id, data]) => mapStoredConversation(id, data))
    .filter((item): item is Conversation => Boolean(item))
    .sort(compareConversations);
}

export async function listStoredMessagesFromFile(conversationId: string) {
  const store = await readStore();
  return (store.messages[conversationId] ?? [])
    .map((item) => mapStoredMessage(item.id, item))
    .filter((item): item is StoredMessage => Boolean(item))
    .sort(compareMessages);
}

export async function getStoredMessageByIdFromFile(messageId: string) {
  const store = await readStore();
  for (const messages of Object.values(store.messages)) {
    const found = messages.find((message) => message.externalMessageId === messageId || message.id === messageId);
    if (found) {
      return mapStoredMessage(found.id, found);
    }
  }
  return null;
}

export async function markStoredConversationAsReadInFile(conversationId: string) {
  await mutateStore((store) => {
    const current = store.conversations[conversationId];
    if (!current) return store;
    store.conversations[conversationId] = {
      ...current,
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
    };
    return store;
  });
}

export async function setStoredConversationUnreadCountInFile(conversationId: string, unreadCount: number) {
  await mutateStore((store) => {
    const current = store.conversations[conversationId];
    if (!current) return store;
    store.conversations[conversationId] = {
      ...current,
      unreadCount: Math.max(0, Math.trunc(unreadCount)),
      updatedAt: new Date().toISOString(),
    };
    return store;
  });
}

export async function storeOutboundMessageInFile(input: {
  conversationId: string;
  phone: string;
  contactName?: string | null;
  content: string;
  type: MessageType;
  status?: MessageStatus;
  externalMessageId?: string | null;
  externalMediaId?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
}) {
  const conversationId = buildConversationId(input.conversationId || input.phone);
  const timestamp = new Date().toISOString();
  const messageId = input.externalMessageId || `out-${Date.now()}`;
  const message: StoredMessage = {
    id: messageId,
    conversationId,
    direction: "outbound",
    type: input.type,
    content: input.content,
    mediaUrl: toRenderableMediaUrl(messageId, input.externalMediaId),
    status: input.status ?? "sent",
    timestamp,
    externalMessageId: input.externalMessageId ?? messageId,
    externalMediaId: input.externalMediaId ?? null,
    mimeType: input.mimeType ?? null,
    fileName: input.fileName ?? null,
    sortIndex: new Date(timestamp).getTime(),
  };

  await mutateStore((store) => {
    const currentConversation = store.conversations[conversationId];
    const currentUnread = currentConversation ? Number(currentConversation.unreadCount ?? 0) : 0;
    const currentName = currentConversation?.contactName ?? "";
    const nextMessages = [...(store.messages[conversationId] ?? []).filter((item) => item.id !== message.id), withoutUndefined(message)];
    nextMessages.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
    store.messages[conversationId] = nextMessages;
    store.conversations[conversationId] = toConversationPatch(
      message,
      normalizePhone(input.phone),
      (input.contactName ?? currentName) || normalizePhone(input.phone),
      currentUnread,
    );
    return store;
  });

  return message satisfies Message;
}

export async function storeInboundWebhookValueInFile(value: MetaWebhookValue) {
  const contacts = value.contacts ?? [];
  const messages = value.messages ?? [];

  for (const message of messages) {
    const isEcho = isCoexistenceEchoMessage(message, value.eventField);
    const contactPhone = normalizePhone(isEcho ? message.to : message.from);
    if (!contactPhone || !message.id) continue;

    const conversationId = buildConversationId(contactPhone);
    const contact = contacts.find((item) => normalizePhone(item.wa_id) === contactPhone) ?? contacts[0] ?? null;
    const contactName = contact?.profile?.name?.trim() || contact?.wa_id || contactPhone;
    const timestamp = messageTimestampToIso(message.timestamp);
    const type = mapMessageType(message);
    const content = buildMessageContent(message);
    const externalMediaId =
      message.image?.id?.trim() ||
      message.audio?.id?.trim() ||
      message.video?.id?.trim() ||
      message.document?.id?.trim() ||
      null;
    const mimeType =
      message.image?.mime_type?.trim() ||
      message.audio?.mime_type?.trim() ||
      message.video?.mime_type?.trim() ||
      message.document?.mime_type?.trim() ||
      null;
    const fileName = message.document?.filename?.trim() || null;

    const storedMessage: StoredMessage = {
      id: message.id,
      conversationId,
      direction: isEcho ? "outbound" : "inbound",
      type,
      content,
      mediaUrl: toRenderableMediaUrl(message.id, externalMediaId),
      status: isEcho ? "sent" : "delivered",
      timestamp,
      externalMessageId: message.id,
      externalMediaId,
      mimeType,
      fileName,
      sortIndex: new Date(timestamp).getTime(),
    };

    await mutateStore((store) => {
      const currentConversation = store.conversations[conversationId];
      const currentUnread = currentConversation ? Number(currentConversation.unreadCount ?? 0) : 0;
      const currentName = currentConversation?.contactName ?? "";
      const nextMessages = [
        ...(store.messages[conversationId] ?? []).filter((item) => item.id !== storedMessage.id),
        withoutUndefined(storedMessage),
      ];
      nextMessages.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
      store.messages[conversationId] = nextMessages;
      store.conversations[conversationId] = toConversationPatch(
        storedMessage,
        contactPhone,
        contactName || currentName || contactPhone,
        isEcho ? currentUnread : currentUnread + 1,
      );
      return store;
    });

    if (!isEcho) {
      await ensureAutomaticLeadForWhatsappContact(contactPhone, contactName);
    }
  }

  for (const statusEvent of value.statuses ?? []) {
    if (!statusEvent.id) continue;
    await updateStoredMessageStatusInFile(statusEvent.id, statusEvent.status, describeWebhookStatusError(statusEvent));
  }
}

export async function updateStoredMessageStatusInFile(
  externalMessageId: string,
  nextStatus: string | undefined,
  statusError?: string | null,
) {
  if (nextStatus === "failed") {
    await mutateStore((store) => {
      for (const [conversationId, messages] of Object.entries(store.messages)) {
        const updated = messages.map((message) =>
          message.externalMessageId === externalMessageId || message.id === externalMessageId
            ? { ...message, statusError: statusError ?? "A WhatsApp Business Platform reportou falha na entrega desta mensagem." }
            : message,
        );
        store.messages[conversationId] = updated;
      }
      return store;
    });
    return;
  }

  const normalizedStatus: MessageStatus =
    nextStatus === "read" ? "read" : nextStatus === "delivered" ? "delivered" : "sent";

  await mutateStore((store) => {
    for (const [conversationId, messages] of Object.entries(store.messages)) {
      const updated = messages.map((message) =>
        message.externalMessageId === externalMessageId || message.id === externalMessageId
          ? { ...message, status: normalizedStatus, statusError: null }
          : message,
      );
      store.messages[conversationId] = updated;
    }
    return store;
  });
}
