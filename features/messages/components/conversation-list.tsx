"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  Clock3,
  ListFilter,
  MessageCircle,
  Search,
  ShieldAlert,
  UserRound,
  X,
  SlidersHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SmoothInput as Input } from "@/components/ui/smooth-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { funnelStatuses, isOverdue, type Lead, UNASSIGNED_OWNER } from "@/lib/crm";
import type { Conversation } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { fullDateTime, relativeTime } from "@/features/messages/lib/message-formatters";
import { funnelTagMap, priorityStyleMap, serviceStatusLabel } from "@/features/messages/lib/status-styles";
import { getAvatarPalette, getInitials } from "@/features/messages/lib/avatar";
import { TeamWorkloadBar } from "@/features/messages/components/team-workload-bar";
import { motion } from "framer-motion";

type InboxSegment = "all" | "unread" | "with-lead" | "without-lead" | "overdue" | "negotiation";

type Props = {
  loading: boolean;
  refreshing?: boolean;
  leads: Lead[];
  search: string;
  courseFilter: string;
  funnelFilter: string;
  inboxSegment: InboxSegment;
  ownerFilter: string;
  courseOptions: readonly string[];
  ownerOptions: readonly string[];
  filtered: Conversation[];
  convs: Conversation[];
  selectedId: string | null;
  canInspectAll: boolean;
  currentUserName?: string;
  slaExpiredCounts?: Record<string, number>;
  onSearchChange: (value: string) => void;
  onCourseFilterChange: (value: string) => void;
  onFunnelFilterChange: (value: string) => void;
  onInboxSegmentChange: (value: InboxSegment) => void;
  onOwnerFilterChange: (value: string) => void;
  onSelect: (conversationId: string) => void;
  bulkMode: boolean;
  selectedIds: string[];
  bulkLoading?: boolean;
  bulkError?: string;
  canBulkManage: boolean;
  onBulkModeChange: (enabled: boolean) => void;
  onToggleSelection: (conversationId: string) => void;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onBulkMarkRead: () => void;
  onBulkMarkUnread: () => void;
  onBulkReassignOwner: (owner: string) => void;
};

type ConversationListItemProps = {
  conversation: Conversation;
  linkedLead: Lead | null;
  selectedId: string | null;
  bulkMode: boolean;
  selected: boolean;
  onSelect: (conversationId: string) => void;
  onToggleSelection: (conversationId: string) => void;
};

const segmentLabels: Record<InboxSegment, string> = {
  all: "Todas",
  unread: "Não lidas",
  "with-lead": "Com lead",
  "without-lead": "Sem lead",
  overdue: "Atrasadas",
  negotiation: "Negociação",
};

function ConversationAvatar({ name, hasLead }: { name: string; hasLead: boolean }) {
  return (
    <span className="relative mt-1 shrink-0">
      <span className="grid h-12 w-12 place-items-center rounded-[18px] border border-primary/20 bg-primary/10 text-[14px] font-bold text-primary shadow-sm">
        {getInitials(name)}
      </span>
      <span
        className={cn(
          "absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-background",
          hasLead ? "bg-emerald-500" : "bg-white/20",
        )}
        title={hasLead ? "Lead cadastrado" : "Sem cadastro de lead"}
      />
    </span>
  );
}

export function ConversationList({
  loading, refreshing = false, leads, search, courseFilter, funnelFilter, inboxSegment,
  ownerFilter, courseOptions, ownerOptions, filtered, convs, selectedId, canInspectAll,
  currentUserName, slaExpiredCounts, onSearchChange, onCourseFilterChange, onFunnelFilterChange,
  onInboxSegmentChange, onOwnerFilterChange, onSelect, bulkMode, selectedIds, bulkLoading = false,
  bulkError = "", canBulkManage, onBulkModeChange, onToggleSelection, onSelectAllFiltered,
  onClearSelection, onBulkMarkRead, onBulkMarkUnread, onBulkReassignOwner,
}: Props) {
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [bulkOwnerDraft, setBulkOwnerDraft] = React.useState("all");
  const leadMap = React.useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const selectedIdSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const activeFilterCount = (courseFilter !== "all" ? 1 : 0) + (funnelFilter !== "all" ? 1 : 0) + (ownerFilter !== "all" ? 1 : 0) + (inboxSegment !== "all" ? 1 : 0);

  function resetFilters() {
    onCourseFilterChange("all"); onFunnelFilterChange("all"); onOwnerFilterChange("all"); onInboxSegmentChange("all");
  }

  const activeSegmentLabel = inboxSegment === "all" ? "Recorte rápido" : segmentLabels[inboxSegment];
  const overdueConversations = React.useMemo(() => convs.filter((conversation) => {
    const linkedLead = conversation.leadId ? leadMap.get(conversation.leadId) : null;
    return Boolean(linkedLead?.proximo_contato && isOverdue(linkedLead.proximo_contato));
  }), [convs, leadMap]);
  
  const negotiationConversations = React.useMemo(() => convs.filter((conversation) =>
    ["Negociação / Matrícula", "Aguardando Pagamento", "Negociacao / Matricula"].includes(conversation.leadStatus ?? "")
  ), [convs]);
  
  const activeQueueLabel = ownerFilter === UNASSIGNED_OWNER ? "Fila sem responsável" : inboxSegment === "unread" ? "Não lidas" : inboxSegment === "without-lead" ? "Novos contatos" : inboxSegment === "overdue" ? "Retornos atrasados" : inboxSegment === "negotiation" || funnelFilter === "Negociação / Matrícula" || funnelFilter === "Aguardando Pagamento" ? "Em negociação" : "Operação geral";
  const selectedCount = selectedIds.length;
  const allFilteredSelected = filtered.length > 0 && filtered.every((conversation) => selectedIds.includes(conversation.id));

  function toggleSegment(target: Extract<InboxSegment, "unread" | "overdue" | "negotiation">) {
    onCourseFilterChange("all"); onOwnerFilterChange("all"); onFunnelFilterChange("all"); onInboxSegmentChange(inboxSegment === target ? "all" : target);
  }

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-white/5 bg-background px-4 py-4 ">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Inbox</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-[18px] font-light text-white">{filtered.length} conversa{filtered.length === 1 ? "" : "s"}</p>
            </div>
          </div>

          <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
            <DialogTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="h-9 gap-2 rounded-full border-white/10 bg-white/5 px-4 hover:bg-white/10 text-[11px] font-bold uppercase tracking-widest text-white/70 relative">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Filtros</span>
                <span className="sm:hidden">{activeSegmentLabel}</span>
                {activeFilterCount > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-[#0c0c0c] border border-white/10 shadow-2xl rounded-[24px]">
              <DialogHeader>
                <DialogTitle className="text-white text-[18px] font-light">Filtrar inbox</DialogTitle>
                <DialogDescription className="text-white/40 text-[13px]">Refine a fila por interesse, funil e recortes operacionais.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-5">
                <div className={cn("grid gap-4", canInspectAll ? "md:grid-cols-2" : "grid-cols-1")}>
                  <div className="grid gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Interesse</p>
                    <Select value={courseFilter} onValueChange={onCourseFilterChange}>
                      <SelectTrigger className="h-10 text-[13px] rounded-xl border-white/10 bg-white/5 text-white">
                        <SelectValue placeholder="Interesse" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os interesses</SelectItem>
                        {courseOptions.map((course) => <SelectItem key={course} value={course}>{course}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Etapa do funil</p>
                    <Select value={funnelFilter} onValueChange={onFunnelFilterChange}>
                      <SelectTrigger className="h-10 text-[13px] rounded-xl border-white/10 bg-white/5 text-white">
                        <SelectValue placeholder="Funil" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as etapas</SelectItem>
                        {funnelStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {canInspectAll ? (
                    <div className="grid gap-2 md:col-span-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Atendimento</p>
                      <Select value={ownerFilter} onValueChange={onOwnerFilterChange}>
                        <SelectTrigger className="h-10 text-[13px] rounded-xl border-white/10 bg-white/5 text-white">
                          <SelectValue placeholder="Atendimento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os atendimentos</SelectItem>
                          {ownerOptions.map((owner) => <SelectItem key={owner} value={owner}>{owner}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Recorte rápido</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(segmentLabels) as InboxSegment[]).map((segment) => (
                      <Button
                        key={segment} type="button" size="sm" variant={inboxSegment === segment ? "default" : "outline"}
                        className={`h-9 justify-start px-4 text-[11px] font-bold tracking-widest uppercase rounded-xl ${inboxSegment === segment ? 'bg-primary text-white border-primary' : 'border-border bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'}`}
                        onClick={() => onInboxSegmentChange(segment)}
                      >
                        {segmentLabels[segment]}
                      </Button>
                    ))}
                  </div>
                </div>

                {activeFilterCount > 0 ? (
                  <div className="flex justify-end pt-2">
                    <Button type="button" size="sm" variant="ghost" className="gap-2 text-[11px] font-bold uppercase tracking-widest text-white/50 hover:text-white" onClick={resetFilters}>
                      <X className="h-3.5 w-3.5" /> Limpar filtros
                    </Button>
                  </div>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-4 relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            value={search} onChange={(e) => onSearchChange(e.target.value)}
            className="h-12 rounded-[16px] border-white/10 bg-white/5 pl-11 text-[13px] text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-primary/50"
            placeholder="Buscar lead, telefone ou contexto..."
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button" onClick={() => toggleSegment("unread")}
            className={cn("flex flex-col gap-2 rounded-[20px] border px-3 py-3 transition-colors", inboxSegment === "unread" ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-white/40 hover:bg-white/5 hover:text-white/80")}
          >
            <div className="flex w-full items-center justify-between">
              <MessageCircle className="h-4 w-4" />
              <span className="text-[18px] font-light">{convs.filter((c) => c.unreadCount > 0).length}</span>
            </div>
            <span className="w-full truncate text-left text-[9px] font-bold uppercase tracking-widest text-white/50">Não lidas</span>
          </button>
          
          <button
            type="button" onClick={() => toggleSegment("overdue")}
            className={cn("flex flex-col gap-2 rounded-[20px] border px-3 py-3 transition-colors", inboxSegment === "overdue" ? "border-rose-500/30 bg-rose-500/10 text-rose-400" : "border-border bg-card text-white/40 hover:bg-white/5 hover:text-white/80")}
          >
             <div className="flex w-full items-center justify-between">
               <ShieldAlert className="h-4 w-4" />
               <span className="text-[18px] font-light">{overdueConversations.length}</span>
             </div>
             <span className="w-full truncate text-left text-[9px] font-bold uppercase tracking-widest text-white/50">Atrasadas</span>
          </button>
          
          <button
            type="button" onClick={() => toggleSegment("negotiation")}
            className={cn("flex flex-col gap-2 rounded-[20px] border px-3 py-3 transition-colors", inboxSegment === "negotiation" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-border bg-card text-white/40 hover:bg-white/5 hover:text-white/80")}
          >
            <div className="flex w-full items-center justify-between">
              <BriefcaseBusiness className="h-4 w-4" />
              <span className="text-[18px] font-light">{negotiationConversations.length}</span>
            </div>
            <span className="w-full truncate text-left text-[9px] font-bold uppercase tracking-widest text-white/50">Negociação</span>
          </button>
        </div>

        <div className="mt-4">
          <TeamWorkloadBar convs={convs} ownerOptions={ownerOptions} ownerFilter={ownerFilter} canInspectAll={canInspectAll} currentUserName={currentUserName} slaExpiredCounts={slaExpiredCounts} onOwnerFilterChange={onOwnerFilterChange} />
        </div>

        {bulkMode ? (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-[16px] border border-primary/20 bg-primary/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[14px] font-medium text-white">{selectedCount} selecionado{selectedCount === 1 ? "" : "s"}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-8 rounded-full border-white/10 bg-white/5 px-3 text-[10px] font-bold uppercase tracking-widest text-white/70" onClick={allFilteredSelected ? onClearSelection : onSelectAllFiltered}>
                  {allFilteredSelected ? "Limpar" : "Todos"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-full px-3 text-[10px] font-bold uppercase tracking-widest text-white/50" onClick={onClearSelection}>Cancelar</Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" className="h-9 rounded-xl border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-widest text-white/70" disabled={selectedCount === 0 || bulkLoading} onClick={onBulkMarkRead}>Lida</Button>
              <Button size="sm" variant="outline" className="h-9 rounded-xl border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-widest text-white/70" disabled={selectedCount === 0 || bulkLoading} onClick={onBulkMarkUnread}>Não Lida</Button>
              <Select value={bulkOwnerDraft} onValueChange={(v) => { setBulkOwnerDraft(v); if (v !== "all") { onBulkReassignOwner(v); setBulkOwnerDraft("all"); } }} disabled={selectedCount === 0 || bulkLoading}>
                <SelectTrigger className="h-9 col-span-2 rounded-xl border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-widest text-white/70"><SelectValue placeholder="Responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mudar responsável</SelectItem>
                  {ownerOptions.filter((o) => o !== "all").map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {bulkError ? <p className="mt-3 text-[11px] text-rose-400">{bulkError}</p> : null}
          </motion.div>
        ) : (
          canBulkManage && filtered.length > 0 && (
             <div className="mt-4 flex justify-end">
               <Button size="sm" variant="ghost" className="h-7 text-[9px] font-bold uppercase tracking-widest text-white/30 hover:text-white" onClick={() => onBulkModeChange(true)}>Seleção em lote</Button>
             </div>
          )
        )}
      </div>

      <div className="crm-scrollbar inbox-scrollbar flex-1 overflow-y-auto overflow-x-hidden p-3 bg-[#080808]">
        {loading && filtered.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[90px] animate-pulse rounded-[20px] bg-white/5" />)}
          </div>
        ) : !loading && filtered.length === 0 ? (
          <div className="p-8 text-center text-[13px] font-light text-white/40">Nenhuma conversa encontrada.</div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((conv) => {
              const linkedLead = conv.leadId ? leadMap.get(conv.leadId) : null;
              return <ConversationListItem key={conv.id} conversation={conv} linkedLead={linkedLead ?? null} selectedId={selectedId} bulkMode={bulkMode} selected={selectedIdSet.has(conv.id)} onSelect={onSelect} onToggleSelection={onToggleSelection} />;
            })}
          </div>
        )}
      </div>
    </>
  );
}

const ConversationListItem = React.memo(function ConversationListItem({
  conversation, linkedLead, selectedId, bulkMode, selected, onSelect, onToggleSelection,
}: ConversationListItemProps) {
  const priority = conversation.workspace?.priority ?? "normal";
  const displayName = linkedLead?.nome?.trim() || conversation.contactName;
  const displayStatus = linkedLead?.status_funil || conversation.leadStatus;
  const displayOwner = linkedLead?.responsavel || conversation.ownerName || null;
  const displayCourse = linkedLead?.curso_de_interesse?.trim() || "";
  const isActive = selectedId === conversation.id;

  return (
    <button
      onClick={() => (bulkMode ? onToggleSelection(conversation.id) : onSelect(conversation.id))}
      className={cn(
        "relative flex w-full items-start gap-4 overflow-hidden rounded-[24px] border p-4 text-left transition-colors transition-shadow duration-300",
        isActive
          ? "border-primary/50 bg-primary/10"
          : "border-white/5 bg-[#0c0c0c] hover:bg-[#121212]",
      )}
    >
      {bulkMode ? (
        <span className={cn("mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors", selected ? "border-primary bg-primary text-white" : "border-white/20 text-transparent")} aria-hidden="true">
          <Check className="h-3 w-3" />
        </span>
      ) : null}
      
      <ConversationAvatar name={displayName} hasLead={Boolean(conversation.leadId)} />

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="flex items-center gap-2 truncate text-[14px] font-medium text-white tracking-wide">
              {conversation.unreadCount > 0 ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
              <span className="truncate">{displayName}</span>
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-2">
              {displayCourse ? <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white/50"><BriefcaseBusiness className="h-3 w-3" /> {displayCourse}</span> : null}
              {linkedLead?.proximo_contato && isOverdue(linkedLead.proximo_contato) ? <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-rose-400"><ShieldAlert className="h-3 w-3" /> Atrasado</span> : null}
            </span>
          </span>

          <span className="flex flex-col items-end gap-2 shrink-0">
             <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30" title={fullDateTime(conversation.lastMessageAt)}>
                <Clock3 className="h-3 w-3" /> {relativeTime(conversation.lastMessageAt)}
             </span>
             {conversation.unreadCount > 0 ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {conversation.unreadCount}
                </span>
             ) : bulkMode ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 text-[10px] text-white/30"><CheckCheck className="h-3 w-3" /></span>
             ) : null}
          </span>
        </span>

        <span className="mt-3 block truncate text-[13px] font-light text-white/50 pl-1">
          {conversation.lastMessageDirection === "outbound" ? <ArrowUpRight className="inline h-3.5 w-3.5 mr-1 text-primary/70" /> : conversation.lastMessageDirection === "inbound" ? <ArrowDownLeft className="inline h-3.5 w-3.5 mr-1 text-emerald-400/70" /> : null}
          {conversation.lastMessage}
        </span>

        <span className="mt-3 flex flex-wrap items-center gap-2">
           {displayStatus ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-white/50">{displayStatus}</span> : !conversation.leadId ? <span className="rounded-full border border-dashed border-white/20 bg-transparent px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-white/40">Sem Cadastro</span> : null}
           {displayOwner && displayOwner !== UNASSIGNED_OWNER ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-white/40">{displayOwner}</span> : null}
        </span>
      </span>
    </button>
  );
}, (prev, next) => prev.conversation === next.conversation && prev.linkedLead === next.linkedLead && prev.selectedId === next.selectedId && prev.bulkMode === next.bulkMode && prev.selected === next.selected && prev.onSelect === next.onSelect && prev.onToggleSelection === next.onToggleSelection);

export function EmptyConversationSelection() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#080808]">
      <MessageCircle className="h-16 w-16 text-white/10" />
      <p className="text-[14px] font-light text-white/40 tracking-wide">Selecione um atendimento para abrir o cockpit comercial</p>
    </div>
  );
}
