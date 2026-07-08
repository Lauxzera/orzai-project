"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  AudioLines,
  Check,
  CheckCheck,
  Clock3,
  Download,
  PanelLeft,
  PanelRight,
  Phone,
  PlusCircle,
  UserRound,
  MoreVertical,
  ChevronDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UNASSIGNED_OWNER, funnelStatuses, type Lead } from "@/lib/crm";
import type { Conversation, Message } from "@/lib/messages";
import { fullDateTime, msgTime, relativeTime } from "@/features/messages/lib/message-formatters";
import { funnelTagMap, priorityStyleMap, serviceStatusLabel } from "@/features/messages/lib/status-styles";
import { cn } from "@/lib/utils";
import { CallButton } from "@/features/messages/components/call-button";
import { getAvatarPalette } from "@/features/messages/lib/avatar";

type Props = {
  conversation: Conversation;
  lead: Lead | null;
  messages: Message[];
  loading: boolean;
  refreshing?: boolean;
  hasMore?: boolean;
  loadingOlder?: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  canEdit: boolean;
  ownerOptions: readonly string[];
  currentUserName?: string;
  canInspectAll?: boolean;
  onQuickStatusChange: (status: Lead["status_funil"]) => void;
  onReassignConversation?: (owner: string) => void;
  onInitiateCall?: (note: string) => Promise<void>;
  onLoadOlderMessages?: () => void;
  ownerSaving?: boolean;
  ownerError?: string;
  onCreateLead?: () => void;
  onToggleInbox?: () => void;
  onOpenLeadPanel?: () => void;
};

function ConversationThreadComponent({
  conversation,
  lead,
  messages,
  loading,
  refreshing = false,
  hasMore = false,
  loadingOlder = false,
  bottomRef,
  viewportRef,
  canEdit,
  ownerOptions,
  currentUserName,
  canInspectAll,
  onQuickStatusChange,
  onReassignConversation,
  onInitiateCall,
  onLoadOlderMessages,
  ownerSaving,
  ownerError,
  onCreateLead,
  onToggleInbox,
  onOpenLeadPanel,
}: Props) {
  const displayName = lead?.nome?.trim() || conversation.contactName;
  const displayPhone = (lead?.whatsapp || lead?.telefone || conversation.contactPhone).trim();
  const displayStatus = lead?.status_funil || conversation.leadStatus;
  const groupedMessages = React.useMemo(() => {
    const groups: Array<{ label: string; items: Message[] }> = [];
    for (const message of messages) {
      const label = messageDateLabel(message.timestamp);
      const currentGroup = groups.at(-1);
      if (!currentGroup || currentGroup.label !== label) {
        groups.push({ label, items: [message] });
      } else {
        currentGroup.items.push(message);
      }
    }
    return groups;
  }, [messages]);

  function messageMediaHref(message: Message) {
    return `/api/messages/media/${encodeURIComponent(message.id)}`;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#080808]">
      {/* Cockpit / Header */}
      <div className="shrink-0 z-10 border-b border-white/5 bg-[#0a0a0a] px-4 py-4 ">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {onToggleInbox ? (
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-white/5 border-white/10 hover:bg-white/10 text-white/70" onClick={onToggleInbox}>
                <PanelLeft className="h-5 w-5" />
              </Button>
            ) : null}
            
            {/* Avatar Em Detalhe Neon */}
            <div className="relative shrink-0">
               <span className="grid h-12 w-12 place-items-center rounded-full border border-primary/30 bg-primary/10 text-[16px] font-bold text-primary">
                  {displayName.charAt(0)}
               </span>
               <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0a0a0a] bg-emerald-500" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-[18px] font-light tracking-wide text-white">{displayName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-white/40">
                <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> +{displayPhone}</span>
                {lead && displayStatus ? (
                  <>
                    <span className="h-1 w-1 rounded-full bg-white/20" />
                    <span>{displayStatus}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {refreshing && messages.length > 0 ? (
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary/80" />
              </span>
            ) : null}
            
            {onInitiateCall ? (
              <CallButton phone={displayPhone} contactName={displayName} canEdit={canEdit} onCallInitiated={onInitiateCall} />
            ) : null}

            {onOpenLeadPanel && lead ? (
               <Button type="button" variant="outline" className="h-10 gap-2 rounded-full border-white/10 bg-white/5 px-4 text-[11px] font-bold uppercase tracking-widest text-white/80 hover:bg-white/10" onClick={onOpenLeadPanel}>
                 <PanelRight className="h-4 w-4" /> Abrir Lead
               </Button>
            ) : null}

            {!lead && onCreateLead ? (
               <Button type="button" className="h-10 gap-2 rounded-full bg-primary px-4 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-primary/90" onClick={onCreateLead}>
                 <PlusCircle className="h-4 w-4" /> Salvar Lead
               </Button>
            ) : null}

            {canEdit && lead ? (
               <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                   <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-white/10 bg-white/5 hover:bg-white/10 text-white/80">
                     <MoreVertical className="h-4 w-4" />
                   </Button>
                 </DropdownMenuTrigger>
                 <DropdownMenuContent align="end" className="w-56 rounded-2xl border-white/10 bg-[#0c0c0c] text-white">
                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-white/50">Ações Rápidas</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-white/50 pt-2 pb-1">Atualizar Status</DropdownMenuLabel>
                    <div className="px-2 pb-2">
                       <Select value={displayStatus ?? undefined} onValueChange={(v) => onQuickStatusChange(v as Lead["status_funil"])}>
                         <SelectTrigger className="h-8 w-full border-white/10 bg-white/5 text-[11px]"><SelectValue /></SelectTrigger>
                         <SelectContent>{funnelStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                       </Select>
                    </div>
                    {canInspectAll || lead.responsavel === currentUserName ? (
                       <>
                          <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-white/50 pt-2 pb-1">Transferir Atendimento</DropdownMenuLabel>
                          <div className="px-2 pb-2">
                            <Select value={lead.responsavel} onValueChange={(v) => onReassignConversation?.(v)} disabled={ownerSaving}>
                              <SelectTrigger className="h-8 w-full border-white/10 bg-white/5 text-[11px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
                              <SelectContent>{ownerOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                       </>
                    ) : null}
                    {lead.responsavel === UNASSIGNED_OWNER && currentUserName ? (
                       <div className="p-2 pt-0">
                         <Button className="w-full h-8 text-[11px] bg-white/10 text-white hover:bg-white/20" onClick={() => onReassignConversation?.(currentUserName)}>Assumir Atendimento</Button>
                       </div>
                    ) : null}
                 </DropdownMenuContent>
               </DropdownMenu>
            ) : null}
          </div>
        </div>
        {ownerError ? <div className="mt-2 text-[11px] font-bold uppercase tracking-widest text-rose-400 text-right">{ownerError}</div> : null}
      </div>

      <div ref={viewportRef} className="crm-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 relative z-0">


        {hasMore ? (
          <div className="mb-6 flex justify-center">
            <Button type="button" variant="outline" className="h-9 rounded-full border-white/10 bg-white/5 px-6 text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white" onClick={onLoadOlderMessages} disabled={loadingOlder}>
              {loadingOlder ? "Carregando..." : "Ver mais antigas"}
            </Button>
          </div>
        ) : null}
        
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn("h-16 w-2/3 animate-pulse rounded-[24px] bg-white/5", i % 2 === 0 ? "ml-auto" : "")} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-white/30">
             <Clock3 className="h-12 w-12 opacity-50" />
             <p className="text-[14px] font-light tracking-wide">O histórico desta conversa começará a aparecer aqui.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedMessages.map((group) => (
              <React.Fragment key={group.label}>
                <div className="my-6 flex items-center justify-center">
                  <span className="rounded-full border border-white/10 bg-[#0a0a0a] px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-white/40 shadow-sm ">
                    {group.label}
                  </span>
                </div>
                {group.items.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} mediaHref={messageMediaHref(msg)} />
                ))}
              </React.Fragment>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}

export const ConversationThread = React.memo(ConversationThreadComponent, (prev, next) => prev.loading === next.loading && prev.refreshing === next.refreshing && prev.messages === next.messages && prev.canEdit === next.canEdit && prev.ownerOptions === next.ownerOptions && prev.currentUserName === next.currentUserName && prev.canInspectAll === next.canInspectAll && prev.onReassignConversation === next.onReassignConversation && prev.ownerSaving === next.ownerSaving && prev.ownerError === next.ownerError && prev.onCreateLead === next.onCreateLead && prev.onToggleInbox === next.onToggleInbox && prev.onOpenLeadPanel === next.onOpenLeadPanel && prev.lead?.id === next.lead?.id && prev.lead?.nome === next.lead?.nome && prev.lead?.status_funil === next.lead?.status_funil && prev.lead?.responsavel === next.lead?.responsavel && prev.conversation.id === next.conversation.id);

const MessageBubble = React.memo(function MessageBubble({ message, mediaHref }: { message: Message; mediaHref: string }) {
  function renderMessageMeta(msg: Message) {
    if (msg.direction === "outbound") {
      const label = msg.localDeliveryState === "pending" ? "Enviando" : msg.localDeliveryState === "failed" || msg.statusError ? "Falha na entrega" : msg.status === "read" ? "Lida" : msg.status === "delivered" ? "Entregue" : "Enviada";
      return (
        <span className={cn("inline-flex items-center gap-1.5", msg.statusError ? "text-rose-400" : "")} title={msg.statusError ?? undefined}>
          <span>{label}</span>
          {msg.localDeliveryState === "pending" ? <Clock3 className="h-3 w-3" /> : msg.localDeliveryState === "failed" || msg.statusError ? <AlertCircle className="h-3 w-3 text-rose-500" /> : msg.status === "read" ? <CheckCheck className="h-3.5 w-3.5 text-[#38bdf8]" /> : msg.status === "delivered" ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3 w-3" />}
        </span>
      );
    }
    return <span>Recebida</span>;
  }

  return (
    <div className={cn("flex w-full", message.direction === "outbound" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] px-4 py-3 text-[14px] font-light leading-relaxed tracking-wide shadow-2xl",
          message.direction === "outbound"
            ? "rounded-[24px] rounded-br-[4px] bg-primary/90 text-white "
            : "rounded-[24px] rounded-bl-[4px] border border-white/10 bg-white/[0.04] text-white/90 ",
        )}
      >
        {message.type === "image" && message.mediaUrl ? (
          <a href={mediaHref} target="_blank" rel="noreferrer" className="mb-3 block overflow-hidden rounded-[16px] border border-white/10 bg-black">
            <img src={mediaHref} alt={message.content || "Imagem enviada"} className="max-h-72 w-full object-cover transition hover:opacity-90" />
          </a>
        ) : null}

        {message.type === "audio" ? (
          <div className={cn("mb-3 overflow-hidden rounded-[20px] border p-1", message.direction === "outbound" ? "border-white/20 bg-black/20" : "border-white/10 bg-white/5")}>
             <div className="flex items-center gap-3 px-3 py-2">
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", message.direction === "outbound" ? "bg-white/20 text-white" : "bg-primary/20 text-primary")}>
                   <AudioLines className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                   {message.mediaUrl ? (
                      <audio controls preload="none" className="h-9 w-full opacity-90" src={mediaHref} />
                   ) : (
                      <p className="text-[12px] font-medium text-white/70">Áudio não disponível na web.</p>
                   )}
                </div>
             </div>
          </div>
        ) : null}

        {message.type === "document" && message.mediaUrl && message.mimeType?.startsWith("video/") ? (
          <a href={mediaHref} target="_blank" rel="noreferrer" className="mb-3 block overflow-hidden rounded-[16px] border border-white/10 bg-black">
            <video src={mediaHref} controls preload="metadata" className="max-h-72 w-full" />
          </a>
        ) : message.type === "document" && message.mediaUrl ? (
          <a href={mediaHref} target="_blank" rel="noreferrer" className={cn("mb-3 flex items-center gap-2 rounded-[16px] border px-4 py-3 text-[12px] font-bold uppercase tracking-widest transition hover:opacity-90", message.direction === "outbound" ? "border-white/20 bg-black/20 text-white" : "border-white/10 bg-white/5 text-white/70")}>
            <Download className="h-4 w-4" /> Abrir Anexo
          </a>
        ) : null}

        {message.content ? <p className="whitespace-pre-wrap break-words">{message.content}</p> : null}

        <div className={cn("mt-2 flex flex-wrap items-center justify-end gap-2 text-[9px] font-bold uppercase tracking-widest", message.direction === "outbound" ? "text-white/60" : "text-white/40")}>
          <span>{msgTime(message.timestamp)}</span>
          <span className="opacity-50">•</span>
          {renderMessageMeta(message)}
        </div>
      </div>
    </div>
  );
});

function messageDateLabel(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfNow.getTime() - startOfDate.getTime()) / 86_400_000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}
