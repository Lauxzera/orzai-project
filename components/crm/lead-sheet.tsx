"use client";

import { MessageCircle } from "lucide-react";
import * as React from "react";
import { LeadAiCard } from "@/components/crm/lead-ai-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ScorePill } from "@/features/app-shell/components/page-primitives";
import { AddToLeadListDialog } from "@/features/leads/components/add-to-lead-list-dialog";
import {
  closingStatuses,
  computeLeadScore,
  formatDate,
  formatDateTime,
  getLeadTrackedCampaignLabel,
  getLeadTrackedOriginLabel,
  hasLeadTracking,
  getLastLeadActivity,
  getLeadAttentionMeta,
  getLeadDataQuality,
  isOverdue,
  type Lead,
  type LeadList,
  type LeadListColor,
  type Task,
} from "@/lib/crm";

type LeadSheetProps = {
  lead: Lead | null;
  allLeads: Lead[];
  tasks: Task[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (lead: Lead) => void;
  onAddTask: (lead: Lead) => void;
  taskDraft: { title: string; owner: string; dueDate: string };
  setTaskDraft: React.Dispatch<React.SetStateAction<{ title: string; owner: string; dueDate: string }>>;
  ownerOptions: readonly string[];
  historyDraft: string;
  setHistoryDraft: (value: string) => void;
  onAddHistory: (lead: Lead) => void;
  onToggleTask: (id: string) => void;
  onOpenMessages: () => void;
  onOpenLead: (leadId: string) => void;
  leadLists: LeadList[];
  onAddToLeadList: (listId: string, leadId: string) => Promise<void>;
  onCreateLeadList: (draft: { name: string; description: string; color: LeadListColor; leadIds: string[] }) => Promise<void>;
  onDeleteLead: (leadId: string) => Promise<void>;
  deleteLoading: boolean;
  deleteError: string;
  canEdit: boolean;
};

type TimelineFilter = "all" | "history" | "change" | "owner" | "task";
type TimelineEntryKind = Exclude<TimelineFilter, "all">;

export function LeadSheet({
  lead, allLeads, tasks, open, onOpenChange, onEdit, onAddTask, taskDraft, setTaskDraft,
  ownerOptions, historyDraft, setHistoryDraft, onAddHistory, onToggleTask, onOpenMessages,
  onOpenLead, leadLists, onAddToLeadList, onCreateLeadList, onDeleteLead, deleteLoading, deleteError, canEdit,
}: LeadSheetProps) {
  const [timelineFilter, setTimelineFilter] = React.useState<TimelineFilter>("all");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) setTimelineFilter("all");
  }, [open, lead?.id]);

  if (!lead) return <Sheet open={open} onOpenChange={onOpenChange} />;

  const score = computeLeadScore(lead);
  const attention = getLeadAttentionMeta(lead);
  const timeline = buildLeadTimeline(lead, tasks);
  const visibleTimeline = timeline.filter((entry) => timelineFilter === "all" || entry.kind === timelineFilter);
  const lastActivity = getLastLeadActivity(lead);
  const pendingTasks = tasks.filter((task) => !task.done);
  const quality = getLeadDataQuality(lead, allLeads);
  const trackingEnabled = hasLeadTracking(lead);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-[#0c0c0c] border-l border-white/5 shadow-2xl sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-[20px] font-bold text-primary shadow-[0_0_15px_rgba(219,13,113,0.3)]">
              {lead.nome.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <SheetTitle className="text-[28px] font-light text-white tracking-wide">{lead.nome}</SheetTitle>
              <SheetDescription className="text-white/50 text-[14px] mt-1">
                {lead.curso_de_interesse} <span className="opacity-40 px-1">•</span> {getLeadTrackedOriginLabel(lead)} <span className="opacity-40 px-1">•</span> {lead.responsavel}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 pb-20">
          <Card className="rounded-[24px] border border-white/5 bg-white/[0.015] backdrop-blur-[24px]">
            <CardContent className="space-y-6 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] uppercase tracking-widest text-white/50">{lead.status_funil}</Badge>
                <Badge variant="gold" className="text-[10px] uppercase tracking-widest">{lead.status_matricula}</Badge>
                {isOverdue(lead.proximo_contato) && !closingStatuses.includes(lead.status_funil) ? (
                  <Badge variant="danger" className="text-[10px] uppercase tracking-widest font-bold">Retorno atrasado</Badge>
                ) : null}
                {attention ? <Badge variant={attention.variant} className="text-[10px] uppercase tracking-widest">{attention.label}</Badge> : null}
                {quality.duplicateHints.length ? <Badge variant="danger" className="text-[10px] uppercase tracking-widest">Possível duplicado</Badge> : null}
                {quality.missingStageRequirements.length ? <Badge variant="gold" className="text-[10px] uppercase tracking-widest">Etapa incompleta</Badge> : null}
                {score ? <ScorePill score={score} showLabel /> : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <InfoStat label="Última atividade" value={lastActivity ? formatDateTime(lastActivity.createdAt) : "Sem registro"} />
                <InfoStat label="Pendências" value={`${pendingTasks.length} tarefa(s)`} tone={pendingTasks.length > 0 ? "warning" : "default"} />
                <InfoStat label="Próximo contato" value={formatDate(lead.proximo_contato)} tone={isOverdue(lead.proximo_contato) ? "danger" : "default"} />
              </div>

              <div className="grid gap-3 text-[13px] text-white/50 sm:grid-cols-2 bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                <p><strong className="text-white/80">Telefone:</strong> {lead.telefone}</p>
                <p><strong className="text-white/80">Email:</strong> {lead.email || "Não informado"}</p>
                <p><strong className="text-white/80">Cidade:</strong> {lead.cidade || "Não informada"}</p>
                <p><strong className="text-white/80">Profissão:</strong> {lead.profissao || "Não informada"}</p>
                <p className="sm:col-span-2"><strong className="text-white/80">Detalhe da origem:</strong> {lead.origem_detalhe || "Não informado"}</p>
                <p><strong className="text-white/80">Captado via:</strong> {lead.captado_via || "Não informado"}</p>
                {trackingEnabled ? (
                  <>
                    <p><strong className="text-white/80">UTM source:</strong> {lead.utm_source || "Não informado"}</p>
                    <p><strong className="text-white/80">UTM medium:</strong> {lead.utm_medium || "Não informado"}</p>
                    <p className="sm:col-span-2"><strong className="text-white/80">UTM campaign:</strong> {getLeadTrackedCampaignLabel(lead)}</p>
                    {lead.tracking_referrer ? <p className="sm:col-span-2"><strong className="text-white/80">Referrer:</strong> {lead.tracking_referrer}</p> : null}
                    {lead.tracking_landing_page ? <p className="sm:col-span-2"><strong className="text-white/80">Landing page:</strong> {lead.tracking_landing_page}</p> : null}
                  </>
                ) : null}
                <p><strong className="text-white/80">Já foi aluno:</strong> {lead.ja_foi_aluno}</p>
                <p><strong className="text-rose-400/80">Objeção:</strong> <span className="text-rose-400/60">{lead.objecao_principal || "Não registrada"}</span></p>
              </div>

              <p className="text-[13px] font-light text-white/50 bg-white/5 border border-white/10 rounded-2xl p-5">{lead.observacoes || "Sem observações registradas."}</p>

              <div className="flex flex-wrap gap-3">
                <Button onClick={onOpenMessages} className="rounded-full font-bold uppercase tracking-widest text-[10px] px-6">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Ver conversa
                </Button>
                <AddToLeadListDialog lead={lead} leadLists={leadLists} canEdit={canEdit} onAddToList={onAddToLeadList} onCreateList={onCreateLeadList} buttonLabel="Na Lista" />
                {canEdit ? <Button variant="outline" className="rounded-full border-white/10 hover:bg-white/5 font-bold uppercase tracking-widest text-[10px] px-6 text-white/70" onClick={() => onEdit(lead)}>Editar lead</Button> : null}
                {canEdit ? (
                  <Button variant="outline" className="rounded-full border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-400 font-bold uppercase tracking-widest text-[10px] px-6" disabled={deleteLoading} onClick={() => setDeleteConfirmOpen(true)}>
                    Excluir
                  </Button>
                ) : null}
              </div>
              {deleteError ? <p className="text-[12px] text-rose-400">{deleteError}</p> : null}
            </CardContent>
          </Card>

          {deleteConfirmOpen ? (
            <Card className="rounded-[24px] border border-rose-500/30 bg-rose-500/10">
              <CardHeader>
                <CardTitle className="text-rose-400">Confirmar exclusão</CardTitle>
                <CardDescription className="text-rose-400/60">Essa ação remove o lead da carteira e das tarefas.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap justify-end gap-3">
                <Button variant="outline" className="rounded-full border-rose-500/30 text-rose-400 hover:bg-rose-500/20" onClick={() => setDeleteConfirmOpen(false)} disabled={deleteLoading}>Cancelar</Button>
                <Button variant="destructive" className="rounded-full" disabled={deleteLoading} onClick={async () => { try { await onDeleteLead(lead.id); setDeleteConfirmOpen(false); onOpenChange(false); } catch {} }}>
                  {deleteLoading ? "Excluindo..." : "Confirmar exclusão"}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {quality.duplicateHints.length || quality.missingStageRequirements.length || quality.missingCoreFields.length ? (
            <Card className="rounded-[24px] border border-amber-500/20 bg-white/[0.01]">
              <CardHeader className="border-b border-amber-500/10 bg-amber-500/5 px-6 py-4 rounded-t-[24px]">
                <CardTitle className="text-[16px] font-light text-amber-400">Qualidade do cadastro</CardTitle>
                <CardDescription className="text-amber-400/50">Campos que merecem ajuste para melhorar a condução do lead.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                {quality.duplicateHints.length ? (
                  <div className="rounded-[16px] border border-rose-500/30 bg-rose-500/10 p-4">
                    <p className="text-[12px] font-bold uppercase tracking-widest text-rose-400 mb-2">Possível duplicidade</p>
                    <p className="text-[13px] font-light text-rose-400/70">Este lead pode estar duplicado com: {quality.duplicateHints.map((item) => item.lead.nome).join(", ")}.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {quality.duplicateHints.map((item) => (
                        <Button key={`${item.field}-${item.lead.id}`} size="sm" variant="outline" className="rounded-full border-rose-500/30 text-rose-400 hover:bg-rose-500/20" onClick={() => onOpenLead(item.lead.id)}>
                          Abrir {item.lead.nome}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {quality.missingStageRequirements.length ? (
                  <div className="rounded-[16px] border border-amber-500/30 bg-amber-500/10 p-4">
                    <p className="text-[12px] font-bold uppercase tracking-widest text-amber-400 mb-2">Pendências da etapa</p>
                    <ul className="space-y-2 text-[13px] font-light text-amber-400/70">
                      {quality.missingStageRequirements.map((item) => (
                        <li key={item.field}><strong className="text-amber-400 font-medium">{item.label}:</strong> {item.reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {quality.missingCoreFields.length ? (
                  <p className="text-[12px] text-white/40 bg-white/5 border border-white/10 p-3 rounded-2xl">
                    Cadastro base incompleto: {quality.missingCoreFields.map((item) => item.label.toLowerCase()).join(", ")}.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}



          {canEdit ? (
            <Card className="rounded-[24px] border border-white/5 bg-white/[0.015] backdrop-blur-[24px]">
              <CardHeader className="border-b border-white/5 px-6 py-4">
                <CardTitle className="text-[16px] font-light text-white">Criar Follow-up</CardTitle>
                <CardDescription className="text-white/40">Registre a próxima ação do atendimento.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 p-6">
                <Input
                  className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/30 h-12"
                  value={taskDraft.title} onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Ex.: Confirmar turma e forma de pagamento"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select value={taskDraft.owner} onValueChange={(value) => setTaskDraft((current) => ({ ...current, owner: value }))}>
                    <SelectTrigger className="rounded-xl border-white/10 bg-white/5 text-white h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ownerOptions.map((owner) => <SelectItem key={owner} value={owner}>{owner}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="date" className="rounded-xl border-white/10 bg-white/5 text-white h-12" value={taskDraft.dueDate} onChange={(event) => setTaskDraft((current) => ({ ...current, dueDate: event.target.value }))} />
                </div>
                <Button className="rounded-full font-bold uppercase tracking-widest text-[10px] h-12 mt-2" onClick={() => onAddTask(lead)}>Criar tarefa</Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="rounded-[24px] border border-white/5 bg-white/[0.015] backdrop-blur-[24px]">
            <CardHeader className="border-b border-white/5 px-6 py-4">
              <CardTitle className="text-[16px] font-light text-white">Tarefas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              {tasks.length ? tasks.map((task) => (
                <div key={task.id} className="rounded-[16px] border border-white/5 bg-white/[0.02] p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className={`text-[14px] font-medium ${task.done ? 'line-through text-white/30' : 'text-white'}`}>{task.title}</p>
                    <p className="text-[11px] font-light text-white/40 mt-1">{task.owner} - {formatDate(task.dueDate)}</p>
                  </div>
                  {canEdit ? (
                    <Button size="sm" variant="outline" className={`rounded-full px-4 font-bold uppercase tracking-widest text-[9px] ${task.done ? 'border-white/10 text-white/30' : 'border-primary/50 text-primary hover:bg-primary/20'}`} onClick={() => onToggleTask(task.id)}>
                      {task.done ? "Reabrir" : "Concluir"}
                    </Button>
                  ) : null}
                </div>
              )) : <p className="text-[12px] font-light text-white/30">Nenhuma tarefa criada.</p>}
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border border-white/5 bg-white/[0.015] backdrop-blur-[24px]">
            <CardHeader className="border-b border-white/5 px-6 py-4">
              <CardTitle className="text-[16px] font-light text-white">Timeline do lead</CardTitle>
              <CardDescription className="text-white/40">Histórico do atendimento e mudanças.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              {canEdit ? (
                <div className="grid gap-3">
                  <Textarea className="rounded-[16px] border-white/10 bg-white/5 text-white placeholder:text-white/30 min-h-[100px] resize-none" value={historyDraft} onChange={(event) => setHistoryDraft(event.target.value)} placeholder="Registrar ligação, WhatsApp enviado, objeção..." />
                  <Button className="rounded-full font-bold uppercase tracking-widest text-[10px]" onClick={() => onAddHistory(lead)}>Adicionar registro</Button>
                </div>
              ) : null}

              <Separator className="bg-white/5" />

              <div className="flex flex-wrap gap-2">
                <TimelineFilterButton label="Tudo" active={timelineFilter === "all"} onClick={() => setTimelineFilter("all")} />
                <TimelineFilterButton label="Atendimento" active={timelineFilter === "history"} onClick={() => setTimelineFilter("history")} />
                <TimelineFilterButton label="Atualizações" active={timelineFilter === "change"} onClick={() => setTimelineFilter("change")} />
                <TimelineFilterButton label="Responsável" active={timelineFilter === "owner"} onClick={() => setTimelineFilter("owner")} />
                <TimelineFilterButton label="Tarefas" active={timelineFilter === "task"} onClick={() => setTimelineFilter("task")} />
              </div>

              <div className="space-y-4 border-l border-white/10 ml-2 pl-4">
                {visibleTimeline.length ? visibleTimeline.map((entry) => (
                  <div key={entry.id} className="relative pb-4">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(219,13,113,0.8)]" />
                    <div className="flex items-center gap-3">
                      <p className="text-[14px] font-medium text-white">{entry.action}</p>
                      <Badge variant={getTimelineBadgeVariant(entry.kind)} className="text-[9px] uppercase tracking-widest font-bold bg-white/5 border-white/10">{getTimelineBadgeLabel(entry.kind)}</Badge>
                    </div>
                    <p className="text-[12px] font-light text-white/60 mt-2">{entry.note}</p>
                    <p className="text-[10px] text-white/30 mt-2 font-bold uppercase tracking-widest">{formatDateTime(entry.createdAt)}</p>
                  </div>
                )) : <p className="text-[12px] font-light text-white/30">Nenhum registro para o filtro atual.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" | "warning" }) {
  const border = tone === "danger" ? "border-rose-500/30" : tone === "warning" ? "border-amber-500/30" : "border-white/5";
  const glow = tone === "danger" ? "text-rose-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" : tone === "warning" ? "text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "text-white";
  return (
    <div className={`rounded-[16px] border bg-white/[0.02] px-4 py-3 ${border}`}>
      <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-white/40 mb-1">{label}</p>
      <p className={`text-[16px] font-light ${glow}`}>{value}</p>
    </div>
  );
}

function TimelineFilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void; }) {
  return (
    <Button type="button" size="sm" variant={active ? "default" : "outline"} className={`rounded-full text-[10px] uppercase font-bold tracking-widest px-4 ${active ? '' : 'border-white/10 text-white/50 hover:bg-white/5'}`} onClick={onClick}>
      {label}
    </Button>
  );
}

function buildLeadTimeline(lead: Lead, tasks: Task[]) {
  const historyEntries = lead.history.map((entry) => ({
    id: `history-${entry.id}`, action: entry.action, note: entry.note || "Sem detalhes adicionais.", createdAt: entry.createdAt, kind: inferHistoryKind(entry.action),
  }));
  const taskEntries = tasks.map((task) => ({
    id: `task-${task.id}-${task.done ? "done" : "open"}`, action: task.done ? "Tarefa concluída" : "Tarefa planejada", note: `${task.title} • ${task.owner} • ${formatDate(task.dueDate)}`, createdAt: `${task.dueDate || lead.data_entrada}T12:00:00.000Z`, kind: "task" as const,
  }));
  return [...historyEntries, ...taskEntries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function inferHistoryKind(action: string): TimelineEntryKind {
  const normalized = action.toLowerCase();
  if (normalized.includes("responsável alterado")) return "owner";
  if (normalized.includes("status alterado") || normalized.includes("cadastro atualizado")) return "change";
  return "history";
}

function getTimelineBadgeVariant(kind: TimelineEntryKind) {
  switch (kind) {
    case "task": return "outline";
    case "change": return "gold";
    case "owner": return "danger";
    default: return "secondary";
  }
}

function getTimelineBadgeLabel(kind: TimelineEntryKind) {
  switch (kind) {
    case "task": return "Tarefa";
    case "change": return "Atualização";
    case "owner": return "Responsável";
    default: return "Atendimento";
  }
}
