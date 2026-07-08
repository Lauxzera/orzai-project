"use client";

import * as React from "react";
import { CalendarClock, LoaderCircle, Phone, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScorePill } from "@/features/app-shell/components/page-primitives";
import { AddToLeadListDialog } from "@/features/leads/components/add-to-lead-list-dialog";
import {
  closingStatuses,
  computeLeadScore,
  formatDate,
  formatDateTime,
  getLastLeadActivity,
  getLeadAttentionMeta,
  getLeadDataQuality,
  isOverdue,
  type FunnelStatus,
  type Lead,
  type LeadList,
  type LeadListColor,
} from "@/lib/crm";
import type { ConversationAnalysis } from "@/lib/messages";

type LeadConversationAnalysisPayload = ConversationAnalysis | { error?: string };

const leadConversationAnalysisCache = new Map<string, LeadConversationAnalysisPayload>();
const leadConversationAnalysisInflight = new Map<string, Promise<LeadConversationAnalysisPayload>>();

function leadConversationAnalysisKey(leadId: string, leadStatus: string) {
  return `${leadId}::${leadStatus}`;
}

function isConversationAnalysisPayload(payload: LeadConversationAnalysisPayload): payload is ConversationAnalysis {
  return !("error" in payload);
}

async function getLeadConversationAnalysis(leadId: string, leadStatus: string, force = false) {
  const key = leadConversationAnalysisKey(leadId, leadStatus);
  if (!force && leadConversationAnalysisCache.has(key)) return leadConversationAnalysisCache.get(key)!;
  if (!force && leadConversationAnalysisInflight.has(key)) return leadConversationAnalysisInflight.get(key)!;

  const request = (async (): Promise<LeadConversationAnalysisPayload> => {
    const res = await fetch("/api/ai/conversation-analysis", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId, leadStatus }),
    });
    return res.json() as Promise<LeadConversationAnalysisPayload>;
  })().then((data) => {
    leadConversationAnalysisCache.set(key, data);
    return data;
  }).finally(() => { leadConversationAnalysisInflight.delete(key); });

  leadConversationAnalysisInflight.set(key, request);
  return request;
}

type Props = {
  lead: Lead; allLeads: Lead[]; onOpen: (id: string) => void; onEdit: (lead: Lead) => void;
  onMove?: (id: string, status: FunnelStatus) => void | Promise<void>; draggable?: boolean;
  leadLists: LeadList[]; onAddToLeadList: (listId: string, leadId: string) => Promise<void>;
  onCreateLeadList: (draft: { name: string; description: string; color: LeadListColor; leadIds: string[] }) => Promise<void>;
  canEdit: boolean;
};

export function LeadCard({
  lead, allLeads, onOpen, onEdit, onMove, draggable = false, leadLists, onAddToLeadList, onCreateLeadList, canEdit,
}: Props) {
  const overdue = isOverdue(lead.proximo_contato) && !closingStatuses.includes(lead.status_funil);
  const [analysis, setAnalysis] = React.useState<ConversationAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = React.useState(false);
  const [analysisError, setAnalysisError] = React.useState("");
  const [applying, setApplying] = React.useState(false);
  const cacheKey = React.useMemo(() => leadConversationAnalysisKey(lead.id, lead.status_funil), [lead.id, lead.status_funil]);
  const score = computeLeadScore(lead);
  const attention = getLeadAttentionMeta(lead);
  const lastActivity = getLastLeadActivity(lead);
  const quality = getLeadDataQuality(lead, allLeads);

  const borderColor = overdue || quality.duplicateHints.length
    ? "border-destructive" : attention ? "border-amber-500" : score && score.value >= 70 ? "border-emerald-500" : "border-border";

  React.useEffect(() => {
    const cached = leadConversationAnalysisCache.get(cacheKey);
    if (cached && isConversationAnalysisPayload(cached)) {
      setAnalysis(cached);
      setAnalysisError("");
    }
  }, [cacheKey]);

  async function handleAiAnalyze(event: React.MouseEvent) {
    event.stopPropagation();
    setAnalysisLoading(true);
    setAnalysisError("");
    try {
      const result = await getLeadConversationAnalysis(lead.id, lead.status_funil);
      if (!isConversationAnalysisPayload(result)) setAnalysisError(result.error || "Nenhuma conversa vinculada a este lead.");
      else setAnalysis(result);
    } catch {
      setAnalysisError("Erro ao conectar com o serviço de análise.");
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function applyStatus() {
    if (!analysis?.suggestedStatus || !onMove) return;
    setApplying(true);
    try {
      await onMove(lead.id, analysis.suggestedStatus as FunnelStatus);
      setAnalysis(null);
    } finally {
      setApplying(false);
    }
  }

  const sentimentVariant = { positive: "success", neutral: "outline", negative: "danger" } as const;
  const urgencyVariant = { alta: "danger", media: "gold", baixa: "outline" } as const;

  return (
    <Card
      draggable={draggable}
      onDragStart={(event) => event.dataTransfer.setData("lead-id", lead.id)}
      className={`group overflow-hidden rounded-[16px] transition-colors bg-card hover:bg-accent/5 border ${borderColor}`}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-3 pt-1">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-[14px] font-bold text-primary">
                {lead.nome.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-[16px] font-semibold text-white tracking-wide">{lead.nome}</h3>
                <p className="mt-1 line-clamp-2 text-[13px] font-light text-white/50">{lead.curso_de_interesse}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                <Phone className="h-3 w-3" />
                {lead.telefone}
              </p>
            </div>
            {lastActivity ? (
              <p className="text-[11px] font-light text-white/40">
                {lastActivity.action} · {formatDateTime(lastActivity.createdAt)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            {score ? <ScorePill score={score} /> : null}
            {overdue ? <Badge variant="danger" className="text-[10px] uppercase tracking-widest font-bold">Atrasado</Badge> : null}

          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Badge variant="gold" className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider">{lead.origem}</Badge>
          <Badge variant="outline" className="rounded-full border-border bg-background px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{lead.responsavel}</Badge>
          {attention ? <Badge variant={attention.variant} className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">{attention.label}</Badge> : null}
          {quality.duplicateHints.length ? <Badge variant="danger" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">Possível duplicado</Badge> : null}
          {quality.missingStageRequirements.length ? <Badge variant="gold" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">Etapa incompleta</Badge> : null}
          {lead.status_matricula === "Matriculado" ? <Badge variant="success" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">Matriculado</Badge> : null}
        </div>

        <div className="mt-5 rounded-xl border border-border bg-background/50 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> Próximo contato
          </p>
          <p className="mt-1.5 text-[13px] font-medium text-foreground">{formatDate(lead.proximo_contato)}</p>
          {!quality.duplicateHints.length && !quality.missingStageRequirements.length && quality.missingCoreFields.length ? (
            <p className="mt-1 text-[11px] text-destructive/80 font-medium">
              Falta: {quality.missingCoreFields.map((item) => item.label.toLowerCase()).join(", ")}
            </p>
          ) : null}
        </div>

        {analysisError ? <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">{analysisError}</p> : null}

        {analysis ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-primary/20 bg-primary/10 p-4">
            <p className="text-[12px] font-light leading-relaxed text-primary/80">{analysis.summary}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={sentimentVariant[analysis.sentiment]} className="text-[10px] uppercase tracking-widest">
                {analysis.sentiment === "positive" ? "Positivo" : analysis.sentiment === "negative" ? "Negativo" : "Neutro"}
              </Badge>
              <Badge variant={urgencyVariant[analysis.urgency]} className="text-[10px] uppercase tracking-widest">
                Urgência {analysis.urgency === "alta" ? "Alta" : analysis.urgency === "media" ? "Média" : "Baixa"}
              </Badge>
            </div>
            {analysis.suggestedStatus && analysis.suggestedStatus !== lead.status_funil ? (
              <div className="flex items-center justify-between gap-3 mt-2 border-t border-primary/20 pt-3">
                <span className="truncate text-[11px] font-light text-primary/60">
                  Avançar para <span className="font-bold text-primary">{analysis.suggestedStatus}</span>
                </span>
                <Button size="sm" className="h-7 shrink-0 rounded-full px-4 text-[10px] font-bold uppercase tracking-widest" onClick={applyStatus} disabled={applying || !onMove || !canEdit}>
                  {applying ? "..." : "Aplicar"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" className="rounded-full px-5 h-8 font-bold uppercase tracking-wider text-[10px] hover:bg-primary/90" onClick={() => onOpen(lead.id)}>Abrir Lead</Button>
          <AddToLeadListDialog lead={lead} leadLists={leadLists} canEdit={canEdit} onAddToList={onAddToLeadList} onCreateList={onCreateLeadList} buttonLabel="Salvar na Lista" />
          {canEdit ? <Button size="sm" variant="outline" className="rounded-full border-border bg-transparent hover:bg-accent/10 px-5 h-8 font-bold uppercase tracking-wider text-[10px] text-muted-foreground hover:text-foreground" onClick={() => onEdit(lead)}>Editar</Button> : null}
        </div>
      </CardContent>
    </Card>
  );
}
