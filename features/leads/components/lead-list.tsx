"use client";

import { MapPin, MessageCircle, Phone, Route, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ScorePill } from "@/features/app-shell/components/page-primitives";
import { AddToLeadListDialog } from "@/features/leads/components/add-to-lead-list-dialog";
import {
  computeLeadScore,
  formatDateTime,
  getLastLeadActivity,
  getLeadAttentionMeta,
  getLeadDataQuality,
  getLeadTrackedCampaignLabel,
  getLeadTrackedOriginLabel,
  type Lead,
  type LeadList,
  type LeadListColor,
} from "@/lib/crm";

type Props = {
  leads: Lead[];
  allLeads: Lead[];
  leadLists: LeadList[];
  onOpen: (id: string) => void;
  onEdit: (lead: Lead) => void;
  onOpenMessages: () => void;
  onAddToLeadList: (listId: string, leadId: string) => Promise<void>;
  onCreateLeadList: (draft: { name: string; description: string; color: LeadListColor; leadIds: string[] }) => Promise<void>;
  canEdit: boolean;
};

export function LeadList({
  leads, allLeads, leadLists, onOpen, onEdit, onOpenMessages, onAddToLeadList, onCreateLeadList, canEdit,
}: Props) {
  if (!leads.length) {
    return <EmptyState text="Nenhum lead encontrado com os filtros atuais." />;
  }

  const sorted = [...leads].sort((a, b) => (computeLeadScore(b)?.value ?? 0) - (computeLeadScore(a)?.value ?? 0));

  return (
    <div className="grid gap-4">
      {sorted.map((lead) => {
        const score = computeLeadScore(lead);
        const attention = getLeadAttentionMeta(lead);
        const lastActivity = getLastLeadActivity(lead);
        const quality = getLeadDataQuality(lead, allLeads);
        const neonGlow = quality.duplicateHints.length
          ? "rgba(239, 68, 68, 0.4)" // rose
          : attention
            ? "rgba(245, 158, 11, 0.4)" // amber
            : score && score.value >= 70
              ? "rgba(16, 185, 129, 0.4)" // emerald
              : "rgba(255, 255, 255, 0.0)";

        const borderColor = quality.duplicateHints.length
          ? "border-rose-500/50" : attention ? "border-amber-500/50" : score && score.value >= 70 ? "border-emerald-500/30" : "border-white/5";

        return (
          <Card 
            key={lead.id} 
            className={`group overflow-hidden rounded-[24px] transition-colors duration-300 hover:bg-white/[0.04] bg-white/[0.015]  border ${borderColor}`}
            style={{ boxShadow: neonGlow !== "rgba(255, 255, 255, 0.0)" ? `0 0 20px ${neonGlow}` : 'none' }}
          >
            <CardContent className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.92fr)_minmax(0,1fr)_auto] xl:items-center">
              
              <div className="min-w-0 space-y-3">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-[14px] font-bold text-primary">
                    {lead.nome.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-[18px] font-semibold tracking-wide text-white">{lead.nome}</h3>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[12px] font-light text-white/50">
                      <span className="inline-flex items-center gap-1.5 border border-white/10 bg-white/5 px-2 py-1 rounded-full">
                        <Phone className="h-3 w-3" /> {lead.telefone}
                      </span>
                      <span className="inline-flex items-center gap-1.5 border border-white/10 bg-white/5 px-2 py-1 rounded-full">
                        <MapPin className="h-3 w-3" /> {lead.cidade || "Cidade não informada"}
                      </span>
                    </div>
                  </div>
                </div>
                {lastActivity ? (
                  <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-light text-white/40 max-w-fit">
                    {lastActivity.action} · {formatDateTime(lastActivity.createdAt)}
                  </p>
                ) : null}
              </div>

              <div className="min-w-0 rounded-[20px] border border-white/10 bg-white/5 p-4">
                <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                  <Route className="h-3.5 w-3.5" /> Origem e campanha
                </p>
                <p className="mt-3 truncate text-[14px] font-medium text-white">{getLeadTrackedOriginLabel(lead)}</p>
                <p className="mt-1 truncate text-[12px] font-light text-white/50">{getLeadTrackedCampaignLabel(lead)}</p>
                <p className="mt-3 line-clamp-2 text-[13px] font-light text-white/60">{lead.curso_de_interesse}</p>
              </div>

              <div className="min-w-0 space-y-3">
                <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                  <Tags className="h-3.5 w-3.5" /> Situação
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-widest text-white/50">{lead.status_funil}</Badge>
                  {score ? <ScorePill score={score} showLabel /> : null}
                  {attention ? <Badge variant={attention.variant} className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">{attention.label}</Badge> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="gold" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">{lead.status_matricula}</Badge>
                  {quality.duplicateHints.length ? <Badge variant="danger" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">Possível duplicado</Badge> : null}
                  {quality.missingStageRequirements.length ? (
                    <Badge variant="gold" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">Etapa incompleta</Badge>
                  ) : null}
                </div>
                {!quality.duplicateHints.length && !quality.missingStageRequirements.length && quality.missingCoreFields.length ? (
                  <p className="text-[11px] font-light text-rose-400/60">
                    Falta: {quality.missingCoreFields.map((item) => item.label.toLowerCase()).join(", ")}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3 xl:justify-end xl:flex-col">
                <div className="flex gap-3 w-full xl:justify-end">
                   <Button size="sm" variant="outline" className="rounded-full border-white/10 hover:bg-white/5 px-4 font-bold uppercase tracking-widest text-[10px] text-white/70" onClick={onOpenMessages}>
                     <MessageCircle className="h-4 w-4 mr-2" /> Conversa
                   </Button>
                   <Button size="sm" className="rounded-full px-6 font-bold uppercase tracking-widest text-[10px]" onClick={() => onOpen(lead.id)}>
                     Abrir
                   </Button>
                </div>
                <div className="flex gap-3 w-full xl:justify-end mt-2">
                   <AddToLeadListDialog lead={lead} leadLists={leadLists} canEdit={canEdit} onAddToList={onAddToLeadList} onCreateList={onCreateLeadList} buttonLabel="Salvar Lista" />
                   {canEdit ? (
                     <Button size="sm" variant="outline" className="rounded-full border-white/10 hover:bg-white/5 px-6 font-bold uppercase tracking-widest text-[10px] text-white/70" onClick={() => onEdit(lead)}>
                       Editar
                     </Button>
                   ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
