"use client";

import * as React from "react";
import { isOverdue, UNASSIGNED_OWNER, validateLead, type FunnelStatus, type Lead } from "@/lib/crm";
import type {
  Conversation,
  ConversationAnalysis,
  ConversationAttemptType,
  LeadSuggestionField,
  Message,
  MessagingConnectionState,
  ConversationPriority,
  ConversationServiceStatus,
} from "@/lib/messages";

type EditableLead = Omit<Lead, "id" | "history">;

type ConvsResponse = {
  conversations: Conversation[];
  connection: MessagingConnectionState;
};

type MsgsResponse = {
  messages: Message[];
  configured: boolean;
  hasMore?: boolean;
  nextCursor?: string | null;
  conversation?: Conversation | null;
};

type ConnectionDebugState = {
  provider: string | null;
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

type StatusMeta = {
  label: string;
  hint: string;
  badge: "success" | "gold" | "danger";
  icon: "online" | "waiting" | "offline";
};

type UseMessagesViewArgs = {
  leads: Lead[];
  ownerOptions: readonly string[];
  focusLeadId?: string | null;
  focusConversationId?: string | null;
  onStatusChange: (leadId: string, status: FunnelStatus) => Promise<void>;
  onUpsertLead: (leadId: string | null, lead: EditableLead) => Promise<void>;
  canEdit: boolean;
  isAdmin: boolean;
  canInspectAll: boolean;
  currentUserName?: string;
};

type PendingOutboundMessage =
  | {
      queueId: string;
      tempMessageId: string;
      kind: "text";
      conversation: Conversation;
      payload: {
        phone: string;
        content: string;
      };
    }
  | {
      queueId: string;
      tempMessageId: string;
      kind: "attachment";
      conversation: Conversation;
      payload: {
        phone: string;
        caption: string;
        file: File;
      };
    };

type LeadConversationAnalysisPayload = ConversationAnalysis | { error?: string };

const WAITING_CONNECTION_REFRESH_MS = 5_000;
const ONLINE_CONVERSATIONS_REFRESH_MS = 6_000;
const ACTIVE_CONVERSATION_REFRESH_MS = 3_000;
const MESSAGE_CACHE_STALE_MS = 30_000;
const MESSAGE_PREFETCH_LIMIT = 2;
const GLOBAL_MESSAGES_CACHE_TTL_MS = 5 * 60_000;

const globalMessagesViewCache = {
  messagesByKey: {} as Record<string, Message[]>,
  updatedAtByKey: {} as Record<string, number>,
  clearTimer: null as ReturnType<typeof setTimeout> | null,
  activeConsumers: 0,
};

const leadConversationAnalysisCache = new Map<string, LeadConversationAnalysisPayload>();
const leadConversationAnalysisInflight = new Map<string, Promise<LeadConversationAnalysisPayload>>();

function leadConversationAnalysisKey(leadId: string, leadStatus: string) {
  return `${leadId}::${leadStatus}`;
}

async function getLeadConversationAnalysis(
  leadId: string,
  leadStatus: string,
  force = false
) {
  const key = leadConversationAnalysisKey(leadId, leadStatus);

  if (!force && leadConversationAnalysisCache.has(key)) {
    return leadConversationAnalysisCache.get(key)!;
  }

  if (!force && leadConversationAnalysisInflight.has(key)) {
    return leadConversationAnalysisInflight.get(key)!;
  }

  const request = (async (): Promise<LeadConversationAnalysisPayload> => {
    const res = await fetch("/api/ai/conversation-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, leadStatus }),
    });
    return res.json() as Promise<LeadConversationAnalysisPayload>;
  })()
    .then((data) => {
      leadConversationAnalysisCache.set(key, data);
      return data;
    })
    .finally(() => {
      leadConversationAnalysisInflight.delete(key);
    });

  leadConversationAnalysisInflight.set(key, request);
  return request;
}

export function useLeadConversationAnalysis() {
  return { getLeadConversationAnalysis };
}

export function useMessagesView({
  leads,
  ownerOptions,
  focusLeadId,
  focusConversationId,
  onStatusChange,
  onUpsertLead,
  canEdit,
  isAdmin,
  canInspectAll,
  currentUserName,
}: UseMessagesViewArgs) {
  const [convs, setConvs] = React.useState<Conversation[]>([]);
  const [connection, setConnection] = React.useState<MessagingConnectionState | null>(null);
  const [connectionDebug, setConnectionDebug] = React.useState<ConnectionDebugState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshingConversations, setRefreshingConversations] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [courseFilter, setCourseFilter] = React.useState("all");
  const [funnelFilter, setFunnelFilter] = React.useState("all");
  const [inboxSegment, setInboxSegment] = React.useState<"all" | "unread" | "with-lead" | "without-lead" | "overdue" | "negotiation">("all");
  const [ownerFilter, setOwnerFilter] = React.useState("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading] = React.useState(false);
  const [msgsRefreshing, setMsgsRefreshing] = React.useState(false);
  const [messagesHasMore, setMessagesHasMore] = React.useState(false);
  const [messagesCursor, setMessagesCursor] = React.useState<string | null>(null);
  const [messagesLoadingOlder, setMessagesLoadingOlder] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [qrLoading, setQrLoading] = React.useState(false);
  const [messageError, setMessageError] = React.useState("");
  const [analysis, setAnalysis] = React.useState<ConversationAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = React.useState(false);
  const [applyingStatus, setApplyingStatus] = React.useState(false);
  const [leadDraft, setLeadDraft] = React.useState<EditableLead | null>(null);
  const [leadSuggestions, setLeadSuggestions] = React.useState<NonNullable<ConversationAnalysis["leadSuggestions"]>>([]);
  const [leadSaving, setLeadSaving] = React.useState(false);
  const [leadError, setLeadError] = React.useState("");
  const [leadSaved, setLeadSaved] = React.useState("");
  const [webhookLoading, setWebhookLoading] = React.useState(false);
  const [embeddedSignupLoading, setEmbeddedSignupLoading] = React.useState(false);
  const [embeddedSignupExchangeLoading, setEmbeddedSignupExchangeLoading] = React.useState(false);
  const [webhookMessage, setWebhookMessage] = React.useState("");
  const [disconnectLoading, setDisconnectLoading] = React.useState(false);
  const [suppressedUnreadByKey, setSuppressedUnreadByKey] = React.useState<Record<string, number>>({});
  const [seenConversationAtByKey, setSeenConversationAtByKey] = React.useState<Record<string, string>>({});
  const [workspaceSaving, setWorkspaceSaving] = React.useState(false);
  const [workspaceError, setWorkspaceError] = React.useState("");
  const [ownerSaving, setOwnerSaving] = React.useState(false);
  const [ownerError, setOwnerError] = React.useState("");
  const [bulkUpdating, setBulkUpdating] = React.useState(false);
  const [bulkError, setBulkError] = React.useState("");
  const [outboxQueue, setOutboxQueue] = React.useState<PendingOutboundMessage[]>([]);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const threadViewportRef = React.useRef<HTMLDivElement>(null);
  const loadedConversationRef = React.useRef<string | null>(null);
  const selectedIdRef = React.useRef<string | null>(null);
  const selectedPhoneRef = React.useRef<string | null>(null);
  const selectedStableKeyRef = React.useRef<string | null>(null);
  const selectedConversationSnapshotRef = React.useRef<Conversation | null>(null);
  const lastMessageIdRef = React.useRef<string | null>(null);
  const lastStableConversationKeyRef = React.useRef<string | null>(null);
  const pendingInitialScrollRef = React.useRef(false);
  const initialScrollTimeoutsRef = React.useRef<number[]>([]);
  const conversationsFetchInFlightRef = React.useRef(false);
  const messagesFetchInFlightRef = React.useRef<Set<string>>(new Set());
  const sendQueueInFlightRef = React.useRef(false);
  const optimisticMessageSeqRef = React.useRef(0);
  const messageCacheRef = React.useRef<Record<string, Message[]>>(globalMessagesViewCache.messagesByKey);
  const messageCacheUpdatedAtRef = React.useRef<Record<string, number>>(globalMessagesViewCache.updatedAtByKey);
  const [pageVisible, setPageVisible] = React.useState(true);
  const inboxFiltersStorageKey = React.useMemo(
    () => `belart-crm-messages-filters::${(currentUserName || "anon").trim().toLowerCase()}`,
    [currentUserName]
  );
  const seenConversationsStorageKey = React.useMemo(
    () => `belart-crm-messages-seen::${(currentUserName || "anon").trim().toLowerCase()}`,
    [currentUserName]
  );

  const applyUnreadSuppression = React.useCallback(
    (
      items: Conversation[],
      suppressedMap: Record<string, number>,
      seenMap: Record<string, string>,
    ) => {
      let changed = false;
      const next = items.map((conv) => {
        const stableKey = getStableConversationKey(conv);
        const seenAt = seenMap[stableKey];
        const lastMessageTime = messageTimeValue(conv.lastMessageAt);
        const seenAtTime = messageTimeValue(seenAt ?? "");

        if (seenAt && lastMessageTime <= seenAtTime && conv.unreadCount > 0) {
          changed = true;
          return { ...conv, unreadCount: 0 };
        }

        // Once a newer message arrives, stop applying stale local suppression from a previous view.
        if (seenAt && lastMessageTime > seenAtTime) {
          return conv;
        }

        const suppressed = suppressedMap[stableKey] ?? 0;
        if (suppressed <= 0 || conv.unreadCount <= 0) return conv;
        const adjustedUnread = Math.max(0, conv.unreadCount - suppressed);
        if (adjustedUnread === conv.unreadCount) return conv;
        changed = true;
        return { ...conv, unreadCount: adjustedUnread };
      });
      return changed ? next : items;
    },
    []
  );

  const markConversationAsSeen = React.useCallback((items: Conversation[], target: Conversation | null) => {
    if (!target) return;
    const stableKey = getStableConversationKey(target);
    const matchingUnread = items
      .filter((conv) => getStableConversationKey(conv) === stableKey)
      .reduce((max, conv) => Math.max(max, conv.unreadCount), 0);

    if (matchingUnread <= 0) return;

    setSuppressedUnreadByKey((current) => {
      const existing = current[stableKey] ?? 0;
      if (matchingUnread <= existing) return current;
      return { ...current, [stableKey]: matchingUnread };
    });
    setSeenConversationAtByKey((current) => {
      if (current[stableKey] === target.lastMessageAt) return current;
      return { ...current, [stableKey]: target.lastMessageAt };
    });
  }, []);

  const selectedConv =
    convs.find((c) => c.id === selectedId) ??
    (selectedStableKeyRef.current
      ? convs.find((c) => getStableConversationKey(c) === selectedStableKeyRef.current)
      : null) ??
    (selectedPhoneRef.current
      ? convs.find((c) => normalizePhone(c.contactPhone) === selectedPhoneRef.current)
      : null) ??
    ((selectedId || selectedIdRef.current) ? selectedConversationSnapshotRef.current : null) ??
    null;

  const getCachedConversationMessages = React.useCallback((conversation: Conversation | null) => {
    if (!conversation) return [] as Message[];
    const stableKey = getStableConversationKey(conversation);
    return messageCacheRef.current[stableKey] ?? [];
  }, []);

  const setCachedConversationMessages = React.useCallback((conversation: Conversation, nextMessages: Message[]) => {
    const stableKey = getStableConversationKey(conversation);
    const currentMessages = messageCacheRef.current[stableKey] ?? [];
    const normalized = reconcileConversationMessages(currentMessages, nextMessages, conversation.id);
    messageCacheRef.current[stableKey] = normalized;
    messageCacheUpdatedAtRef.current[stableKey] = Date.now();
    return normalized;
  }, []);

  const patchCachedConversationMessages = React.useCallback(
    (conversation: Conversation, updater: (current: Message[]) => Message[]) => {
      const stableKey = getStableConversationKey(conversation);
      const currentMessages = messageCacheRef.current[stableKey] ?? [];
      const nextMessages = updater(currentMessages);
      messageCacheRef.current[stableKey] = nextMessages;
      messageCacheUpdatedAtRef.current[stableKey] = Date.now();
      return nextMessages;
    },
    [],
  );

  // Correção 1: derivar mensagens filtradas por conversa ativa no mesmo render
  // Isso elimina o gap visual onde messages da Conv1 aparecem na Conv2
  // enquanto o useEffect ainda não executou o setMessages([])
  const conversationMessages = React.useMemo(() => {
    if (!selectedConv) return [];
    return messages.filter((m) => m.conversationId === selectedConv.id);
  }, [messages, selectedConv?.id]);

  const leadMap = React.useMemo(() => new Map(leads.map((item) => [item.id, item])), [leads]);
  const leadMapByPhone = React.useMemo(
    () =>
      new Map(
        leads
          .map((item) => [normalizePhone(item.whatsapp || item.telefone), item] as const)
          .filter(([phone]) => Boolean(phone)),
      ),
    [leads],
  );
  // Mesma regra de fallback do efeito de enriquecimento da lista abaixo: sem isso, o
  // cockpit (que so buscava por leadId) ficava "sem lead" enquanto a lista lateral ja
  // mostrava status/responsavel via match por telefone, dando a impressao de duas UIs.
  const lead =
    (selectedConv?.leadId ? leadMap.get(selectedConv.leadId) : null) ??
    (selectedConv ? leadMapByPhone.get(normalizePhone(selectedConv.contactPhone)) : null) ??
    null;

  React.useEffect(() => {
    setConvs((current) => {
      const next = current.map((conversation) => {
        const linkedLead =
          (conversation.leadId ? leadMap.get(conversation.leadId) : null) ??
          leadMapByPhone.get(normalizePhone(conversation.contactPhone)) ??
          null;

        if (!linkedLead) return conversation;

        const nextName = linkedLead.nome.trim() || conversation.contactName;
        const nextLeadStatus = linkedLead.status_funil || conversation.leadStatus;
        const nextOwnerName = linkedLead.responsavel || conversation.ownerName;
        const nextLeadId = conversation.leadId ?? linkedLead.id;

        if (
          nextName === conversation.contactName &&
          nextLeadStatus === conversation.leadStatus &&
          nextOwnerName === conversation.ownerName &&
          nextLeadId === conversation.leadId
        ) {
          return conversation;
        }

        return {
          ...conversation,
          contactName: nextName,
          leadStatus: nextLeadStatus,
          ownerName: nextOwnerName,
          leadId: nextLeadId,
        };
      });

      return sameConversationCollection(current, next) ? current : next;
    });
  }, [leadMap, leadMapByPhone]);

  const clearScheduledInitialScrolls = React.useCallback(() => {
    for (const timeoutId of initialScrollTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    initialScrollTimeoutsRef.current = [];
  }, []);

  const scrollThreadToBottom = React.useCallback(() => {
    const viewport = threadViewportRef.current;
    const bottom = bottomRef.current;
    if (!viewport) return;

    const apply = () => {
      if (bottom) {
        bottom.scrollIntoView({ block: "end" });
      }
      viewport.scrollTop = viewport.scrollHeight;
    };

    apply();
    requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(apply);
    });

    clearScheduledInitialScrolls();
    initialScrollTimeoutsRef.current = [
      window.setTimeout(apply, 0),
      window.setTimeout(apply, 60),
      window.setTimeout(apply, 180),
    ];
  }, [clearScheduledInitialScrolls]);

  const loadConnectionDebug = React.useCallback(async () => {
    try {
      const response = await fetch("/api/messages/debug");
      const data = (await response.json().catch(() => null)) as ConnectionDebugState | null;
      if (data) {
        setConnectionDebug((current) => (sameConnectionDebugState(current, data) ? current : data));
      }
    } catch {
      // keep current debug state
    }
  }, []);

  React.useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  React.useEffect(() => {
    if (selectedConv) {
      selectedConversationSnapshotRef.current = selectedConv;
      return;
    }

    if (!selectedId) {
      selectedConversationSnapshotRef.current = null;
    }
  }, [selectedConv, selectedId]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const syncVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  React.useEffect(() => {
    globalMessagesViewCache.activeConsumers += 1;
    if (globalMessagesViewCache.clearTimer) {
      clearTimeout(globalMessagesViewCache.clearTimer);
      globalMessagesViewCache.clearTimer = null;
    }

    messageCacheRef.current = globalMessagesViewCache.messagesByKey;
    messageCacheUpdatedAtRef.current = globalMessagesViewCache.updatedAtByKey;

    return () => {
      globalMessagesViewCache.activeConsumers = Math.max(0, globalMessagesViewCache.activeConsumers - 1);
      globalMessagesViewCache.messagesByKey = messageCacheRef.current;
      globalMessagesViewCache.updatedAtByKey = messageCacheUpdatedAtRef.current;

      if (globalMessagesViewCache.activeConsumers > 0) return;

      if (globalMessagesViewCache.clearTimer) {
        clearTimeout(globalMessagesViewCache.clearTimer);
      }

      globalMessagesViewCache.clearTimer = setTimeout(() => {
        if (globalMessagesViewCache.activeConsumers > 0) return;
        globalMessagesViewCache.messagesByKey = {};
        globalMessagesViewCache.updatedAtByKey = {};
        globalMessagesViewCache.clearTimer = null;
      }, GLOBAL_MESSAGES_CACHE_TTL_MS);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(inboxFiltersStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        search?: string;
        courseFilter?: string;
        funnelFilter?: string;
        inboxSegment?: "all" | "unread" | "with-lead" | "without-lead" | "overdue" | "negotiation";
        ownerFilter?: string;
      };
      setSearch(parsed.search ?? "");
      setCourseFilter(parsed.courseFilter ?? "all");
      setFunnelFilter(parsed.funnelFilter ?? "all");
      setInboxSegment(parsed.inboxSegment ?? "all");
      setOwnerFilter(parsed.ownerFilter ?? "all");
    } catch {
      // ignore malformed local state
    }
  }, [inboxFiltersStorageKey]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(seenConversationsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      setSeenConversationAtByKey(parsed);
    } catch {
      // ignore malformed local state
    }
  }, [seenConversationsStorageKey]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      search,
      courseFilter,
      funnelFilter,
      inboxSegment,
      ownerFilter,
    };
    window.localStorage.setItem(inboxFiltersStorageKey, JSON.stringify(payload));
  }, [courseFilter, funnelFilter, inboxFiltersStorageKey, inboxSegment, ownerFilter, search]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(seenConversationsStorageKey, JSON.stringify(seenConversationAtByKey));
  }, [seenConversationAtByKey, seenConversationsStorageKey]);

  React.useEffect(() => {
    selectedPhoneRef.current = selectedConv ?normalizePhone(selectedConv.contactPhone) : null;
    selectedStableKeyRef.current = selectedConv ? getStableConversationKey(selectedConv) : null;
  }, [selectedConv?.id, selectedConv?.contactPhone, selectedConv?.workspace?.conversationKey]);

  React.useEffect(() => {
    if (!selectedConv) return;
    markConversationAsSeen(convs, selectedConv);
  }, [convs, markConversationAsSeen, selectedConv]);

  const loadConversations = React.useCallback(async (background = false) => {
    if (conversationsFetchInFlightRef.current) return;
    if (!background) {
      setLoading(true);
    } else {
      setRefreshingConversations(true);
    }
    conversationsFetchInFlightRef.current = true;

    try {
      const res = await fetch("/api/messages/conversations");
      const data: ConvsResponse = await res.json();
      const nextConversations = data.conversations ?? [];

      const currentSelectedId = selectedIdRef.current;
      const currentSelectedPhone = selectedPhoneRef.current;
      const currentStableKey = selectedStableKeyRef.current;
      if (currentSelectedId && !nextConversations.some((conversation) => conversation.id === currentSelectedId)) {
        const replacement = nextConversations.find(
          (conversation) =>
            (currentStableKey && getStableConversationKey(conversation) === currentStableKey) ||
            (currentSelectedPhone && normalizePhone(conversation.contactPhone) === currentSelectedPhone)
        );
        if (replacement && replacement.id !== currentSelectedId) {
          setSelectedId(replacement.id);
        }
      }

      setConvs((current) => {
        const normalized = applyUnreadSuppression(nextConversations, suppressedUnreadByKey, seenConversationAtByKey);
        return sameConversationCollection(current, normalized) ? current : normalized;
      });
      setConnection((current) =>
        sameConnectionState(current, data.connection ?? null) ?current : (data.connection ?? null)
      );
    } catch {
      // keep current state
    } finally {
      conversationsFetchInFlightRef.current = false;
      if (!background) {
        setLoading(false);
      } else {
        setRefreshingConversations(false);
      }
    }
  }, [applyUnreadSuppression, seenConversationAtByKey, suppressedUnreadByKey]);

  const generateQrCode = React.useCallback(async () => {
    setQrLoading(true);
    setMessageError("");
    try {
      const res = await fetch("/api/messages/conversations", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível inicializar a integração oficial do WhatsApp.");
      }
      setConnection(data);
      void loadConnectionDebug();
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Não foi possível inicializar a integração oficial do WhatsApp.");
    } finally {
      setQrLoading(false);
    }
  }, [loadConnectionDebug]);

  const disconnectWhatsApp = React.useCallback(async () => {
    setDisconnectLoading(true);
    setMessageError("");
    try {
      const res = await fetch("/api/messages/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível desconectar o WhatsApp.");
      }
      setConnection(data.connection);
      setConvs([]);
      setSelectedId(null);
      setMessages([]);
      setMessagesHasMore(false);
      setMessagesCursor(null);
      void loadConnectionDebug();
    } catch (error) {
      setMessageError(error instanceof Error ?error.message : "Não foi possível desconectar o WhatsApp.");
    } finally {
      setDisconnectLoading(false);
    }
  }, [loadConnectionDebug]);

  const configureWebhook = React.useCallback(async () => {
    setWebhookLoading(true);
    setWebhookMessage("");
    try {
      const res = await fetch("/api/messages/webhook", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setWebhookMessage(data?.error ?? "Não foi possível configurar o webhook.");
      } else {
        setWebhookMessage(`Webhook e configuracoes seguras aplicados: ${data.configuredUrl}`);
      }
    } catch {
      setWebhookMessage("Erro ao atualizar a configuracao do WhatsApp.");
    } finally {
      setWebhookLoading(false);
    }
    void loadConnectionDebug();
    void loadConversations(true);
  }, [loadConnectionDebug, loadConversations]);

  const startEmbeddedSignup = React.useCallback(async () => {
    setEmbeddedSignupLoading(true);
    setWebhookMessage("");
    setMessageError("");
    try {
      const res = await fetch("/api/messages/embedded-signup/start", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível iniciar o Embedded Signup.");
      }

      const launchUrl = typeof data?.launchUrl === "string" ? data.launchUrl : "";
      if (!launchUrl) {
        throw new Error("A Meta não retornou uma URL válida para iniciar o onboarding.");
      }

      const popup = window.open(launchUrl, "_blank", "noopener,noreferrer");
      if (!popup) {
        window.location.assign(launchUrl);
      }
      setWebhookMessage("Fluxo de coexistência iniciado. Conclua o onboarding na Meta e aguarde o callback no CRM.");
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Não foi possível iniciar o Embedded Signup.");
    } finally {
      setEmbeddedSignupLoading(false);
    }
    void loadConnectionDebug();
    void loadConversations(true);
  }, [loadConnectionDebug, loadConversations]);

  const exchangeEmbeddedSignupCode = React.useCallback(async () => {
    setEmbeddedSignupExchangeLoading(true);
    setWebhookMessage("");
    setMessageError("");
    try {
      const res = await fetch("/api/messages/embedded-signup/exchange", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível concluir a troca do code do onboarding.");
      }

      setWebhookMessage(
        data?.onboardingStatus === "linked"
          ? "Troca do code concluída e coexistência marcada como vinculada."
          : "Troca do code concluída. Agora valide os IDs finais da conta para concluir a vinculação.",
      );
    } catch (error) {
      setMessageError(
        error instanceof Error ? error.message : "Não foi possível concluir a troca do code do onboarding.",
      );
    } finally {
      setEmbeddedSignupExchangeLoading(false);
    }
    void loadConnectionDebug();
    void loadConversations(true);
  }, [loadConnectionDebug, loadConversations]);

  const runAnalysis = React.useCallback(async (conv: Conversation) => {
    setAnalysisLoading(true);
    try {
      const res = await fetch("/api/ai/conversation-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conv.id,
          leadId: conv.leadId,
          leadStatus: conv.leadStatus,
        }),
      });
      if (res.ok) {
        const data: ConversationAnalysis = await res.json();
        setAnalysis((current) => (sameAnalysis(current, data) ? current : data));
      }
    } catch {
      // keep previous analysis
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  const loadMessages = React.useCallback(
    async (conv: Conversation, background = false) => {
      const requestKey = getStableConversationKey(conv);
      if (messagesFetchInFlightRef.current.has(requestKey)) return;
      if (!background) {
        setMsgsLoading(true);
      }
      const isActiveConversationRequest =
        selectedStableKeyRef.current === requestKey ||
        loadedConversationRef.current === requestKey;
      if (background && isActiveConversationRequest) {
        setMsgsRefreshing(true);
      }
      messagesFetchInFlightRef.current.add(requestKey);

      // Snapshot the active conversation key at fetch-start to detect stale responses
      const expectedKey = requestKey;

      try {
        const params = new URLSearchParams();
        if (!background) {
          params.set("markRead", "1");
        }
        params.set("limit", "50");
        const query = params.toString();
        const res = await fetch(`/api/messages/${conv.id}${query ? `?${query}` : ""}`);
        const data: MsgsResponse = await res.json();
        const nextMessages = data.messages ?? [];
        const cachedMessages = setCachedConversationMessages(conv, nextMessages);

        // Guard: discard result if user switched conversations while fetch was in-flight
        if (loadedConversationRef.current !== expectedKey) {
          return;
        }

        setMessages(cachedMessages);
        setMessagesHasMore(Boolean(data.hasMore));
        setMessagesCursor(data.nextCursor ?? null);
        const latestMessage = nextMessages.at(-1) ?? null;
        if (latestMessage) {
          setConvs((current) => patchConversationWithLatestMessage(current, conv, latestMessage, 0));
        }
      } catch {
        // keep current state
      } finally {
        messagesFetchInFlightRef.current.delete(requestKey);
        if (!background) {
          setMsgsLoading(false);
        } else if (isActiveConversationRequest && loadedConversationRef.current === requestKey) {
          setMsgsRefreshing(false);
        }
      }
    },
    [setCachedConversationMessages]
  );

  const loadOlderMessages = React.useCallback(async () => {
    if (!selectedConv || !messagesCursor || messagesLoadingOlder) return;
    setMessagesLoadingOlder(true);
    try {
      const params = new URLSearchParams({
        before: messagesCursor,
        limit: "50",
      });
      const res = await fetch(`/api/messages/${selectedConv.id}?${params.toString()}`);
      const data: MsgsResponse = await res.json();
      const olderMessages = data.messages ?? [];
      const mergedMessages = patchCachedConversationMessages(selectedConv, (current) => mergeMessages(olderMessages, current));

      if (loadedConversationRef.current === getStableConversationKey(selectedConv)) {
        setMessages(mergedMessages);
      }

      setMessagesHasMore(Boolean(data.hasMore));
      setMessagesCursor(data.nextCursor ?? null);
    } catch {
      // keep current page
    } finally {
      setMessagesLoadingOlder(false);
    }
  }, [messagesCursor, messagesLoadingOlder, patchCachedConversationMessages, selectedConv]);

  React.useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  React.useEffect(() => {
    void loadConnectionDebug();
  }, [loadConnectionDebug]);

  const loadConversationsRef = React.useRef(loadConversations);
  const loadMessagesRef = React.useRef(loadMessages);
  const selectedConvRef = React.useRef(selectedConv);

  React.useEffect(() => {
    loadConversationsRef.current = loadConversations;
    loadMessagesRef.current = loadMessages;
    selectedConvRef.current = selectedConv;
  }, [loadConversations, loadMessages, selectedConv]);

  React.useEffect(() => {
    if (!pageVisible) return;

    // Apenas 1 polling global sincronizado e mais lento para reduzir gargalos
    const interval = setInterval(async () => {
      try {
        if (connection?.status === "waiting") {
          await loadConversationsRef.current(true);
        } else if (connection?.status === "online") {
          await loadConversationsRef.current(true);

          const activeConversationId = selectedIdRef.current ?? selectedId;
          if (activeConversationId) {
            const activeConversation =
              selectedConversationSnapshotRef.current &&
              getStableConversationKey(selectedConversationSnapshotRef.current) === selectedStableKeyRef.current
                ? selectedConversationSnapshotRef.current
                : selectedConvRef.current;
            if (activeConversation) {
              await loadMessagesRef.current(activeConversation, true);
            }
          }
        }
      } catch {
        // ignora erros para manter o loop vivo
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [pageVisible, connection?.status, selectedId]);

  React.useEffect(() => {
    if (!selectedConv) {
      if (selectedIdRef.current) return;
      loadedConversationRef.current = null;
      pendingInitialScrollRef.current = false;
      clearScheduledInitialScrolls();
      setMessages([]);
      setAnalysis(null);
      setMessagesHasMore(false);
      setMessagesCursor(null);
      return;
    }

    const stableConversationKey = getStableConversationKey(selectedConv);
    const cachedMessages = getCachedConversationMessages(selectedConv);
    const cacheAge = Date.now() - (messageCacheUpdatedAtRef.current[stableConversationKey] ?? 0);
    const hasFreshCache = cachedMessages.length > 0 && cacheAge <= MESSAGE_CACHE_STALE_MS;

    if (loadedConversationRef.current === stableConversationKey) {
      void loadMessages(selectedConv, true);
      return;
    }

    loadedConversationRef.current = stableConversationKey;
    pendingInitialScrollRef.current = true;
    setMessages(cachedMessages);
    setAnalysis(null);
    setMessagesHasMore(false);
    setMessagesCursor(null);
    void loadMessages(selectedConv, hasFreshCache);
  }, [clearScheduledInitialScrolls, getCachedConversationMessages, selectedConv?.id, selectedConv?.contactPhone, loadMessages]);

  React.useEffect(() => {
    if (!pageVisible || convs.length === 0 || connection?.status !== "online") return;

    const prefetchCandidates = convs
      .filter((conversation) => conversation.id !== selectedConv?.id)
      .filter((conversation) => conversation.unreadCount > 0 || !conversation.leadId)
      .slice(0, MESSAGE_PREFETCH_LIMIT);

    for (const conversation of prefetchCandidates) {
      const stableKey = getStableConversationKey(conversation);
      const cacheAge = Date.now() - (messageCacheUpdatedAtRef.current[stableKey] ?? 0);
      const hasFreshCache =
        (messageCacheRef.current[stableKey]?.length ?? 0) > 0 &&
        cacheAge <= MESSAGE_CACHE_STALE_MS;

      if (hasFreshCache || messagesFetchInFlightRef.current.has(stableKey)) continue;
      void loadMessages(conversation, true);
    }
  }, [connection?.status, convs, loadMessages, pageVisible, selectedConv?.id]);

  React.useEffect(() => {
    if (!convs.length) return;

    if (focusConversationId) {
      const conversation = convs.find((item) => item.id === focusConversationId);
      if (conversation && conversation.id !== selectedId) {
        setSelectedId(conversation.id);
        return;
      }
    }

    if (focusLeadId) {
      const conversation = convs.find((item) => item.leadId === focusLeadId);
      if (conversation && conversation.id !== selectedId) {
        setSelectedId(conversation.id);
      }
    }
  }, [convs, focusConversationId, focusLeadId, selectedId]);

  React.useLayoutEffect(() => {
    const viewport = threadViewportRef.current;
    if (!viewport || messages.length === 0) {
      lastMessageIdRef.current = messages.at(-1)?.id ?? null;
      return;
    }

    const stableConversationKey = selectedConv ?getStableConversationKey(selectedConv) : null;
    const lastMessage = messages.at(-1) ?? null;
    const lastMessageId = lastMessage?.id ?? null;
    const conversationChanged = stableConversationKey !== lastStableConversationKeyRef.current;
    const messageChanged = lastMessageId !== lastMessageIdRef.current;
    const shouldForceInitialScroll = pendingInitialScrollRef.current && messages.length > 0;

    if (!messageChanged && !conversationChanged && !shouldForceInitialScroll) {
      return;
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const nearBottom = distanceFromBottom <= 120;
    const shouldStickToBottom =
      shouldForceInitialScroll ||
      conversationChanged ||
      nearBottom ||
      lastMessage?.direction === "outbound";

    if (shouldStickToBottom) {
      scrollThreadToBottom();
    }

    if (shouldForceInitialScroll) {
      pendingInitialScrollRef.current = false;
    }

    lastStableConversationKeyRef.current = stableConversationKey;
    lastMessageIdRef.current = lastMessageId;
  }, [messages, scrollThreadToBottom, selectedConv]);

  React.useEffect(() => () => clearScheduledInitialScrolls(), [clearScheduledInitialScrolls]);

  React.useEffect(() => {
    if (!lead) {
      setLeadDraft(null);
      setLeadSuggestions([]);
      setLeadError("");
      setLeadSaved("");
      return;
    }

    const { id: _id, history: _history, ...editable } = lead;
    setLeadDraft(editable);
    setLeadError("");
    setLeadSaved("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  React.useEffect(() => {
    setLeadSuggestions(analysis?.leadSuggestions ?? []);
  }, [analysis]);

  const visibleConversations = React.useMemo(() => convs, [convs]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return visibleConversations;
    return visibleConversations.filter((c) => {
      const linkedLead =
        (c.leadId ? leadMap.get(c.leadId) : null) ??
        leadMapByPhone.get(normalizePhone(c.contactPhone)) ??
        null;
      return (
        c.contactName.toLowerCase().includes(term) ||
        linkedLead?.nome.toLowerCase().includes(term) ||
        c.contactPhone.toLowerCase().includes(term) ||
        linkedLead?.telefone.toLowerCase().includes(term) ||
        linkedLead?.whatsapp.toLowerCase().includes(term) ||
        linkedLead?.email.toLowerCase().includes(term) ||
        linkedLead?.cidade.toLowerCase().includes(term) ||
        linkedLead?.profissao.toLowerCase().includes(term) ||
        linkedLead?.objecao_principal.toLowerCase().includes(term) ||
        linkedLead?.responsavel.toLowerCase().includes(term) ||
        c.lastMessage.toLowerCase().includes(term) ||
        linkedLead?.curso_de_interesse.toLowerCase().includes(term) ||
        linkedLead?.status_funil.toLowerCase().includes(term)
      );
    });
  }, [leadMap, leadMapByPhone, search, visibleConversations]);

  const inboxFiltered = React.useMemo(() => {
    return filtered.filter((conversation) => {
      const linkedLead = conversation.leadId ?leadMap.get(conversation.leadId) : null;
      const matchesCourse = courseFilter === "all" || linkedLead?.curso_de_interesse === courseFilter;
      const matchesFunnel = funnelFilter === "all" || linkedLead?.status_funil === funnelFilter;
      const matchesOwner = ownerFilter === "all" || (conversation.ownerName || UNASSIGNED_OWNER) === ownerFilter;
      const matchesSegment =
        inboxSegment === "all" ||
        (inboxSegment === "unread" && conversation.unreadCount > 0) ||
        (inboxSegment === "with-lead" && Boolean(conversation.leadId)) ||
        (inboxSegment === "without-lead" && !conversation.leadId) ||
        (inboxSegment === "overdue" && Boolean(linkedLead?.proximo_contato && isOverdue(linkedLead.proximo_contato))) ||
        (inboxSegment === "negotiation" && linkedLead?.status_funil === "Negociação");

      return matchesCourse && matchesFunnel && matchesOwner && matchesSegment;
    });
  }, [courseFilter, filtered, funnelFilter, inboxSegment, leadMap, ownerFilter]);

  const statusMeta = React.useMemo<StatusMeta>(() => {
    if (!connection) {
      return {
        label: "Offline",
        hint: "Sem configuração ativa",
        badge: "danger",
        icon: "offline",
      };
    }

    if (connection.status === "online") {
      return {
        label: "Online",
        hint: connection.connectedPhone ?`+${connection.connectedPhone}` : "Conectado ao WhatsApp",
        badge: "success",
        icon: "online",
      };
    }

    if (connection.status === "waiting") {
      return {
        label: "Configuração pendente",
        hint:
          connectionDebug?.missingRequirements.length
            ? `Faltando: ${connectionDebug.missingRequirements.join(", ")}`
            : connection.rawState ? `Estado: ${connection.rawState}` : "Canal oficial ainda não pronto para envio",
        badge: "gold",
        icon: "waiting",
      };
    }

    return {
      label: "Offline",
      hint: connection.rawState ?`Estado: ${connection.rawState}` : "Instância sem conexão",
      badge: "danger",
      icon: "offline",
    };
  }, [connection, connectionDebug]);

  const canSendMessages = canEdit && connection?.configured && connection.status === "online";

  React.useEffect(() => {
    setSending(outboxQueue.length > 0 || sendQueueInFlightRef.current);
  }, [outboxQueue]);

  function updateLeadField(field: keyof EditableLead, value: string) {
    setLeadDraft((current) => (current ? { ...current, [field]: value } : current));
    setLeadSaved("");
  }

  function acceptLeadSuggestion(field: LeadSuggestionField, value: string) {
    setLeadDraft((current) => (current ? { ...current, [field]: value } : current));
    setLeadSuggestions((current) => current.filter((suggestion) => suggestion.field !== field));
    setLeadSaved("");
  }

  function dismissLeadSuggestion(field: LeadSuggestionField) {
    setLeadSuggestions((current) => current.filter((suggestion) => suggestion.field !== field));
  }

  function resetLeadDraft() {
    if (!lead) return;
    const { id: _id, history: _history, ...editable } = lead;
    setLeadDraft(editable);
    setLeadError("");
    setLeadSaved("");
    setLeadSuggestions(analysis?.leadSuggestions ?? []);
  }

  async function saveLeadDetails() {
    if (!lead || !leadDraft) return;
    const validation = validateLead(leadDraft);
    if (validation) {
      setLeadError(validation);
      return;
    }

    setLeadSaving(true);
    setLeadError("");
    try {
      await onUpsertLead(lead.id, leadDraft);
      setLeadSaved("Informações do lead atualizadas.");
    } catch (error) {
      setLeadError(error instanceof Error ?error.message : "Não foi possível salvar as alterações do lead.");
    } finally {
      setLeadSaving(false);
    }
  }

  async function reassignConversationOwner(newOwner: string) {
    if (!selectedConv || !lead || !canEdit) return;
    const trimmed = newOwner.trim();
    if (!trimmed || trimmed === lead.responsavel) return;

    setOwnerSaving(true);
    setOwnerError("");
    try {
      const { id: _id, history: _history, ...editable } = lead;
      const updated = { ...editable, responsavel: trimmed };
      await onUpsertLead(lead.id, updated);
      setLeadDraft((current) => (current ? { ...current, responsavel: trimmed } : current));
      setConvs((current) =>
        current.map((conversation) =>
          conversation.id === selectedConv.id ? { ...conversation, ownerName: trimmed } : conversation
        )
      );
    } catch (error) {
      setOwnerError(error instanceof Error ? error.message : "Não foi possível atualizar o responsável.");
    } finally {
      setOwnerSaving(false);
    }
  }

  async function updateConversationsUnreadState(conversationIds: string[], unread: boolean) {
    const uniqueIds = Array.from(new Set(conversationIds.map((id) => id.trim()).filter(Boolean)));
    if (!uniqueIds.length || !canEdit) return;

    const targetConversations = convs.filter((conversation) => uniqueIds.includes(conversation.id));
    if (!targetConversations.length) return;

    const unreadCount = unread ? 1 : 0;
    setBulkUpdating(true);
    setBulkError("");

    const previousConversations = convs;
    setConvs((current) =>
      current.map((conversation) =>
        uniqueIds.includes(conversation.id) ? { ...conversation, unreadCount } : conversation,
      ),
    );

    if (unread) {
      setSuppressedUnreadByKey((current) => {
        const next = { ...current };
        for (const conversation of targetConversations) {
          delete next[getStableConversationKey(conversation)];
        }
        return next;
      });
      setSeenConversationAtByKey((current) => {
        const next = { ...current };
        for (const conversation of targetConversations) {
          delete next[getStableConversationKey(conversation)];
        }
        return next;
      });
    } else {
      setSuppressedUnreadByKey((current) => {
        const next = { ...current };
        for (const conversation of targetConversations) {
          next[getStableConversationKey(conversation)] = Math.max(current[getStableConversationKey(conversation)] ?? 0, conversation.unreadCount);
        }
        return next;
      });
      setSeenConversationAtByKey((current) => {
        const next = { ...current };
        for (const conversation of targetConversations) {
          next[getStableConversationKey(conversation)] = conversation.lastMessageAt;
        }
        return next;
      });
    }

    try {
      const response = await fetch("/api/messages/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: unread ? "mark-unread" : "mark-read",
          conversationIds: uniqueIds,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível atualizar o status de leitura.");
      }
    } catch (error) {
      setConvs(previousConversations);
      setBulkError(error instanceof Error ? error.message : "Não foi possível atualizar o status de leitura.");
    } finally {
      setBulkUpdating(false);
    }
  }

  async function reassignConversationOwners(conversationIds: string[], newOwner: string) {
    const trimmed = newOwner.trim();
    const uniqueIds = Array.from(new Set(conversationIds.map((id) => id.trim()).filter(Boolean)));
    if (!trimmed || !uniqueIds.length || !canEdit) return 0;

    const targetConversations = convs.filter((conversation) => uniqueIds.includes(conversation.id) && conversation.leadId);
    if (!targetConversations.length) return 0;

    setBulkUpdating(true);
    setBulkError("");

    try {
      await Promise.all(
        targetConversations.map(async (conversation) => {
          const linkedLead = conversation.leadId ? leadMap.get(conversation.leadId) : null;
          if (!linkedLead) return;
          const { id: _id, history: _history, ...editable } = linkedLead;
          await onUpsertLead(linkedLead.id, { ...editable, responsavel: trimmed });
        }),
      );

      setConvs((current) =>
        current.map((conversation) =>
          uniqueIds.includes(conversation.id) ? { ...conversation, ownerName: trimmed } : conversation,
        ),
      );
      setLeadDraft((current) => (current ? { ...current, responsavel: trimmed } : current));
      return targetConversations.length;
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "Não foi possível reatribuir os responsáveis.");
      return 0;
    } finally {
      setBulkUpdating(false);
    }
  }

  async function applyStatus() {
    if (!selectedConv?.leadId || !analysis?.suggestedStatus) return;
    setApplyingStatus(true);
    try {
      await onStatusChange(selectedConv.leadId, analysis.suggestedStatus as FunnelStatus);
      setConvs((prev) =>
        prev.map((c) =>
          c.id === selectedConv.id ? { ...c, leadStatus: analysis.suggestedStatus } : c
        )
      );
    } finally {
      setApplyingStatus(false);
    }
  }

  async function sendMessage(content: string) {
    if (!selectedConv || !content.trim() || !canSendMessages) return;

    const trimmedContent = content.trim();
    const outboundPhone = (lead?.whatsapp || lead?.telefone || selectedConv.contactPhone).trim();
    const optimisticMessage = buildOptimisticMessage(selectedConv, {
      type: "text",
      content: trimmedContent,
      filename: null,
      sequence: ++optimisticMessageSeqRef.current,
    });

    setMessageError("");
    setMessages((current) => mergeMessages(current, [optimisticMessage]));
    patchCachedConversationMessages(selectedConv, (current) => mergeMessages(current, [optimisticMessage]));
    setConvs((current) => patchConversationWithLatestMessage(current, selectedConv, optimisticMessage, 0));
    setOutboxQueue((current) => [
      ...current,
      {
        queueId: optimisticMessage.clientTempId || optimisticMessage.id,
        tempMessageId: optimisticMessage.id,
        kind: "text",
        conversation: selectedConv,
        payload: {
          phone: outboundPhone,
          content: trimmedContent,
        },
      },
    ]);
  }

  async function sendAttachment(file: File, caption: string) {
    if (!selectedConv || !canSendMessages) return;

    const trimmedCaption = caption.trim();
    const outboundPhone = (lead?.whatsapp || lead?.telefone || selectedConv.contactPhone).trim();
    const optimisticMessage = buildOptimisticMessage(selectedConv, {
      type: inferAttachmentMessageType(file),
      content: trimmedCaption,
      filename: file.name,
      sequence: ++optimisticMessageSeqRef.current,
    });

    setMessageError("");
    setMessages((current) => mergeMessages(current, [optimisticMessage]));
    patchCachedConversationMessages(selectedConv, (current) => mergeMessages(current, [optimisticMessage]));
    setConvs((current) => patchConversationWithLatestMessage(current, selectedConv, optimisticMessage, 0));
    setOutboxQueue((current) => [
      ...current,
      {
        queueId: optimisticMessage.clientTempId || optimisticMessage.id,
        tempMessageId: optimisticMessage.id,
        kind: "attachment",
        conversation: selectedConv,
        payload: {
          phone: outboundPhone,
          caption: trimmedCaption,
          file,
        },
      },
    ]);
  }

  async function updateConversationWorkspace(payload: {
    priority?: ConversationPriority;
    serviceStatus?: ConversationServiceStatus;
    tags?: string[];
    pinnedNote?: string;
  }) {
    if (!selectedConv || !canEdit) return;
    setWorkspaceSaving(true);
    setWorkspaceError("");
    try {
      const response = await fetch(`/api/messages/workspace/${selectedConv.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível atualizar o atendimento.");
      }
      setConvs((current) =>
        current.map((conversation) =>
          getStableConversationKey(conversation) === getStableConversationKey(selectedConv)
            ? { ...conversation, workspace: data.workspace ?? conversation.workspace }
            : conversation
        )
      );
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Não foi possível atualizar o atendimento.");
      throw error;
    } finally {
      setWorkspaceSaving(false);
    }
  }

  async function initiateCall(note: string) {
    await registerConversationAttempt({ type: "ligacao", note });
  }

  async function registerConversationAttempt(payload: {
    type: ConversationAttemptType;
    note: string;
  }) {
    if (!selectedConv || !canEdit) return;
    setWorkspaceSaving(true);
    setWorkspaceError("");
    try {
      const response = await fetch(`/api/messages/workspace/${selectedConv.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível registrar a tentativa.");
      }
      setConvs((current) =>
        current.map((conversation) =>
          getStableConversationKey(conversation) === getStableConversationKey(selectedConv)
            ? { ...conversation, workspace: data.workspace ?? conversation.workspace }
            : conversation
        )
      );
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Não foi possível registrar a tentativa.");
      throw error;
    } finally {
      setWorkspaceSaving(false);
    }
  }

  React.useEffect(() => {
    const nextItem = outboxQueue[0];
    if (!nextItem || sendQueueInFlightRef.current) return;

    sendQueueInFlightRef.current = true;
    setSending(true);

    void (async () => {
      try {
        const sentMessage =
          nextItem.kind === "text"
            ? await postTextMessage(nextItem)
            : await postAttachmentMessage(nextItem);

        const nextCachedMessages = patchCachedConversationMessages(nextItem.conversation, (current) =>
          replaceOptimisticMessage(current, nextItem.tempMessageId, sentMessage)
        );
        if (selectedStableKeyRef.current && getStableConversationKey(nextItem.conversation) === selectedStableKeyRef.current) {
          setMessages(nextCachedMessages);
        }
        setConvs((current) => patchConversationWithLatestMessage(current, nextItem.conversation, sentMessage, 0));

        const selectedStableKey = selectedConv ? getStableConversationKey(selectedConv) : null;
        if (selectedStableKey && getStableConversationKey(nextItem.conversation) === selectedStableKey) {
          void loadMessages(nextItem.conversation, true);
        }
        void loadConversations(true);
      } catch (error) {
        setMessageError(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
        const nextCachedMessages = patchCachedConversationMessages(nextItem.conversation, (current) =>
          markOptimisticMessageFailed(
            current,
            nextItem.tempMessageId,
            error instanceof Error ? error.message : "Falha no envio",
          )
        );
        if (selectedStableKeyRef.current && getStableConversationKey(nextItem.conversation) === selectedStableKeyRef.current) {
          setMessages(nextCachedMessages);
        }
      } finally {
        setOutboxQueue((current) => current.filter((item) => item.queueId !== nextItem.queueId));
        sendQueueInFlightRef.current = false;
        setSending(false);
      }
    })();
  }, [loadConversations, loadMessages, outboxQueue, selectedConv]);

  async function postTextMessage(item: Extract<PendingOutboundMessage, { kind: "text" }>) {
    const res = await fetch(`/api/messages/${item.conversation.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || "Não foi possível enviar a mensagem.");
    }

    return data.message as Message;
  }

  async function postAttachmentMessage(item: Extract<PendingOutboundMessage, { kind: "attachment" }>) {
    const formData = new FormData();
    formData.append("phone", item.payload.phone);
    formData.append("caption", item.payload.caption);
    formData.append("file", item.payload.file);

    const res = await fetch(`/api/messages/${item.conversation.id}`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || "Não foi possível enviar o anexo.");
    }

    return data.message as Message;
  }

  return {
    state: {
      convs,
      connection,
      loading,
      refreshingConversations,
      search,
      courseFilter,
      funnelFilter,
      inboxSegment,
      ownerFilter,
      ownerOptions,
      selectedId,
      messages: conversationMessages,
      msgsLoading,
      msgsRefreshing,
      messagesHasMore,
      messagesLoadingOlder,
      sending,
      qrLoading,
      messageError,
      analysis,
      analysisLoading,
      applyingStatus,
      leadDraft,
      leadSuggestions,
      leadSaving,
      leadError,
      leadSaved,
      webhookLoading,
      embeddedSignupLoading,
      embeddedSignupExchangeLoading,
      webhookMessage,
      disconnectLoading,
      workspaceSaving,
      workspaceError,
      ownerSaving,
      ownerError,
      bulkUpdating,
      bulkError,
      filtered: inboxFiltered,
      selectedConv,
      lead,
      statusMeta,
      connectionDebug,
      canSendMessages,
      bottomRef,
      threadViewportRef,
    },
    actions: {
      setSearch,
      setCourseFilter,
      setFunnelFilter,
      setInboxSegment,
      setOwnerFilter,
      setSelectedId,
      loadConversations,
      generateQrCode,
      disconnectWhatsApp,
      configureWebhook,
      startEmbeddedSignup,
      exchangeEmbeddedSignupCode,
      runAnalysis,
      loadOlderMessages,
      updateLeadField,
      acceptLeadSuggestion,
      dismissLeadSuggestion,
      resetLeadDraft,
      saveLeadDetails,
      applyStatus,
      sendMessage,
      sendAttachment,
      updateConversationWorkspace,
      registerConversationAttempt,
      initiateCall,
      reassignConversationOwner,
      updateConversationsUnreadState,
      reassignConversationOwners,
    },
    meta: {
      isAdmin,
      canEdit,
      canInspectAll,
    },
  };
}

function sameConversationCollection(current: Conversation[], next: Conversation[]) {
  if (current === next) return true;
  if (current.length !== next.length) return false;
  return current.every((conversation, index) => {
    const candidate = next[index];
    return (
      conversation.id === candidate.id &&
      conversation.lastMessage === candidate.lastMessage &&
      conversation.lastMessageAt === candidate.lastMessageAt &&
      conversation.lastMessageDirection === candidate.lastMessageDirection &&
      conversation.unreadCount === candidate.unreadCount &&
      conversation.leadId === candidate.leadId &&
      conversation.leadStatus === candidate.leadStatus &&
      conversation.ownerName === candidate.ownerName &&
      conversation.contactName === candidate.contactName &&
      conversation.contactPhone === candidate.contactPhone &&
      sameWorkspace(conversation.workspace, candidate.workspace)
    );
  });
}

function sameMessageCollection(current: Message[], next: Message[]) {
  if (current === next) return true;
  if (current.length !== next.length) return false;
  return current.every((message, index) => {
    const candidate = next[index];
    return (
      message.id === candidate.id &&
      message.conversationId === candidate.conversationId &&
      message.content === candidate.content &&
      message.timestamp === candidate.timestamp &&
      message.status === candidate.status &&
      message.type === candidate.type &&
      message.direction === candidate.direction &&
      message.mediaUrl === candidate.mediaUrl
    );
  });
}

function sameConnectionState(current: MessagingConnectionState | null, next: MessagingConnectionState | null) {
  if (current === next) return true;
  if (!current || !next) return current === next;
  return (
    current.configured === next.configured &&
    current.provider === next.provider &&
    current.status === next.status &&
    current.rawState === next.rawState &&
    current.qrCode === next.qrCode &&
    current.pairingCode === next.pairingCode &&
    current.instanceName === next.instanceName &&
    current.connectedPhone === next.connectedPhone &&
    current.connectedName === next.connectedName &&
    current.managerUrl === next.managerUrl &&
    current.updatedAt === next.updatedAt
  );
}

function sameConnectionDebugState(current: ConnectionDebugState | null, next: ConnectionDebugState | null) {
  if (current === next) return true;
  if (!current || !next) return current === next;
  return (
    current.provider === next.provider &&
    current.configured === next.configured &&
    current.webhookUrl === next.webhookUrl &&
    current.canSendMessages === next.canSendMessages &&
    current.phoneNumberIdConfigured === next.phoneNumberIdConfigured &&
    current.accessTokenConfigured === next.accessTokenConfigured &&
    current.verifyTokenConfigured === next.verifyTokenConfigured &&
    current.appSecretConfigured === next.appSecretConfigured &&
    current.missingRequirements.length === next.missingRequirements.length &&
    current.missingRequirements.every((item, index) => item === next.missingRequirements[index]) &&
    current.embeddedSignup.enabled === next.embeddedSignup.enabled &&
    current.embeddedSignup.coexistenceEnabled === next.embeddedSignup.coexistenceEnabled &&
    current.embeddedSignup.setupStatus === next.embeddedSignup.setupStatus &&
    current.embeddedSignup.appIdConfigured === next.embeddedSignup.appIdConfigured &&
    current.embeddedSignup.configIdConfigured === next.embeddedSignup.configIdConfigured &&
    current.embeddedSignup.redirectUriConfigured === next.embeddedSignup.redirectUriConfigured &&
    current.embeddedSignup.callbackUrl === next.embeddedSignup.callbackUrl &&
    current.embeddedSignup.redirectUri === next.embeddedSignup.redirectUri &&
    current.embeddedSignup.lastEventType === next.embeddedSignup.lastEventType &&
    current.embeddedSignup.lastCodeCaptured === next.embeddedSignup.lastCodeCaptured &&
    current.embeddedSignup.lastWabaId === next.embeddedSignup.lastWabaId &&
    current.embeddedSignup.lastPhoneNumberId === next.embeddedSignup.lastPhoneNumberId &&
    current.embeddedSignup.businessTokenCaptured === next.embeddedSignup.businessTokenCaptured &&
    current.embeddedSignup.linkedAt === next.embeddedSignup.linkedAt &&
    current.embeddedSignup.missingRequirements.length === next.embeddedSignup.missingRequirements.length &&
    current.embeddedSignup.missingRequirements.every((item, index) => item === next.embeddedSignup.missingRequirements[index])
  );
}

function sameAnalysis(current: ConversationAnalysis | null, next: ConversationAnalysis | null) {
  if (current === next) return true;
  if (!current || !next) return current === next;
  const currentSuggestions = current.leadSuggestions ?? [];
  const nextSuggestions = next.leadSuggestions ?? [];
  return (
    current.summary === next.summary &&
    current.sentiment === next.sentiment &&
    current.urgency === next.urgency &&
    current.suggestedStatus === next.suggestedStatus &&
    current.suggestedAction === next.suggestedAction &&
    currentSuggestions.length === nextSuggestions.length &&
    currentSuggestions.every((suggestion, index) => {
      const candidate = nextSuggestions[index];
      return (
        suggestion.field === candidate.field &&
        suggestion.label === candidate.label &&
        suggestion.currentValue === candidate.currentValue &&
        suggestion.suggestedValue === candidate.suggestedValue &&
        suggestion.reason === candidate.reason
      );
    }) &&
    current.source === next.source
  );
}

function mergeMessages(current: Message[], incoming: Message[]) {
  const filteredIncoming = incoming.filter(isRenderableMessage);
  const currentById = new Map(current.map((message) => [message.id, message]));
  const merged = new Map<string, Message>();

  for (const message of [...current, ...filteredIncoming]) {
    const existing = currentById.get(message.id);
    merged.set(message.id, existing && sameMessage(existing, message) ?existing : message);
  }

  const next = Array.from(merged.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return sameMessageCollection(current, next) ?current : next;
}

function reconcileMessages(current: Message[], incoming: Message[]) {
  const filteredIncoming = incoming.filter(isRenderableMessage);
  if (current.length === 0) {
    return filteredIncoming;
  }

  const merged = new Map<string, Message>();

  for (const message of current) {
    merged.set(message.id, message);
  }

  for (const message of filteredIncoming) {
    const existing = merged.get(message.id);
    merged.set(message.id, existing && sameMessage(existing, message) ? existing : message);
  }

  const next = Array.from(merged.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return sameMessageCollection(current, next) ?current : next;
}

function reconcileConversationMessages(current: Message[], incoming: Message[], conversationId: string) {
  const filteredIncoming = incoming.filter(isRenderableMessage);

  // Correção 2: filtrar current exclusivamente pela conversa alvo antes de qualquer merge.
  // Garante que mensagens de outras conversas que ainda residam no estado interno
  // (p.ex. por timing de outbox) não contaminem o resultado.
  const currentForConv = current.filter((message) => message.conversationId === conversationId);

  const optimisticCurrent = currentForConv.filter(
    (message) => typeof message.localDeliveryState !== "undefined",
  );

  if (optimisticCurrent.length === 0) {
    return filteredIncoming;
  }

  return reconcileMessages(optimisticCurrent, filteredIncoming);
}

function sameMessage(current: Message, next: Message) {
  return (
    current.id === next.id &&
    current.conversationId === next.conversationId &&
    current.content === next.content &&
    current.timestamp === next.timestamp &&
    current.status === next.status &&
    current.type === next.type &&
    current.direction === next.direction &&
    current.mediaUrl === next.mediaUrl &&
    current.localDeliveryState === next.localDeliveryState
  );
}

function sameWorkspace(current: Conversation["workspace"], next: Conversation["workspace"]) {
  if (current === next) return true;
  if (!current || !next) return current === next;
  return (
    current.priority === next.priority &&
    current.serviceStatus === next.serviceStatus &&
    current.pinnedNote === next.pinnedNote &&
    current.updatedAt === next.updatedAt &&
    current.tags.length === next.tags.length &&
    current.tags.every((tag, index) => tag === next.tags[index]) &&
    current.attempts.length === next.attempts.length &&
    current.attempts.every((attempt, index) => {
      const candidate = next.attempts[index];
      return (
        attempt.id === candidate.id &&
        attempt.type === candidate.type &&
        attempt.note === candidate.note &&
        attempt.createdAt === candidate.createdAt &&
        attempt.createdByName === candidate.createdByName
      );
    })
  );
}

function isRenderableMessage(message: Message) {
  return Boolean(message.content.trim() || message.mediaUrl);
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function getStableConversationKey(conversation: Conversation) {
  return normalizePhone(conversation.workspace?.conversationKey) || normalizePhone(conversation.contactPhone) || normalizePhone(conversation.id) || conversation.id;
}

function patchConversationWithLatestMessage(
  conversations: Conversation[],
  targetConversation: Conversation,
  latestMessage: Message,
  unreadCount: number,
) {
  const stableKey = getStableConversationKey(targetConversation);
  const next = conversations.map((conversation) =>
    getStableConversationKey(conversation) === stableKey
      ? (() => {
          const currentTime = messageTimeValue(conversation.lastMessageAt);
          const incomingTime = messageTimeValue(latestMessage.timestamp);
          if (incomingTime < currentTime) {
            return conversation;
          }

          return {
            ...conversation,
            lastMessage: latestMessage.content,
            lastMessageAt: latestMessage.timestamp,
            lastMessageDirection: latestMessage.direction,
            unreadCount,
          };
        })()
      : conversation,
  );

  return next.sort((a, b) => messageTimeValue(b.lastMessageAt) - messageTimeValue(a.lastMessageAt));
}

function messageTimeValue(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildOptimisticMessage(
  conversation: Conversation,
  payload: {
    type: Message["type"];
    content: string;
    filename: string | null;
    sequence: number;
  },
): Message {
  const timestamp = new Date(Date.now() + payload.sequence).toISOString();
  const clientTempId = `local-${conversation.id}-${payload.sequence}-${Math.random().toString(36).slice(2, 8)}`;
  const fallbackContent = payload.content.trim() || (payload.filename ? `Arquivo: ${payload.filename}` : "Mensagem");

  return {
    id: clientTempId,
    clientTempId,
    conversationId: conversation.id,
    direction: "outbound",
    type: payload.type,
    content: fallbackContent,
    status: "sent",
    timestamp,
    localDeliveryState: "pending",
  };
}

function replaceOptimisticMessage(current: Message[], tempMessageId: string, sentMessage: Message): Message[] {
  // Correção 3: se o tempId não existe em current, o estado já foi limpo por uma
  // troca de conversa. Retornar current sem modificar evita injetar a mensagem
  // confirmada de uma conversa antiga no estado da conversa atual.
  if (!current.some((message) => message.id === tempMessageId)) {
    return current;
  }

  const replaced = current.map((message) =>
    message.id === tempMessageId
      ? {
          ...sentMessage,
          localDeliveryState: undefined,
          clientTempId: message.clientTempId,
        }
      : message,
  );

  return mergeMessages(replaced, []);
}

function markOptimisticMessageFailed(current: Message[], tempMessageId: string, errorMessage: string): Message[] {
    return current.map((message) =>
      message.id === tempMessageId
        ? {
            ...message,
            localDeliveryState: "failed" as const,
            content: message.content || errorMessage,
          }
        : message,
  );
}

function inferAttachmentMessageType(file: File): Message["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}
