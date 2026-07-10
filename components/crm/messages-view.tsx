"use client";

import * as React from "react";
import { GripVertical, LayoutList, Minus, Plus, RadioTower, X } from "lucide-react";
import { LeadDialog } from "@/components/crm/lead-dialog";
import { ConnectionStatusCard } from "@/features/messages/components/connection-status-card";
import { ConversationList, EmptyConversationSelection } from "@/features/messages/components/conversation-list";
import { ConversationThread } from "@/features/messages/components/conversation-thread";
import { GuidedInbox } from "@/features/messages/components/guided-inbox";
import { LeadSidePanel } from "@/features/messages/components/lead-side-panel";
import { MessageComposer } from "@/features/messages/components/message-composer";
import { useMessagesView } from "@/features/messages/hooks/use-messages-view";
import { buildBlankLead, currentDate, LEAD_SLA_HOURS, UNASSIGNED_OWNER, type CourseSegments, type FunnelStatus, type Lead, type LeadList } from "@/lib/crm";

type Props = {
  leads: Lead[];
  leadLists: LeadList[];
  onStatusChange: (leadId: string, status: FunnelStatus) => Promise<void>;
  onUpsertLead: (leadId: string | null, lead: Omit<Lead, "id" | "history">) => Promise<void>;
  onCreateTask: (leadId: string, payload: { title: string; owner: string; dueDate: string }) => Promise<void>;
  focusLeadId?: string | null;
  focusConversationId?: string | null;
  ownerOptions: readonly string[];
  courseOptions: readonly string[];
  courseSegments?: CourseSegments;
  originOptions: readonly string[];
  captureMethodOptions: readonly string[];
  canEdit: boolean;
  userRole?: string;
  currentUserName?: string;
};

export function MessagesView({
  leads,
  leadLists,
  onStatusChange,
  onUpsertLead,
  onCreateTask,
  focusLeadId,
  focusConversationId,
  ownerOptions,
  courseOptions,
  courseSegments,
  originOptions,
  captureMethodOptions,
  canEdit,
  userRole,
  currentUserName,
}: Props) {
  const { state, actions, meta } = useMessagesView({
    leads,
    ownerOptions,
    focusLeadId,
    focusConversationId,
    onStatusChange,
    onUpsertLead,
    canEdit,
    isAdmin: userRole === "ADMIN",
    canInspectAll: userRole === "ADMIN" || userRole === "MANAGER",
    currentUserName,
  });
  const [compactLayout, setCompactLayout] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [leadPanelOpen, setLeadPanelOpen] = React.useState(false);
  const [bulkMode, setBulkMode] = React.useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = React.useState<string[]>([]);
  const [sidebarSection, setSidebarSection] = React.useState<"inbox" | "channel">("inbox");
  const [sidebarWidth, setSidebarWidth] = React.useState(390);
  const [overlaySidebarLayout, setOverlaySidebarLayout] = React.useState(false);
  const resizeStateRef = React.useRef<{ active: boolean; startX: number; startWidth: number }>({
    active: false,
    startX: 0,
    startWidth: 390,
  });

  const [createLeadOpen, setCreateLeadOpen] = React.useState(false);
  const [createLeadError, setCreateLeadError] = React.useState("");
  const [createLeadDraft, setCreateLeadDraft] = React.useState<Omit<Lead, "id" | "history">>(() =>
    buildBlankLead(
      {
        courses: [...courseOptions],
        courseSegments: courseSegments ?? {
          formacao: [...courseOptions],
          especializacao: [],
        },
        origins: [...originOptions],
        leadCaptureMethods: [...captureMethodOptions],
        owners: [...ownerOptions],
      },
      ownerOptions,
    ),
  );

  const slaExpiredCounts = React.useMemo(() => {
    const cutoff = Date.now() - LEAD_SLA_HOURS * 60 * 60 * 1000;
    const result: Record<string, number> = {};
    for (const lead of leads) {
      if (
        lead.status_funil === "Novo Lead" &&
        lead.responsavel !== UNASSIGNED_OWNER &&
        new Date(lead.data_entrada).getTime() < cutoff
      ) {
        result[lead.responsavel] = (result[lead.responsavel] ?? 0) + 1;
      }
    }
    return result;
  }, [leads]);

  const [guidedMode, setGuidedMode] = React.useState(false);
  const [guidedIndex, setGuidedIndex] = React.useState(0);
  const [guidedPendingSend, setGuidedPendingSend] = React.useState<{ conversationId: string; text: string } | null>(null);

  const guidedQueue = React.useMemo(() => {
    return [...state.filtered].sort((a, b) => {
      if (a.unreadCount > 0 !== b.unreadCount > 0) return a.unreadCount > 0 ? -1 : 1;
      return b.lastMessageAt.localeCompare(a.lastMessageAt);
    });
  }, [state.filtered]);

  React.useEffect(() => {
    setGuidedIndex(0);
  }, [guidedMode]);

  React.useEffect(() => {
    if (!guidedPendingSend) return;
    if (state.selectedId !== guidedPendingSend.conversationId) return;
    if (!state.selectedConv || state.selectedConv.id !== guidedPendingSend.conversationId) return;
    const text = guidedPendingSend.text;
    setGuidedPendingSend(null);
    void actions.sendMessage(text).then(() => {
      setGuidedIndex((current) => (guidedQueue.length ? (current + 1) % guidedQueue.length : 0));
    });
  }, [actions, guidedPendingSend, guidedQueue.length, state.selectedConv, state.selectedId]);

  function handleGuidedSendSuggestion(conversationId: string, text: string) {
    setGuidedPendingSend({ conversationId, text });
    actions.setSelectedId(conversationId);
  }

  function handleGuidedRespondNow(conversationId: string) {
    actions.setSelectedId(conversationId);
    setGuidedMode(false);
  }

  function buildCreateLeadDraft(
    conversation: NonNullable<typeof state.selectedConv>,
  ): Omit<Lead, "id" | "history"> {
    const normalizedContactName = conversation.contactName.trim();
    const normalizedContactPhone = conversation.contactPhone.trim();
    const seededName =
      normalizePhoneLikeText(normalizedContactName) === normalizePhoneLikeText(normalizedContactPhone)
        ? ""
        : normalizedContactName;

    return {
      ...buildBlankLead(
        {
          courses: [...courseOptions],
          courseSegments: courseSegments ?? {
            formacao: [...courseOptions],
            especializacao: [],
          },
          origins: [...originOptions],
          leadCaptureMethods: [...captureMethodOptions],
          owners: [...ownerOptions],
        },
        ownerOptions,
      ),
      nome: seededName,
      telefone: conversation.contactPhone,
      whatsapp: conversation.contactPhone,
      origem: "WhatsApp",
      origem_detalhe: `Conversa iniciada no inbox com ${seededName || conversation.contactPhone}`,
      captado_via: "Conversa WhatsApp",
      responsavel: ownerOptions[0] ?? "Equipe Comercial",
      status_funil: "Novo Lead",
      status_matricula: "Não iniciado",
      data_entrada: currentDate(0),
      proximo_contato: currentDate(1),
    };
  }

  function openCreateLeadDialog() {
    if (!state.selectedConv) return;
    setCreateLeadDraft({
      ...buildCreateLeadDraft(state.selectedConv),
    });
    setCreateLeadError("");
    setCreateLeadOpen(true);
  }

  React.useEffect(() => {
    function syncLayout() {
      const nextCompact = window.innerWidth < 1480;
      const nextOverlaySidebar = window.innerWidth < 1100;
      setCompactLayout(nextCompact);
      setOverlaySidebarLayout(nextOverlaySidebar);
      if (!nextCompact) {
        setSidebarOpen(true);
        setLeadPanelOpen(false);
      } else if (!nextOverlaySidebar) {
        setSidebarOpen(true);
      }
    }

    syncLayout();
    window.addEventListener("resize", syncLayout);
    return () => window.removeEventListener("resize", syncLayout);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("belart-crm-messages-sidebar-width");
    if (!stored) return;
    const value = Number(stored);
    if (Number.isFinite(value)) {
      setSidebarWidth(value);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("belart-crm-messages-sidebar-width", String(sidebarWidth));
  }, [sidebarWidth]);

  React.useEffect(() => {
    setLeadPanelOpen(false);
  }, [state.selectedId]);

  React.useEffect(() => {
    setSelectedConversationIds((current) => current.filter((conversationId) => state.convs.some((conversation) => conversation.id === conversationId)));
  }, [state.convs]);

  React.useEffect(() => {
    if (!bulkMode && selectedConversationIds.length > 0) {
      setSelectedConversationIds([]);
    }
  }, [bulkMode, selectedConversationIds.length]);

  const compactSidebarOverlay = compactLayout && overlaySidebarLayout && Boolean(state.selectedConv);
  const sideBySideCompact = compactLayout && !overlaySidebarLayout && Boolean(state.selectedConv);
  const minSidebarWidth = compactLayout ? 304 : 336;
  const maxSidebarWidth =
    typeof window === "undefined"
      ? 520
      : compactLayout
        ? Math.max(320, Math.min(window.innerWidth - 16, 460))
        : Math.max(380, Math.min(window.innerWidth * 0.42, 560));
  const resolvedSidebarWidth = Math.max(minSidebarWidth, Math.min(sidebarWidth, maxSidebarWidth));
  const collapsedSidebarWidth = 58;
  const sidebarInlineStyle = compactSidebarOverlay
    ? { width: `${resolvedSidebarWidth}px`, minWidth: `${resolvedSidebarWidth}px` }
    : sideBySideCompact
      ? sidebarOpen
        ? { width: `${resolvedSidebarWidth}px`, minWidth: `${resolvedSidebarWidth}px` }
        : { width: `${collapsedSidebarWidth}px`, minWidth: `${collapsedSidebarWidth}px` }
      : compactLayout
        ? undefined
        : { width: `${resolvedSidebarWidth}px`, minWidth: `${resolvedSidebarWidth}px` };

  const handleSelectConversation = React.useCallback((conversationId: string) => {
    actions.setSelectedId(conversationId);
    if (compactSidebarOverlay) {
      setSidebarOpen(false);
    }
  }, [actions, compactSidebarOverlay]);

  const toggleConversationSelection = React.useCallback((conversationId: string) => {
    setSelectedConversationIds((current) =>
      current.includes(conversationId)
        ? current.filter((id) => id !== conversationId)
        : [...current, conversationId],
    );
  }, []);

  const selectAllFilteredConversations = React.useCallback(() => {
    setSelectedConversationIds((current) => Array.from(new Set([...current, ...state.filtered.map((conversation) => conversation.id)])));
  }, [state.filtered]);

  const clearBulkSelection = React.useCallback(() => {
    setSelectedConversationIds([]);
  }, []);

  async function handleBulkMarkRead() {
    await actions.updateConversationsUnreadState(selectedConversationIds, false);
  }

  async function handleBulkMarkUnread() {
    await actions.updateConversationsUnreadState(selectedConversationIds, true);
  }

  async function handleBulkReassignOwner(owner: string) {
    await actions.reassignConversationOwners(selectedConversationIds, owner);
  }

  function resizeSidebar(nextWidth: number) {
    setSidebarWidth(Math.max(minSidebarWidth, Math.min(nextWidth, maxSidebarWidth)));
  }

  function startSidebarResize(event: React.PointerEvent<HTMLDivElement>) {
    if ((sideBySideCompact && !sidebarOpen) || (!compactSidebarOverlay && !sideBySideCompact && compactLayout)) return;
    resizeStateRef.current = {
      active: true,
      startX: event.clientX,
      startWidth: resolvedSidebarWidth,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }

  React.useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (!resizeStateRef.current.active) return;
      const delta = event.clientX - resizeStateRef.current.startX;
      resizeSidebar(resizeStateRef.current.startWidth + delta);
    }

    function handlePointerUp() {
      if (!resizeStateRef.current.active) return;
      resizeStateRef.current.active = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [maxSidebarWidth, minSidebarWidth]);

  async function handleCreateLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateLeadError("");
    try {
      await onUpsertLead(null, createLeadDraft);
      setCreateLeadOpen(false);
      await actions.loadConversations();
    } catch (error) {
      setCreateLeadError(error instanceof Error ?error.message : "Não foi possível cadastrar o lead.");
    }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setGuidedMode(false)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${!guidedMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Lista + conversa
            </button>
            <button
              type="button"
              onClick={() => setGuidedMode(true)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${guidedMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Modo guiado
            </button>
          </div>
          {compactLayout && !guidedMode ? (
            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => { setSidebarSection("inbox"); setSidebarOpen(true); }}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${sidebarSection === "inbox" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                aria-label="Ver inbox"
              >
                <LayoutList className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => { setSidebarSection("channel"); setSidebarOpen(true); }}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${sidebarSection === "channel" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                aria-label="Ver canal"
              >
                <RadioTower className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
        <span className="hidden sm:inline text-xs text-muted-foreground">
          {guidedMode ? "Foco total: uma conversa por vez" : "Visão completa: lista à esquerda, conversa no centro"}
        </span>
      </div>

      {guidedMode ? (
        <div className={["relative flex h-full min-h-0 overflow-hidden", compactLayout ? "rounded-none border-0 bg-background" : "rounded-2xl border"].join(" ")}>
          <GuidedInbox
            conversations={guidedQueue}
            leads={leads}
            index={guidedIndex}
            onIndexChange={setGuidedIndex}
            onRespondNow={handleGuidedRespondNow}
            onSendSuggestion={handleGuidedSendSuggestion}
            sending={Boolean(guidedPendingSend)}
          />
        </div>
      ) : (
      <div
        className={[
          "relative flex h-full min-h-0 overflow-hidden",
          compactLayout
            ? "rounded-none border-0 bg-background"
            : "rounded-2xl border  ",
        ].join(" ")}
      >
        {compactSidebarOverlay && sidebarOpen ? (
          <button
            type="button"
            className="absolute inset-0 z-30 bg-black/60 "
            aria-label="Fechar painel de mensagens"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}
        {compactLayout && leadPanelOpen ? (
          <button
            type="button"
            className="absolute inset-0 z-40 bg-black/60 "
            aria-label="Fechar painel do lead"
            onClick={() => setLeadPanelOpen(false)}
          />
        ) : null}

        <aside
          style={sidebarInlineStyle}
          className={[
            "flex h-full shrink-0 overflow-hidden border-r bg-muted/[0.08] transition-[transform,width,opacity] duration-200",
            compactLayout
              ? compactSidebarOverlay
                ? sidebarOpen
                  ? "absolute inset-y-0 left-0 z-40 translate-x-0 opacity-100 shadow-2xl"
                  : "pointer-events-none absolute inset-y-0 left-0 z-40 -translate-x-full opacity-0"
                : sideBySideCompact
                  ? "relative border-r"
                  : "w-full min-w-0 flex-1 border-r-0"
              : "",
          ].join(" ")}
        >
          <div className="flex h-full w-full min-w-0 bg-background">
            <div className={[
              "shrink-0 flex-col items-center border-r bg-gradient-to-b from-card via-background to-muted/40 py-3 dark:from-muted/25 dark:via-background dark:to-background",
              compactLayout ? "hidden" : "flex w-[68px]",
            ].join(" ")}>
              {compactSidebarOverlay ? (
                <button
                  type="button"
                  className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-xl border bg-background text-muted-foreground transition-colors hover:bg-muted"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Fechar painel lateral"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSidebarSection("inbox");
                    setSidebarOpen(true);
                  }}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
                    sidebarSection === "inbox" ? "border-transparent bg-primary text-primary-foreground " : "border-transparent text-muted-foreground hover:bg-secondary"
                  }`}
                  aria-label="Abrir inbox"
                >
                  <LayoutList className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSidebarSection("channel");
                    setSidebarOpen(true);
                  }}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
                    sidebarSection === "channel" ? "border-transparent bg-primary text-primary-foreground " : "border-transparent text-muted-foreground hover:bg-secondary"
                  }`}
                  aria-label="Abrir canal"
                >
                  <RadioTower className="h-4 w-4" />
                </button>
              </div>
              {(compactSidebarOverlay || !compactLayout || sideBySideCompact) && sidebarSection === "inbox" && sidebarOpen ? (
                <div className="mt-auto grid gap-2">
                  {sideBySideCompact ? (
                    <button
                      type="button"
                      onClick={() => setSidebarOpen(false)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition-colors hover:bg-muted"
                      aria-label="Minimizar inbox"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => resizeSidebar(resolvedSidebarWidth - 32)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition-colors hover:bg-muted"
                    aria-label="Diminuir largura do inbox"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => resizeSidebar(resolvedSidebarWidth + 32)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition-colors hover:bg-muted"
                    aria-label="Aumentar largura do inbox"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>

            <div className={["min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-background via-background to-muted/20", sideBySideCompact && !sidebarOpen ? "hidden" : "flex"].join(" ")}>
              {sidebarSection === "inbox" ? (
                <ConversationList
                  loading={state.loading}
                  refreshing={state.refreshingConversations}
                  leads={leads}
                  search={state.search}
                  courseFilter={state.courseFilter}
                  funnelFilter={state.funnelFilter}
                  inboxSegment={state.inboxSegment}
                  ownerFilter={state.ownerFilter}
                  courseOptions={courseOptions}
                  ownerOptions={state.ownerOptions}
                  filtered={state.filtered}
                  convs={state.convs}
                  selectedId={state.selectedId}
                  canInspectAll={meta.canInspectAll}
                  currentUserName={currentUserName}
                  slaExpiredCounts={slaExpiredCounts}
                  bulkMode={bulkMode}
                  selectedIds={selectedConversationIds}
                  bulkLoading={state.bulkUpdating}
                  bulkError={state.bulkError}
                  canBulkManage={meta.canEdit}
                  onSearchChange={actions.setSearch}
                  onCourseFilterChange={actions.setCourseFilter}
                  onFunnelFilterChange={actions.setFunnelFilter}
                  onInboxSegmentChange={actions.setInboxSegment}
                  onOwnerFilterChange={actions.setOwnerFilter}
                  onSelect={handleSelectConversation}
                  onBulkModeChange={setBulkMode}
                  onToggleSelection={toggleConversationSelection}
                  onSelectAllFiltered={selectAllFilteredConversations}
                  onClearSelection={clearBulkSelection}
                  onBulkMarkRead={handleBulkMarkRead}
                  onBulkMarkUnread={handleBulkMarkUnread}
                  onBulkReassignOwner={handleBulkReassignOwner}
                />
              ) : (
                <div className="crm-scrollbar flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-background to-muted/20">
                  <div className="border-b px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <span className="rounded-xl border border-primary/15 bg-primary/10 p-2 text-primary">
                        <RadioTower className="h-4 w-4" />
                      </span>
                      Canal
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">Conexão, fila técnica e operação do WhatsApp</p>
                  </div>
                  <ConnectionStatusCard
                    connection={state.connection}
                    connectionDebug={state.connectionDebug}
                    statusMeta={state.statusMeta}
                    loading={state.loading}
                    qrLoading={state.qrLoading}
                    disconnectLoading={state.disconnectLoading}
                    webhookLoading={state.webhookLoading}
                    embeddedSignupLoading={state.embeddedSignupLoading}
                    embeddedSignupExchangeLoading={state.embeddedSignupExchangeLoading}
                    webhookMessage={state.webhookMessage}
                    isAdmin={meta.isAdmin}
                    onRefresh={actions.loadConversations}
                    onGenerateQrCode={actions.generateQrCode}
                    onDisconnect={actions.disconnectWhatsApp}
                    onConfigureWebhook={actions.configureWebhook}
                    onStartEmbeddedSignup={actions.startEmbeddedSignup}
                    onExchangeEmbeddedSignupCode={actions.exchangeEmbeddedSignupCode}
                  />
                </div>
              )}
            </div>
          </div>
          {(compactSidebarOverlay || !compactLayout || sideBySideCompact) && sidebarSection === "inbox" && sidebarOpen ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionar inbox"
              onPointerDown={startSidebarResize}
              className="absolute inset-y-0 right-0 z-20 hidden w-3 -translate-x-1/2 cursor-col-resize items-center justify-center lg:flex"
            >
              <div className="flex h-16 w-2 items-center justify-center rounded-full border bg-background/92 text-muted-foreground">
                <GripVertical className="h-4 w-4" />
              </div>
            </div>
          ) : null}
        </aside>

        {!state.selectedConv ? (
          compactLayout ? null : <EmptyConversationSelection />
        ) : (
          <div className="flex min-w-0 flex-1 overflow-hidden bg-[#080808]">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
              <ConversationThread
                conversation={state.selectedConv}
                lead={state.lead}
                messages={state.messages}
                loading={state.msgsLoading}
                refreshing={state.msgsRefreshing}
                hasMore={state.messagesHasMore}
                loadingOlder={state.messagesLoadingOlder}
                bottomRef={state.bottomRef}
                viewportRef={state.threadViewportRef}
                canEdit={meta.canEdit}
                ownerOptions={ownerOptions}
                currentUserName={currentUserName}
                canInspectAll={meta.canInspectAll}
                onQuickStatusChange={(status) => actions.updateLeadField("status_funil", status)}
                onReassignConversation={actions.reassignConversationOwner}
                onInitiateCall={actions.initiateCall}
                onLoadOlderMessages={actions.loadOlderMessages}
                ownerSaving={state.ownerSaving}
                ownerError={state.ownerError}
                onCreateLead={!state.lead && meta.canEdit ? openCreateLeadDialog : undefined}
                onToggleInbox={compactLayout ? () => setSidebarOpen((current) => !current) : undefined}
                onOpenLeadPanel={state.lead ? () => setLeadPanelOpen(true) : undefined}
              />

              <MessageComposer
                conversationKey={state.selectedConv.id}
                connection={state.connection}
                canEdit={meta.canEdit}
                canSendMessages={state.canSendMessages}
                lead={state.lead}
                sending={state.sending}
                messageError={state.messageError}
                onSend={actions.sendMessage}
                onSendAttachment={actions.sendAttachment}
              />
            </div>

          </div>
        )}

        {leadPanelOpen && state.selectedConv ? (
          <LeadSidePanel
            conversation={state.selectedConv}
            lead={state.lead}
            leadDraft={state.leadDraft}
            analysis={state.analysis}
            analysisLoading={state.analysisLoading}
            applyingStatus={state.applyingStatus}
            leadSuggestions={state.leadSuggestions}
            ownerOptions={ownerOptions}
            courseOptions={courseOptions}
            courseSegments={courseSegments}
            originOptions={originOptions}
            captureMethodOptions={captureMethodOptions}
            canEdit={meta.canEdit}
            leadSaving={state.leadSaving}
            leadError={state.leadError}
            leadSaved={state.leadSaved}
            workspaceSaving={state.workspaceSaving}
            workspaceError={state.workspaceError}
            onCreateTask={onCreateTask}
            onUpdateField={actions.updateLeadField}
            onUpdateWorkspace={actions.updateConversationWorkspace}
            onRegisterAttempt={actions.registerConversationAttempt}
            onAcceptSuggestion={actions.acceptLeadSuggestion}
            onDismissSuggestion={actions.dismissLeadSuggestion}
            onAnalyze={() => actions.runAnalysis(state.selectedConv!)}
            onApplyStatus={actions.applyStatus}
            onReset={actions.resetLeadDraft}
            onSave={actions.saveLeadDetails}
            presentation="overlay"
            onClose={() => setLeadPanelOpen(false)}
          />
        ) : null}
      </div>
      )}
      <LeadDialog
        open={createLeadOpen}
        onOpenChange={setCreateLeadOpen}
        lead={createLeadDraft}
        setLead={setCreateLeadDraft}
        ownerOptions={ownerOptions}
        courseOptions={courseOptions}
        courseSegments={courseSegments}
        originOptions={originOptions}
        captureMethodOptions={captureMethodOptions}
        onSubmit={handleCreateLead}
        error={createLeadError}
        editing={false}
      />
    </>
  );
}

function normalizePhoneLikeText(value: string) {
  return value.replace(/\D+/g, "");
}
