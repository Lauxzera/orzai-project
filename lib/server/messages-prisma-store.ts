import "server-only";

import type { Conversation, Message, MessageStatus, MessageType } from "@/lib/messages";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";
import { ensureAutomaticLeadForWhatsappContact } from "@/lib/server/lead-auto-assign";
import type { MetaWebhookValue } from "@/lib/server/messages-file-store";
import { buildConversationId, describeWebhookStatusError, exportLegacyMessageStoreSnapshot } from "@/lib/server/messages-file-store";
import {
  ChatMessageDirection,
  ChatMessageStatus,
  ChatMessageType,
  Prisma,
} from "@/lib/generated/prisma/client";

type StoredMessage = Message & {
  externalMessageId?: string | null;
  externalMediaId?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
};

type AnalyticsStoredMessage = Pick<Message, "id" | "conversationId" | "direction" | "timestamp">;

type StoredMessagesPage = {
  messages: StoredMessage[];
  hasMore: boolean;
  nextCursor: string | null;
};

let bootstrapPromise: Promise<void> | null = null;

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
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

function mapMessageType(type: string | undefined): MessageType {
  const normalizedType = normalizeWebhookMessageType(type);
  if (normalizedType === "image") return "image";
  if (normalizedType === "audio") return "audio";
  // Video nao tem tipo dedicado no enum do banco; tratamos como "document" e o front
  // detecta o player de video pelo mimeType (sem precisar de migracao no schema).
  if (normalizedType === "document" || normalizedType === "video") return "document";
  return "text";
}

function buildMessageContent(message: NonNullable<MetaWebhookValue["messages"]>[number]) {
  const normalizedType = normalizeWebhookMessageType(message.type);
  if (normalizedType === "text") return message.text?.body?.trim() ?? "";
  if (normalizedType === "image") return message.image?.caption?.trim() ?? "";
  if (normalizedType === "video") return message.video?.caption?.trim() ?? "";
  if (normalizedType === "document") return message.document?.caption?.trim() || message.document?.filename?.trim() || "";
  return "";
}

function normalizeWebhookMessageType(type: string | undefined) {
  if (!type) return "text";
  if (type.startsWith("smb_message_echoes.")) {
    return type.slice("smb_message_echoes.".length);
  }
  return type;
}

function isCoexistenceEchoMessage(message: NonNullable<MetaWebhookValue["messages"]>[number], eventField?: string) {
  return eventField === "smb_message_echoes" || message.type?.startsWith("smb_message_echoes.") === true;
}

function toPrismaDirection(direction: Message["direction"]) {
  return direction === "inbound" ? ChatMessageDirection.inbound : ChatMessageDirection.outbound;
}

function fromPrismaDirection(direction: ChatMessageDirection): Message["direction"] {
  return direction === ChatMessageDirection.inbound ? "inbound" : "outbound";
}

function toPrismaType(type: MessageType) {
  switch (type) {
    case "image":
      return ChatMessageType.image;
    case "audio":
      return ChatMessageType.audio;
    case "document":
      return ChatMessageType.document;
    default:
      return ChatMessageType.text;
  }
}

function fromPrismaType(type: ChatMessageType): MessageType {
  switch (type) {
    case ChatMessageType.image:
      return "image";
    case ChatMessageType.audio:
      return "audio";
    case ChatMessageType.document:
      return "document";
    default:
      return "text";
  }
}

function toPrismaStatus(status: MessageStatus) {
  switch (status) {
    case "read":
      return ChatMessageStatus.read;
    case "delivered":
      return ChatMessageStatus.delivered;
    default:
      return ChatMessageStatus.sent;
  }
}

function fromPrismaStatus(status: ChatMessageStatus): MessageStatus {
  switch (status) {
    case ChatMessageStatus.read:
      return "read";
    case ChatMessageStatus.delivered:
      return "delivered";
    default:
      return "sent";
  }
}

function compareMessages(a: Message, b: Message) {
  return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
}

function compareConversations(a: Conversation, b: Conversation) {
  return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
}

function mapConversation(record: {
  id: string;
  contactPhone: string;
  contactName: string;
  lastMessage: string;
  lastMessageAt: Date;
  lastMessageDirection: ChatMessageDirection | null;
  unreadCount: number;
}) {
  return {
    id: record.id,
    contactPhone: record.contactPhone,
    contactName: record.contactName,
    lastMessage: record.lastMessage,
    lastMessageAt: record.lastMessageAt.toISOString(),
    lastMessageDirection: record.lastMessageDirection ? fromPrismaDirection(record.lastMessageDirection) : null,
    unreadCount: record.unreadCount,
    leadId: null,
    leadStatus: null,
    ownerName: null,
  } satisfies Conversation;
}

function mapStoredMessage(record: {
  id: string;
  conversationId: string;
  direction: ChatMessageDirection;
  type: ChatMessageType;
  content: string;
  mediaUrl: string | null;
  status: ChatMessageStatus;
  statusError?: string | null;
  timestamp: Date;
  externalMessageId: string | null;
  externalMediaId: string | null;
  mimeType: string | null;
  fileName: string | null;
}) {
  return {
    id: record.id,
    conversationId: record.conversationId,
    direction: fromPrismaDirection(record.direction),
    type: fromPrismaType(record.type),
    content: record.content,
    mediaUrl: record.mediaUrl ?? undefined,
    status: fromPrismaStatus(record.status),
    statusError: record.statusError ?? null,
    timestamp: record.timestamp.toISOString(),
    externalMessageId: record.externalMessageId,
    externalMediaId: record.externalMediaId,
    mimeType: record.mimeType,
    fileName: record.fileName,
  } satisfies StoredMessage;
}

async function ensurePrismaBootstrap() {
  if (bootstrapPromise) {
    await bootstrapPromise;
    return;
  }

  bootstrapPromise = (async () => {
    const prisma = getPrismaClient();
    const count = await prisma.messageConversation.count();
    if (count > 0) {
      return;
    }

    let snapshot: Awaited<ReturnType<typeof exportLegacyMessageStoreSnapshot>>;
    try {
      snapshot = await exportLegacyMessageStoreSnapshot();
    } catch {
      return;
    }
    if (!snapshot.conversations.length) {
      return;
    }

    for (const conversation of snapshot.conversations) {
      await prisma.messageConversation.upsert({
        where: { id: conversation.id },
        update: {
          contactPhone: conversation.contactPhone,
          contactName: conversation.contactName,
          lastMessage: conversation.lastMessage,
          lastMessageAt: new Date(conversation.lastMessageAt),
          lastMessageDirection: conversation.lastMessageDirection ? toPrismaDirection(conversation.lastMessageDirection) : null,
          unreadCount: conversation.unreadCount,
          source: "legacy-file",
        },
        create: {
          id: conversation.id,
          contactPhone: conversation.contactPhone,
          contactName: conversation.contactName,
          lastMessage: conversation.lastMessage,
          lastMessageAt: new Date(conversation.lastMessageAt),
          lastMessageDirection: conversation.lastMessageDirection ? toPrismaDirection(conversation.lastMessageDirection) : null,
          unreadCount: conversation.unreadCount,
          source: "legacy-file",
        },
      });
    }

    for (const bundle of snapshot.messages) {
      for (const message of bundle.messages) {
        await prisma.messageRecord.upsert({
          where: { id: message.id },
          update: {
            conversationId: message.conversationId,
            direction: toPrismaDirection(message.direction),
            type: toPrismaType(message.type),
            content: message.content,
            mediaUrl: message.mediaUrl ?? null,
            status: toPrismaStatus(message.status),
            timestamp: new Date(message.timestamp),
            externalMessageId: message.externalMessageId ?? null,
            externalMediaId: message.externalMediaId ?? null,
            mimeType: message.mimeType ?? null,
            fileName: message.fileName ?? null,
          },
          create: {
            id: message.id,
            conversationId: message.conversationId,
            direction: toPrismaDirection(message.direction),
            type: toPrismaType(message.type),
            content: message.content,
            mediaUrl: message.mediaUrl ?? null,
            status: toPrismaStatus(message.status),
            timestamp: new Date(message.timestamp),
            externalMessageId: message.externalMessageId ?? null,
            externalMediaId: message.externalMediaId ?? null,
            mimeType: message.mimeType ?? null,
            fileName: message.fileName ?? null,
          },
        });
      }
    }
  })();

  await bootstrapPromise;
}

export async function listStoredConversationsFromPrisma() {
  await ensurePrismaBootstrap();
  const prisma = getPrismaClient();
  const conversations = await prisma.messageConversation.findMany({
    orderBy: { lastMessageAt: "desc" },
  });
  return conversations.map(mapConversation).sort(compareConversations);
}

export async function listStoredMessagesFromPrisma(conversationId: string) {
  await ensurePrismaBootstrap();
  const prisma = getPrismaClient();
  const messages = await prisma.messageRecord.findMany({
    where: { conversationId },
    orderBy: [{ timestamp: "asc" }, { createdAt: "asc" }],
  });
  return messages.map(mapStoredMessage).sort(compareMessages);
}

export async function listStoredMessagesPageFromPrisma(
  conversationId: string,
  options?: { limit?: number; before?: string | null },
): Promise<StoredMessagesPage> {
  await ensurePrismaBootstrap();
  const prisma = getPrismaClient();
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const before = options?.before ? new Date(options.before) : null;

  const messages = await prisma.messageRecord.findMany({
    where: {
      conversationId,
      ...(before ? { timestamp: { lt: before } } : {}),
    },
    orderBy: [{ timestamp: "desc" }, { createdAt: "desc" }],
    take: limit + 1,
  });

  const hasMore = messages.length > limit;
  const pageItems = hasMore ? messages.slice(0, limit) : messages;
  const ordered = pageItems.map(mapStoredMessage).reverse();

  return {
    messages: ordered,
    hasMore,
    nextCursor: ordered[0]?.timestamp ?? null,
  };
}

export async function findStoredConversationByIdOrPhoneFromPrisma(contactId: string) {
  await ensurePrismaBootstrap();
  const prisma = getPrismaClient();
  const normalizedPhone = normalizePhone(contactId);
  const conversation = await prisma.messageConversation.findFirst({
    where: {
      OR: [
        { id: contactId },
        ...(normalizedPhone ? [{ contactPhone: normalizedPhone }] : []),
      ],
    },
    orderBy: { lastMessageAt: "desc" },
  });
  return conversation ? mapConversation(conversation) : null;
}

export async function listStoredAnalyticsMessagesFromPrisma(
  conversationIds: string[],
  sinceIso?: string | null,
): Promise<Record<string, AnalyticsStoredMessage[]>> {
  await ensurePrismaBootstrap();
  if (!conversationIds.length) return {};

  const prisma = getPrismaClient();
  const rows = await prisma.messageRecord.findMany({
    where: {
      conversationId: { in: conversationIds },
      ...(sinceIso ? { timestamp: { gte: new Date(sinceIso) } } : {}),
    },
    select: {
      id: true,
      conversationId: true,
      direction: true,
      timestamp: true,
    },
    orderBy: [{ conversationId: "asc" }, { timestamp: "asc" }, { createdAt: "asc" }],
  });

  const grouped: Record<string, AnalyticsStoredMessage[]> = {};
  for (const row of rows) {
    (grouped[row.conversationId] ||= []).push({
      id: row.id,
      conversationId: row.conversationId,
      direction: fromPrismaDirection(row.direction),
      timestamp: row.timestamp.toISOString(),
    });
  }

  return grouped;
}

export async function getStoredMessageByIdFromPrisma(messageId: string) {
  await ensurePrismaBootstrap();
  const prisma = getPrismaClient();
  const message = await prisma.messageRecord.findFirst({
    where: {
      OR: [{ id: messageId }, { externalMessageId: messageId }],
    },
  });
  return message ? mapStoredMessage(message) : null;
}

export async function markStoredConversationAsReadInPrisma(conversationId: string) {
  await ensurePrismaBootstrap();
  const prisma = getPrismaClient();
  await prisma.messageConversation.updateMany({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  });
}

export async function setStoredConversationUnreadCountInPrisma(conversationId: string, unreadCount: number) {
  await ensurePrismaBootstrap();
  const prisma = getPrismaClient();
  await prisma.messageConversation.updateMany({
    where: { id: conversationId },
    data: { unreadCount: Math.max(0, Math.trunc(unreadCount)) },
  });
}

export async function storeOutboundMessageInPrisma(input: {
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
  await ensurePrismaBootstrap();
  const prisma = getPrismaClient();
  const conversationId = buildConversationId(input.conversationId || input.phone);
  const timestamp = new Date();
  const messageId = input.externalMessageId || `out-${Date.now()}`;

  const message = await prisma.$transaction(async (tx) => {
    const currentConversation = await tx.messageConversation.findUnique({ where: { id: conversationId } });
    const currentUnread = currentConversation?.unreadCount ?? 0;
    const currentName = currentConversation?.contactName ?? "";

    const saved = await tx.messageRecord.upsert({
      where: { id: messageId },
      update: {
        conversationId,
        direction: ChatMessageDirection.outbound,
        type: toPrismaType(input.type),
        content: input.content,
        mediaUrl: toRenderableMediaUrl(messageId, input.externalMediaId),
        status: toPrismaStatus(input.status ?? "sent"),
        timestamp,
        externalMessageId: input.externalMessageId ?? messageId,
        externalMediaId: input.externalMediaId ?? null,
        mimeType: input.mimeType ?? null,
        fileName: input.fileName ?? null,
      },
      create: {
        id: messageId,
        conversationId,
        direction: ChatMessageDirection.outbound,
        type: toPrismaType(input.type),
        content: input.content,
        mediaUrl: toRenderableMediaUrl(messageId, input.externalMediaId),
        status: toPrismaStatus(input.status ?? "sent"),
        timestamp,
        externalMessageId: input.externalMessageId ?? messageId,
        externalMediaId: input.externalMediaId ?? null,
        mimeType: input.mimeType ?? null,
        fileName: input.fileName ?? null,
      },
    });

    await tx.messageConversation.upsert({
      where: { id: conversationId },
      update: {
        contactPhone: normalizePhone(input.phone),
        contactName: (input.contactName ?? currentName) || normalizePhone(input.phone),
        lastMessage: input.content,
        lastMessageAt: timestamp,
        lastMessageDirection: ChatMessageDirection.outbound,
        unreadCount: currentUnread,
        source: "meta",
      },
      create: {
        id: conversationId,
        contactPhone: normalizePhone(input.phone),
        contactName: (input.contactName ?? currentName) || normalizePhone(input.phone),
        lastMessage: input.content,
        lastMessageAt: timestamp,
        lastMessageDirection: ChatMessageDirection.outbound,
        unreadCount: currentUnread,
        source: "meta",
      },
    });

    return saved;
  });

  return mapStoredMessage(message) satisfies Message;
}

export async function storeInboundWebhookValueInPrisma(value: MetaWebhookValue) {
  await ensurePrismaBootstrap();
  const prisma = getPrismaClient();
  const contacts = value.contacts ?? [];
  const messages = value.messages ?? [];

  for (const message of messages) {
    const isEcho = isCoexistenceEchoMessage(message, value.eventField);
    const contactPhone = normalizePhone(isEcho ? message.to : message.from);
    if (!contactPhone || !message.id) continue;

    const conversationId = buildConversationId(contactPhone);
    const contact = contacts.find((item) => normalizePhone(item.wa_id) === contactPhone) ?? contacts[0] ?? null;
    const contactName = contact?.profile?.name?.trim() || contact?.wa_id || contactPhone;
    const timestamp = new Date(messageTimestampToIso(message.timestamp));
    const type = mapMessageType(message.type);
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

    await prisma.$transaction(async (tx) => {
      const currentConversation = await tx.messageConversation.findUnique({ where: { id: conversationId } });
      const existingMessage = await tx.messageRecord.findUnique({ where: { id: message.id! } });
      const nextUnread = existingMessage ? currentConversation?.unreadCount ?? 0 : (currentConversation?.unreadCount ?? 0) + 1;

      await tx.messageConversation.upsert({
        where: { id: conversationId },
        update: {
          contactPhone,
          contactName,
          lastMessage: content,
          lastMessageAt: timestamp,
          lastMessageDirection: isEcho ? ChatMessageDirection.outbound : ChatMessageDirection.inbound,
          unreadCount: isEcho ? currentConversation?.unreadCount ?? 0 : nextUnread,
          source: "meta",
        },
        create: {
          id: conversationId,
          contactPhone,
          contactName,
          lastMessage: content,
          lastMessageAt: timestamp,
          lastMessageDirection: isEcho ? ChatMessageDirection.outbound : ChatMessageDirection.inbound,
          unreadCount: isEcho ? currentConversation?.unreadCount ?? 0 : nextUnread,
          source: "meta",
        },
      });

      await tx.messageRecord.upsert({
        where: { id: message.id! },
        update: {
          conversationId,
          direction: isEcho ? ChatMessageDirection.outbound : ChatMessageDirection.inbound,
          type: toPrismaType(type),
          content,
          mediaUrl: toRenderableMediaUrl(message.id!, externalMediaId),
          status: isEcho ? ChatMessageStatus.sent : ChatMessageStatus.delivered,
          timestamp,
          externalMessageId: message.id!,
          externalMediaId,
          mimeType,
          fileName,
        },
        create: {
          id: message.id!,
          conversationId,
          direction: isEcho ? ChatMessageDirection.outbound : ChatMessageDirection.inbound,
          type: toPrismaType(type),
          content,
          mediaUrl: toRenderableMediaUrl(message.id!, externalMediaId),
          status: isEcho ? ChatMessageStatus.sent : ChatMessageStatus.delivered,
          timestamp,
          externalMessageId: message.id!,
          externalMediaId,
          mimeType,
          fileName,
        },
      });
    });

    if (!isEcho) {
      await ensureAutomaticLeadForWhatsappContact(contactPhone, contactName);
    }
  }

  for (const statusEvent of value.statuses ?? []) {
    if (!statusEvent.id) continue;
    await updateStoredMessageStatusInPrisma(statusEvent.id, statusEvent.status, describeWebhookStatusError(statusEvent));
  }
}

export async function updateStoredMessageStatusInPrisma(
  externalMessageId: string,
  nextStatus: string | undefined,
  statusError?: string | null,
) {
  await ensurePrismaBootstrap();
  const prisma = getPrismaClient();

  if (nextStatus === "failed") {
    await prisma.messageRecord.updateMany({
      where: { OR: [{ externalMessageId }, { id: externalMessageId }] },
      data: { statusError: statusError ?? "A WhatsApp Business Platform reportou falha na entrega desta mensagem." },
    });
    return;
  }

  const normalizedStatus: ChatMessageStatus =
    nextStatus === "read" ? ChatMessageStatus.read : nextStatus === "delivered" ? ChatMessageStatus.delivered : ChatMessageStatus.sent;

  await prisma.messageRecord.updateMany({
    where: {
      OR: [{ externalMessageId }, { id: externalMessageId }],
    },
    data: { status: normalizedStatus, statusError: null },
  });
}
