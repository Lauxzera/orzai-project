"use client";

import * as React from "react";
import {
  Bot,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  FilePenLine,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Tag,
  UserCircle2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SmoothInput as Input } from "@/components/ui/smooth-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type CourseSegmentKey,
  type CourseSegments,
  enrollmentStatuses,
  formatDate,
  formatDateTime,
  funnelStatuses,
  inferCourseSegment,
  isOverdue,
  type Lead,
} from "@/lib/crm";
import type {
  Conversation,
  ConversationAnalysis,
  ConversationAttemptType,
  ConversationPriority,
  ConversationServiceStatus,
  LeadSuggestionField,
} from "@/lib/messages";
import { cn } from "@/lib/utils";
import { funnelTagMap, priorityStyleMap } from "@/features/messages/lib/status-styles";
import { getAvatarPalette, getInitials } from "@/features/messages/lib/avatar";

type EditableLead = Omit<Lead, "id" | "history">;

const SENTIMENT_LABEL: Record<ConversationAnalysis["sentiment"], string> = {
  positive: "Positivo",
  neutral: "Neutro",
  negative: "Negativo",
};

const SENTIMENT_VARIANT: Record<ConversationAnalysis["sentiment"], "success" | "outline" | "danger"> = {
  positive: "success",
  neutral: "outline",
  negative: "danger",
};

const URGENCY_LABEL: Record<ConversationAnalysis["urgency"], string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const URGENCY_VARIANT: Record<ConversationAnalysis["urgency"], "danger" | "gold" | "outline"> = {
  alta: "danger",
  media: "gold",
  baixa: "outline",
};

const PRIORITY_OPTIONS: Array<{ value: ConversationPriority; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

const SERVICE_STATUS_OPTIONS: Array<{ value: ConversationServiceStatus; label: string }> = [
  { value: "fila", label: "Na fila" },
  { value: "em-atendimento", label: "Em atendimento" },
  { value: "aguardando-cliente", label: "Aguardando cliente" },
  { value: "concluido", label: "Concluído" },
];

const ATTEMPT_OPTIONS: Array<{ value: ConversationAttemptType; label: string }> = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ligacao", label: "Ligação" },
  { value: "proposta", label: "Proposta" },
  { value: "follow-up", label: "Follow-up" },
  { value: "matricula", label: "Matrícula" },
];

function LeadField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="text-[10px] font-bold uppercase tracking-widest text-white/50">{label}</Label>
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden shadow-inner">
         {children}
      </div>
    </div>
  );
}

function LeadSelect({
  value,
  onValueChange,
  options,
  disabled = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly string[] | ReadonlyArray<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="h-10 border-0 bg-transparent text-[13px] text-white shadow-none focus:ring-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-white/10 bg-[#0c0c0c] text-white">
        {options.map((option) => (
          <SelectItem key={typeof option === "string" ? option : option.value} value={typeof option === "string" ? option : option.value}>
            {typeof option === "string" ? option : option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InfoMetric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "attention" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-[20px] border px-4 py-3 ",
        tone === "attention" ? "border-amber-500/30 bg-amber-500/10" : tone === "success" ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-white/5"
      )}
    >
      <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">{label}</p>
      <p className="mt-1 text-[14px] font-medium text-white truncate">{value}</p>
      {hint ? <p className={cn("mt-1.5 text-[10px] uppercase tracking-wider font-bold", tone === "attention" ? "text-amber-400" : tone === "success" ? "text-emerald-400" : "text-white/30")}>{hint}</p> : null}
    </div>
  );
}

type Props = {
  conversation: Conversation;
  lead: Lead | null;
  leadDraft: EditableLead | null;
  analysis: ConversationAnalysis | null;
  analysisLoading: boolean;
  applyingStatus: boolean;
  leadSuggestions: NonNullable<ConversationAnalysis["leadSuggestions"]>;
  ownerOptions: readonly string[];
  courseOptions: readonly string[];
  courseSegments?: CourseSegments;
  originOptions: readonly string[];
  captureMethodOptions: readonly string[];
  canEdit: boolean;
  leadSaving: boolean;
  leadError: string;
  leadSaved: string;
  workspaceSaving: boolean;
  workspaceError: string;
  onUpdateField: (field: keyof EditableLead, value: string) => void;
  onUpdateWorkspace: (payload: { priority?: ConversationPriority; serviceStatus?: ConversationServiceStatus; tags?: string[]; pinnedNote?: string; }) => Promise<void>;
  onRegisterAttempt: (payload: { type: ConversationAttemptType; note: string }) => Promise<void>;
  onAcceptSuggestion: (field: LeadSuggestionField, value: string) => void;
  onDismissSuggestion: (field: LeadSuggestionField) => void;
  onAnalyze: () => void;
  onApplyStatus: () => void;
  onReset: () => void;
  onSave: () => void;
  onCreateTask: (leadId: string, payload: { title: string; owner: string; dueDate: string }) => Promise<void>;
  presentation?: "inline" | "overlay";
  onClose?: () => void;
};

export function LeadSidePanel({
  conversation, lead, leadDraft, analysis, analysisLoading, applyingStatus, leadSuggestions,
  ownerOptions, courseOptions, courseSegments, originOptions, captureMethodOptions,
  canEdit, leadSaving, leadError, leadSaved, workspaceSaving, workspaceError,
  onCreateTask, onUpdateField, onUpdateWorkspace, onRegisterAttempt, onAcceptSuggestion, onDismissSuggestion,
  onAnalyze, onApplyStatus, onReset, onSave, presentation = "inline", onClose,
}: Props) {
  const displayName = leadDraft?.nome?.trim() || lead?.nome?.trim() || conversation.contactName;
  const displayPhone = (leadDraft?.whatsapp || leadDraft?.telefone || lead?.whatsapp || lead?.telefone || conversation.contactPhone).trim();
  const hasLeadDraftChanges = React.useMemo(() => {
    if (!lead || !leadDraft) return false;
    const { id: _id, history: _history, ...editable } = lead;
    return JSON.stringify(editable) !== JSON.stringify(leadDraft);
  }, [lead, leadDraft]);
  const [taskDraft, setTaskDraft] = React.useState({ title: "", owner: leadDraft?.responsavel ?? ownerOptions[0] ?? "Equipe Comercial", dueDate: leadDraft?.proximo_contato || "" });
  const [taskSaving, setTaskSaving] = React.useState(false);
  const [taskFeedback, setTaskFeedback] = React.useState("");
  const [tagDraft, setTagDraft] = React.useState("");
  const [pinnedNoteDraft, setPinnedNoteDraft] = React.useState(conversation.workspace?.pinnedNote ?? "");
  const [attemptDraft, setAttemptDraft] = React.useState<{ type: ConversationAttemptType; note: string }>({ type: "whatsapp", note: "" });
  const [workspaceFeedback, setWorkspaceFeedback] = React.useState("");
  
  const resolvedCourseSegments = React.useMemo<CourseSegments>(() => courseSegments ?? { formacao: [...courseOptions], especializacao: [] }, [courseOptions, courseSegments]);
  const [selectedCourseSegment, setSelectedCourseSegment] = React.useState<CourseSegmentKey>(() => inferCourseSegment({ courses: [...courseOptions], courseSegments: resolvedCourseSegments, origins: [], leadCaptureMethods: [], owners: [] }, leadDraft?.curso_de_interesse ?? ""));

  React.useEffect(() => { setTaskDraft({ title: "", owner: leadDraft?.responsavel ?? ownerOptions[0] ?? "Equipe Comercial", dueDate: leadDraft?.proximo_contato || "" }); setTaskFeedback(""); }, [leadDraft?.responsavel, leadDraft?.proximo_contato, ownerOptions]);
  React.useEffect(() => { setPinnedNoteDraft(conversation.workspace?.pinnedNote ?? ""); setTagDraft(""); }, [conversation.id, conversation.workspace?.pinnedNote]);
  React.useEffect(() => { setSelectedCourseSegment(inferCourseSegment({ courses: [...courseOptions], courseSegments: resolvedCourseSegments, origins: [], leadCaptureMethods: [], owners: [] }, leadDraft?.curso_de_interesse ?? "")); }, [conversation.id, courseOptions, resolvedCourseSegments]);

  const visibleCourseOptions = resolvedCourseSegments[selectedCourseSegment];

  function handleCourseSegmentChange(value: string) {
    const nextSegment = value as CourseSegmentKey;
    setSelectedCourseSegment(nextSegment);
    const nextCourses = resolvedCourseSegments[nextSegment];
    if ((leadDraft?.curso_de_interesse ?? "") && nextCourses.includes(leadDraft!.curso_de_interesse)) return;
    onUpdateField("curso_de_interesse", "");
  }

  async function handleCreateTask() {
    if (!lead || !taskDraft.title.trim()) return;
    setTaskSaving(true); setTaskFeedback("");
    try {
      await onCreateTask(lead.id, { title: taskDraft.title.trim(), owner: taskDraft.owner, dueDate: taskDraft.dueDate });
      setTaskDraft({ title: "", owner: leadDraft?.responsavel ?? ownerOptions[0] ?? "Equipe Comercial", dueDate: leadDraft?.proximo_contato || "" });
      setTaskFeedback("Tarefa criada para este atendimento.");
    } catch (error) { setTaskFeedback(error instanceof Error ? error.message : "Não foi possível criar a tarefa."); } finally { setTaskSaving(false); }
  }

  async function handlePriorityChange(priority: ConversationPriority) { setWorkspaceFeedback(""); try { await onUpdateWorkspace({ priority }); setWorkspaceFeedback("Prioridade do atendimento atualizada."); } catch {} }
  async function handleServiceStatusChange(serviceStatus: ConversationServiceStatus) { setWorkspaceFeedback(""); try { await onUpdateWorkspace({ serviceStatus }); setWorkspaceFeedback("Status operacional atualizado."); } catch {} }
  async function handleAddTag() {
    const normalized = tagDraft.trim(); if (!normalized) return;
    const nextTags = Array.from(new Set([...(conversation.workspace?.tags ?? []), normalized]));
    setWorkspaceFeedback(""); try { await onUpdateWorkspace({ tags: nextTags }); setTagDraft(""); setWorkspaceFeedback("Etiqueta adicionada ao atendimento."); } catch {}
  }
  async function handleRemoveTag(tag: string) { setWorkspaceFeedback(""); try { await onUpdateWorkspace({ tags: (conversation.workspace?.tags ?? []).filter((item) => item !== tag) }); setWorkspaceFeedback("Etiqueta removida do atendimento."); } catch {} }
  async function handleSavePinnedNote() { setWorkspaceFeedback(""); try { await onUpdateWorkspace({ pinnedNote: pinnedNoteDraft.trim() }); setWorkspaceFeedback("Anotação fixa atualizada."); } catch {} }
  async function handleRegisterAttempt() {
    if (!attemptDraft.note.trim()) return; setWorkspaceFeedback(""); try { await onRegisterAttempt({ type: attemptDraft.type, note: attemptDraft.note.trim() }); setAttemptDraft((current) => ({ ...current, note: "" })); setWorkspaceFeedback("Tentativa de contato registrada."); } catch {}
  }

  return (
    <aside
      className={cn(
        "min-h-0 shrink-0 border-l border-white/5 bg-[#080808]",
        presentation === "inline"
          ? "hidden w-[360px] xl:flex xl:flex-col 2xl:w-[380px]"
          : "fixed top-20 bottom-4 right-4 z-40 flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[32px] border border-border bg-[#0a0a0a] "
      )}
    >
      <div className="border-b border-white/5 bg-[#0c0c0c] px-5 py-5 ">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Mesa de atendimento</p>
            <p className="mt-2 truncate text-[18px] font-light text-white tracking-wide">{displayName}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/50">
              <span className="inline-flex items-center gap-1.5 border border-white/10 rounded-full px-2 py-0.5"><Phone className="h-3 w-3" />+{displayPhone}</span>
              {lead ? <span className="inline-flex items-center gap-1.5 border border-white/10 rounded-full px-2 py-0.5"><UserCircle2 className="h-3 w-3" />{lead.responsavel}</span> : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {lead ? <Badge variant="outline" className="border-white/10 bg-white/5 text-white/70 max-w-[150px] justify-center text-center text-[9px] uppercase tracking-widest">{lead.status_funil}</Badge> : <Badge className="bg-amber-500/20 text-amber-500 text-[9px] uppercase tracking-widest border border-amber-500/30">Sem cadastro</Badge>}
            {presentation === "overlay" && onClose ? <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:bg-white/10 hover:text-white rounded-full" onClick={onClose}><X className="h-4 w-4" /></Button> : null}
          </div>
        </div>
      </div>

      {lead && leadDraft ? (
        <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-white/5 bg-[#0a0a0a]/50 px-4 py-3">
            <TabsList className="grid h-12 w-full grid-cols-3 bg-white/5 rounded-[16px] p-1 border border-white/10 shadow-inner">
              <TabsTrigger value="overview" className="rounded-[12px] text-[11px] font-bold uppercase tracking-widest text-white/50 data-[state=active]:bg-primary data-[state=active]:text-white">Painel</TabsTrigger>
              <TabsTrigger value="lead" className="rounded-[12px] text-[11px] font-bold uppercase tracking-widest text-white/50 data-[state=active]:bg-primary data-[state=active]:text-white">Lead</TabsTrigger>

            </TabsList>
          </div>

          <div className="crm-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-6 bg-[#080808]">
            <TabsContent value="overview" className="mt-0 space-y-6">
              
              {/* Resumo Rápido Cards */}
              <div className="grid grid-cols-2 gap-3">
                <InfoMetric label="Interesse" value={leadDraft.curso_de_interesse || "Nenhum"} hint={leadDraft.origem} />
                <InfoMetric label="Retorno" value={leadDraft.proximo_contato ? formatDate(leadDraft.proximo_contato) : "Sem data"} hint={isOverdue(leadDraft.proximo_contato) ? "Atrasado" : "Em dia"} tone={isOverdue(leadDraft.proximo_contato) ? "attention" : "default"} />
              </div>

              {/* Funil da Conversa (Radio Cards) */}
              <div className="rounded-[24px] border border-border bg-card p-5">
                <div className="mb-4">
                  <p className="text-[14px] font-light text-white tracking-wide">Funil Comercial</p>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">Atualize a etapa atual</p>
                </div>
                <div className="grid gap-2">
                  {funnelStatuses.map((status) => {
                    const active = leadDraft.status_funil === status;
                    return (
                      <button
                        key={status} type="button" disabled={!canEdit} onClick={() => onUpdateField("status_funil", status)}
                        className={cn(
                          "flex items-center justify-between rounded-[16px] border px-4 py-3 text-left transition-colors duration-300",
                          active ? "border-primary/50 bg-primary/10 text-white" : "border-border bg-white/5 hover:bg-white/10 text-white/70",
                          !canEdit && "cursor-default opacity-50"
                        )}
                      >
                        <span className="text-[13px] font-medium tracking-wide">{status}</span>
                        {active ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Classificação Operacional */}
              <div className="rounded-[24px] border border-border bg-card p-5">
                 <div className="mb-4">
                   <p className="text-[14px] font-light text-white tracking-wide">Classificação da Conversa</p>
                 </div>
                 <div className="grid gap-5">
                   <div className="grid gap-4 md:grid-cols-2">
                     <LeadField label="Prioridade">
                       <Select value={conversation.workspace?.priority ?? "normal"} onValueChange={(value) => void handlePriorityChange(value as ConversationPriority)} disabled={!canEdit || workspaceSaving}>
                         <SelectTrigger className="h-10 border-0 bg-transparent text-[13px] text-white focus:ring-0 shadow-none"><SelectValue /></SelectTrigger>
                         <SelectContent className="border-white/10 bg-[#0c0c0c] text-white">{PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                       </Select>
                     </LeadField>
                     <LeadField label="Status Operacional">
                       <Select value={conversation.workspace?.serviceStatus ?? "fila"} onValueChange={(value) => void handleServiceStatusChange(value as ConversationServiceStatus)} disabled={!canEdit || workspaceSaving}>
                         <SelectTrigger className="h-10 border-0 bg-transparent text-[13px] text-white focus:ring-0 shadow-none"><SelectValue /></SelectTrigger>
                         <SelectContent className="border-white/10 bg-[#0c0c0c] text-white">{SERVICE_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                       </Select>
                     </LeadField>
                   </div>
                   
                   <div className="grid gap-2">
                     <Label className="text-[10px] font-bold uppercase tracking-widest text-white/50">Etiquetas (Tags)</Label>
                     <div className="flex flex-wrap gap-2 mb-2">
                       {(conversation.workspace?.tags ?? []).length ? conversation.workspace?.tags.map((tagItem) => (
                         <button key={tagItem} type="button" disabled={!canEdit || workspaceSaving} onClick={() => void handleRemoveTag(tagItem)} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/20">
                           <Tag className="h-3 w-3" /> {tagItem} {canEdit ? <X className="h-3 w-3 opacity-60" /> : null}
                         </button>
                       )) : <p className="text-[12px] font-light text-white/30">Nenhuma tag.</p>}
                     </div>
                     {canEdit ? (
                       <div className="flex gap-2">
                         <div className="flex-1 rounded-xl border border-white/10 bg-white/5 overflow-hidden shadow-inner flex items-center px-3">
                           <Input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="Nova tag..." className="h-9 border-0 bg-transparent text-[13px] text-white placeholder:text-white/30 focus-visible:ring-0 px-0 shadow-none" />
                         </div>
                         <Button type="button" variant="outline" className="h-9 rounded-xl border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-widest text-white/70 hover:bg-white/10" onClick={() => void handleAddTag()} disabled={!tagDraft.trim() || workspaceSaving}>Add</Button>
                       </div>
                     ) : null}
                   </div>

                   <LeadField label="Anotação Fixa (Pin)">
                      <Textarea disabled={!canEdit || workspaceSaving} value={pinnedNoteDraft} onChange={(e) => setPinnedNoteDraft(e.target.value)} placeholder="Contexto que fica fixo no painel." className="min-h-20 resize-none border-0 bg-transparent text-[13px] text-white placeholder:text-white/30 focus-visible:ring-0 p-3 shadow-none" />
                   </LeadField>
                   {canEdit ? (
                     <div className="flex justify-end">
                       <Button type="button" variant="outline" className="h-8 rounded-full border-primary/30 bg-primary/10 px-4 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/20" onClick={() => void handleSavePinnedNote()} disabled={workspaceSaving}>{workspaceSaving ? <LoaderCircle className="h-3 w-3 animate-spin mr-2" /> : null} Salvar Pin</Button>
                     </div>
                   ) : null}
                 </div>
              </div>
              
              {/* Histórico e Próximo Passo */}
              {canEdit ? (
                <div className="rounded-[24px] border border-border bg-card p-5">
                  <div className="mb-4">
                     <p className="text-[14px] font-light text-white tracking-wide">Próximo Passo (Tarefa)</p>
                  </div>
                  <div className="grid gap-4">
                     <LeadField label="Ação a ser feita">
                       <Input value={taskDraft.title} onChange={(e) => setTaskDraft(current => ({ ...current, title: e.target.value }))} placeholder="O que precisa ser feito?" className="border-0 bg-transparent text-[13px] text-white focus-visible:ring-0 px-3 shadow-none h-10" />
                     </LeadField>
                     <div className="grid gap-4 md:grid-cols-2">
                       <LeadField label="Responsável"><LeadSelect value={taskDraft.owner} onValueChange={(v) => setTaskDraft(c => ({...c, owner: v}))} options={ownerOptions} /></LeadField>
                       <LeadField label="Quando?"><Input type="date" value={taskDraft.dueDate} onChange={(e) => setTaskDraft(c => ({...c, dueDate: e.target.value}))} className="border-border bg-background text-[13px] h-10" /></LeadField>
                     </div>
                     <div className="flex justify-end pt-2">
                        <Button type="button" className="h-10 rounded-full bg-primary px-6 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-primary/90" onClick={handleCreateTask} disabled={taskSaving || !taskDraft.title.trim() || !taskDraft.dueDate}>
                         {taskSaving ? <LoaderCircle className="h-4 w-4 animate-spin mr-2" /> : null} Criar Tarefa
                       </Button>
                     </div>
                     {taskFeedback ? <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 text-right">{taskFeedback}</p> : null}
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="lead" className="mt-0 space-y-6">
              <div className="rounded-[24px] border border-border bg-card p-5">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20"><FilePenLine className="h-5 w-5" /></span>
                  <div>
                    <p className="text-[14px] font-light text-white tracking-wide">{canEdit ? "Ficha de Qualificação" : "Dados do Lead"}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{canEdit ? "Atualize dados durante a conversa" : "Visualização somente leitura"}</p>
                  </div>
                </div>

                <div className="grid gap-5">
                  <LeadField label="Nome *"><Input disabled={!canEdit} value={leadDraft.nome} onChange={(e) => onUpdateField("nome", e.target.value)} className="border-0 bg-transparent text-[13px] text-white focus-visible:ring-0 px-3 shadow-none h-10" /></LeadField>
                  <div className="grid gap-5 md:grid-cols-2">
                    <LeadField label="Telefone *"><Input disabled={!canEdit} value={leadDraft.telefone} onChange={(e) => onUpdateField("telefone", e.target.value)} className="border-0 bg-transparent text-[13px] text-white focus-visible:ring-0 px-3 shadow-none h-10" /></LeadField>
                    <LeadField label="WhatsApp"><Input disabled={!canEdit} value={leadDraft.whatsapp} onChange={(e) => onUpdateField("whatsapp", e.target.value)} className="border-0 bg-transparent text-[13px] text-white focus-visible:ring-0 px-3 shadow-none h-10" /></LeadField>
                  </div>
                  <LeadField label="Email"><Input disabled={!canEdit} type="email" value={leadDraft.email} onChange={(e) => onUpdateField("email", e.target.value)} className="border-0 bg-transparent text-[13px] text-white focus-visible:ring-0 px-3 shadow-none h-10" /></LeadField>
                  
                  <div className="grid gap-5 md:grid-cols-2">
                     <LeadField label="Segmento do Curso"><LeadSelect disabled={!canEdit} value={selectedCourseSegment} onValueChange={handleCourseSegmentChange} options={[{ value: "formacao", label: "Formação" }, { value: "especializacao", label: "Especialização" }]} /></LeadField>
                     <LeadField label="Curso de Interesse"><LeadSelect disabled={!canEdit} value={leadDraft.curso_de_interesse} onValueChange={(v) => onUpdateField("curso_de_interesse", v)} options={visibleCourseOptions} /></LeadField>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <LeadField label="Origem"><LeadSelect disabled={!canEdit} value={leadDraft.origem} onValueChange={(v) => onUpdateField("origem", v)} options={originOptions} /></LeadField>
                    <LeadField label="Responsável Oficial"><LeadSelect disabled={!canEdit} value={leadDraft.responsavel} onValueChange={(v) => onUpdateField("responsavel", v)} options={ownerOptions} /></LeadField>
                  </div>

                  <LeadField label="Captado Via"><LeadSelect disabled={!canEdit} value={leadDraft.captado_via} onValueChange={(v) => onUpdateField("captado_via", v)} options={captureMethodOptions} /></LeadField>
                  
                  <LeadField label="Observações">
                    <Textarea disabled={!canEdit} value={leadDraft.observacoes} onChange={(e) => onUpdateField("observacoes", e.target.value)} className="min-h-24 resize-none border-0 bg-transparent text-[13px] text-white focus-visible:ring-0 p-3 shadow-none" />
                  </LeadField>
                </div>
              </div>
              
              {canEdit && hasLeadDraftChanges ? (
                <div className="sticky bottom-4 z-10 rounded-[24px] border border-border bg-[#0c0c0c] p-4 ">
                  <div className="flex flex-col gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary text-center">Alterações pendentes detectadas</p>
                    <div className="flex gap-3">
                      <Button type="button" variant="outline" className="flex-1 h-10 rounded-full border-white/10 bg-white/5 text-[11px] font-bold uppercase tracking-widest text-white/50 hover:bg-white/10 hover:text-white" onClick={onReset} disabled={leadSaving}>Descartar</Button>
                      <Button type="button" className="flex-1 h-10 rounded-full bg-primary text-[11px] font-bold uppercase tracking-widest text-white hover:bg-primary/90" onClick={onSave} disabled={leadSaving}>{leadSaving ? <LoaderCircle className="h-4 w-4 animate-spin mr-2" /> : null} Salvar Tudo</Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </TabsContent>

          </div>
        </Tabs>
      ) : (
        <div className="grid flex-1 place-items-center px-6 text-center">
           <div className="flex flex-col items-center gap-4">
             <UserCircle2 className="h-16 w-16 text-white/10" />
             <p className="text-[14px] font-light text-white/40 tracking-wide max-w-[240px]">Selecione ou cadastre o lead para habilitar o cockpit completo.</p>
           </div>
        </div>
      )}
    </aside>
  );
}
