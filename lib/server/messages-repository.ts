import "server-only";

import { UNASSIGNED_OWNER } from "@/lib/crm";
import type { Conversation, Message, MessagingConnectionState } from "@/lib/messages";
import type { LeadConversationContext, SessionUser } from "@/lib/server/crm-repository";
import { findLeadConversationContextByPhone, listLeadConversationContextsForPhones } from "@/lib/server/crm-repository";
import { ensureAutomaticLeadForWhatsappContact } from "@/lib/server/lead-auto-assign";
import { buildConversationWorkspaceKey, getMessageWorkspace, getMessageWorkspaces } from "@/lib/server/message-workspace-store";
import {
  fetchConnectionState,
  fetchConnectionStateLite,
  fetchConversationsFromAPI,
  getResolvedWhatsAppConfig,
} from "@/lib/server/messages-client";
import { findStoredConversationByIdOrPhone, listStoredAnalyticsMessages, listStoredMessagesPage } from "@/lib/server/messages-store";

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function patchConversationLeadContext(conversation: Conversation, leads: LeadConversationContext[]) {
  const phone = normalizePhone(conversation.contactPhone);
  const linkedLead = leads.find((lead) => lead.phone === phone) ?? null;

  if (!linkedLead) {
    return conversation;
  }

  return {
    ...conversation,
    contactName: linkedLead.name?.trim() || conversation.contactName,
    leadId: linkedLead.id,
    leadStatus: linkedLead.leadStatus,
    ownerName: linkedLead.ownerName,
  } satisfies Conversation;
}

function canInspectConversation(user: Pick<SessionUser, "role" | "name">, conversation: Conversation) {
  if (user.role === "ADMIN" || user.role === "MANAGER") return true;
  // Sem responsavel definido ou ainda na fila do "Equipe Comercial": visivel para qualquer atendente.
  if (!conversation.ownerName || conversation.ownerName === UNASSIGNED_OWNER) return true;
  return conversation.ownerName === user.name;
}

function compareConversations(a: Conversation, b: Conversation) {
  return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
}

function shouldAutoCreateLeadFromConversation(conversation: Conversation) {
  const phone = normalizePhone(conversation.contactPhone);
  return Boolean(phone) && !conversation.leadId;
}

// Rede de seguranca: a criacao do lead automatico (com roleta) ja acontece no instante
// do webhook via ensureAutomaticLeadForWhatsappContact. Isto aqui cobre conversas que
// chegaram por outro caminho (ex.: importacao/coexistence) sem passar pelo webhook.
async function ensureLeadsForInboundConversations(
  conversations: Conversation[],
  leads: LeadConversationContext[],
) {
  const existingPhones = new Set(leads.map((lead) => lead.phone).filter(Boolean));

  const conversationsToCreate = conversations.filter((conversation) => {
    const phone = normalizePhone(conversation.contactPhone);
    return shouldAutoCreateLeadFromConversation(conversation) && !existingPhones.has(phone);
  });

  if (!conversationsToCreate.length) {
    return leads;
  }

  for (const conversation of conversationsToCreate) {
    const phone = normalizePhone(conversation.contactPhone);
    if (!phone || existingPhones.has(phone)) continue;

    await ensureAutomaticLeadForWhatsappContact(conversation.contactPhone, conversation.contactName);
    existingPhones.add(phone);
  }

  return listLeadConversationContextsForPhones([...existingPhones]);
}

function buildLeadContextMap(leads: LeadConversationContext[]) {
  return new Map(leads.map((lead) => [lead.phone, lead]));
}

export async function listConversations(options?: { includeWorkspaces?: boolean }) {
  const config = await getResolvedWhatsAppConfig();
  const [conversations, connection] = await Promise.all([
    fetchConversationsFromAPI(config),
    fetchConnectionState(config),
  ]);

  const leadContexts = await listLeadConversationContextsForPhones(conversations.map((conversation) => conversation.contactPhone));

  const leads = await ensureLeadsForInboundConversations(conversations, leadContexts);
  const leadMap = buildLeadContextMap(leads);
  const enriched = conversations.map((conversation) => {
    const linkedLead = leadMap.get(normalizePhone(conversation.contactPhone));
    return patchConversationLeadContext(conversation, linkedLead ? [linkedLead] : []);
  });

  if (options?.includeWorkspaces === false) {
    return {
      conversations: enriched.sort(compareConversations),
      connection,
    };
  }

  const workspaces = await getMessageWorkspaces(enriched.map((conversation) => buildConversationWorkspaceKey(conversation.contactPhone)));

  return {
    conversations: enriched
      .map((conversation) => ({
        ...conversation,
        workspace: workspaces[buildConversationWorkspaceKey(conversation.contactPhone)] ?? conversation.workspace,
      }))
      .sort(compareConversations),
    connection,
  };
}

export async function listConversationsForUser(
  user: Pick<SessionUser, "role" | "name">,
  options?: { includeWorkspaces?: boolean },
) {
  const data = await listConversations(options);
  return {
    ...data,
    conversations: data.conversations.filter((conversation) => canInspectConversation(user, conversation)),
  };
}

export async function getConversationMessages(contactId: string, options?: { limit?: number; before?: string | null }) {
  const config = await getResolvedWhatsAppConfig();
  const page = await listStoredMessagesPage(contactId, options);
  return {
    messages: page.messages,
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
    configured: config.configured,
  };
}

export async function getConversationMessagesForUser(
  contactId: string,
  user: Pick<SessionUser, "role" | "name">,
  options?: { limit?: number; before?: string | null },
) {
  const config = await getResolvedWhatsAppConfig();
  const storedConversation = await findStoredConversationByIdOrPhone(contactId);
  const leadContext = storedConversation
    ? await findLeadConversationContextByPhone(storedConversation.contactPhone)
    : await findLeadConversationContextByPhone(contactId);
  const conversation =
    storedConversation
      ? patchConversationLeadContext(storedConversation, leadContext ? [leadContext] : [])
      : null;

  if (conversation && !canInspectConversation(user, conversation)) {
    return {
      messages: [] as Message[],
      hasMore: false,
      nextCursor: null,
      configured: config.configured,
      forbidden: true as const,
      conversation,
    };
  }

  const data = await getConversationMessages(conversation?.id || contactId, options);
  return { ...data, forbidden: false as const, conversation };
}

export async function listConversationBundlesForUser(user: Pick<SessionUser, "role" | "name">) {
  const { conversations, connection } = await listConversationsForUser(user, { includeWorkspaces: false });
  const since = new Date();
  since.setDate(since.getDate() - 370);
  const messagesByConversationId = await listStoredAnalyticsMessages(
    conversations.map((conversation) => conversation.id),
    since.toISOString(),
  );
  const bundles = conversations.map((conversation) => ({
    conversation,
    messages: (messagesByConversationId[conversation.id] ?? []).map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      direction: message.direction,
      type: "text" as const,
      content: "",
      status: "sent" as const,
      timestamp: message.timestamp,
    })),
  }));

  return {
    bundles,
    connection,
    updatedAt: connection.updatedAt ?? null,
  };
}

export async function getMessagingConnection() {
  return getResolvedWhatsAppConfig().then((config) => fetchConnectionStateLite(config));
}

export async function generateMessagingQrCode() {
  throw new Error("A API oficial do WhatsApp nao usa QR Code neste CRM.");
}

export function buildConversationFingerprint(
  conversation: Pick<Conversation, "id" | "lastMessageAt" | "lastMessage" | "leadStatus">,
  messages: Pick<Message, "id" | "timestamp" | "content">[],
) {
  const last = messages.at(-1);
  return [
    conversation.id,
    conversation.lastMessageAt ?? "",
    conversation.lastMessage ?? "",
    conversation.leadStatus ?? "",
    last?.id ?? "",
    last?.timestamp ?? "",
    last?.content?.slice(0, 120) ?? "",
  ].join("::");
}

export async function findConversationByLeadId(leadId: string) {
  const { conversations } = await listConversations();
  return conversations.find((conversation) => conversation.leadId === leadId) ?? null;
}

export async function getConversationWorkspace(contactId: string) {
  return getMessageWorkspace(buildConversationWorkspaceKey(contactId));
}
