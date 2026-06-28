import "server-only";

import type { MessageStatus, MessageType } from "@/lib/messages";
import {
  exportLegacyMessageStoreSnapshot,
  type MetaWebhookValue,
  listStoredConversationsFromFile,
  listStoredMessagesFromFile,
  getStoredMessageByIdFromFile,
  markStoredConversationAsReadInFile,
  setStoredConversationUnreadCountInFile,
  storeInboundWebhookValueInFile,
  storeOutboundMessageInFile,
  updateStoredMessageStatusInFile,
} from "@/lib/server/messages-file-store";
import {
  findStoredConversationByIdOrPhoneFromPrisma,
  listStoredAnalyticsMessagesFromPrisma,
  getStoredMessageByIdFromPrisma,
  listStoredConversationsFromPrisma,
  listStoredMessagesFromPrisma,
  listStoredMessagesPageFromPrisma,
  markStoredConversationAsReadInPrisma,
  setStoredConversationUnreadCountInPrisma,
  storeInboundWebhookValueInPrisma,
  storeOutboundMessageInPrisma,
  updateStoredMessageStatusInPrisma,
} from "@/lib/server/messages-prisma-store";

function shouldUsePrismaMessageStore() {
  return Boolean(process.env.DATABASE_URL);
}

export type { MetaWebhookValue };
export { exportLegacyMessageStoreSnapshot } from "@/lib/server/messages-file-store";

export async function listStoredConversations() {
  if (shouldUsePrismaMessageStore()) {
    return listStoredConversationsFromPrisma();
  }
  return listStoredConversationsFromFile();
}

export async function listStoredMessages(conversationId: string) {
  if (shouldUsePrismaMessageStore()) {
    return listStoredMessagesFromPrisma(conversationId);
  }
  return listStoredMessagesFromFile(conversationId);
}

export async function listStoredMessagesPage(conversationId: string, options?: { limit?: number; before?: string | null }) {
  if (shouldUsePrismaMessageStore()) {
    return listStoredMessagesPageFromPrisma(conversationId, options);
  }

  const messages = await listStoredMessagesFromFile(conversationId);
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const beforeTime = options?.before ? new Date(options.before).getTime() : Number.POSITIVE_INFINITY;
  const eligible = messages.filter((message) => new Date(message.timestamp).getTime() < beforeTime);
  const pageItems = eligible.slice(Math.max(0, eligible.length - limit));
  const hasMore = eligible.length > pageItems.length;
  return {
    messages: pageItems,
    hasMore,
    nextCursor: pageItems[0]?.timestamp ?? null,
  };
}

export async function getStoredMessageById(messageId: string) {
  if (shouldUsePrismaMessageStore()) {
    return getStoredMessageByIdFromPrisma(messageId);
  }
  return getStoredMessageByIdFromFile(messageId);
}

export async function findStoredConversationByIdOrPhone(contactId: string) {
  if (shouldUsePrismaMessageStore()) {
    return findStoredConversationByIdOrPhoneFromPrisma(contactId);
  }

  const normalizedPhone = contactId.replace(/\D/g, "");
  const conversations = await listStoredConversationsFromFile();
  return (
    conversations.find(
      (conversation) => conversation.id === contactId || conversation.contactPhone.replace(/\D/g, "") === normalizedPhone,
    ) ?? null
  );
}

export async function listStoredAnalyticsMessages(conversationIds: string[], sinceIso?: string | null) {
  if (shouldUsePrismaMessageStore()) {
    return listStoredAnalyticsMessagesFromPrisma(conversationIds, sinceIso);
  }

  const grouped: Record<string, Array<{ id: string; conversationId: string; direction: "inbound" | "outbound"; timestamp: string }>> = {};
  for (const conversationId of conversationIds) {
    const messages = await listStoredMessagesFromFile(conversationId);
    grouped[conversationId] = messages
      .filter((message) => !sinceIso || new Date(message.timestamp).getTime() >= new Date(sinceIso).getTime())
      .map((message) => ({
        id: message.id,
        conversationId: message.conversationId,
        direction: message.direction,
        timestamp: message.timestamp,
      }));
  }
  return grouped;
}

export async function markStoredConversationAsRead(conversationId: string) {
  if (shouldUsePrismaMessageStore()) {
    return markStoredConversationAsReadInPrisma(conversationId);
  }
  return markStoredConversationAsReadInFile(conversationId);
}

export async function setStoredConversationUnreadCount(conversationId: string, unreadCount: number) {
  if (shouldUsePrismaMessageStore()) {
    return setStoredConversationUnreadCountInPrisma(conversationId, unreadCount);
  }
  return setStoredConversationUnreadCountInFile(conversationId, unreadCount);
}

export async function storeOutboundMessage(input: {
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
  if (shouldUsePrismaMessageStore()) {
    return storeOutboundMessageInPrisma(input);
  }
  return storeOutboundMessageInFile(input);
}

export async function storeInboundWebhookValue(value: MetaWebhookValue) {
  if (shouldUsePrismaMessageStore()) {
    return storeInboundWebhookValueInPrisma(value);
  }
  return storeInboundWebhookValueInFile(value);
}

export async function updateStoredMessageStatus(externalMessageId: string, nextStatus: string | undefined, statusError?: string | null) {
  if (shouldUsePrismaMessageStore()) {
    return updateStoredMessageStatusInPrisma(externalMessageId, nextStatus, statusError);
  }
  return updateStoredMessageStatusInFile(externalMessageId, nextStatus, statusError);
}
