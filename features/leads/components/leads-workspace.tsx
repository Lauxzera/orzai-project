"use client";

import * as React from "react";
import { BriefcaseBusiness, CircleAlert, CopyCheck, LayoutList, PanelLeft, ShieldCheck, SlidersHorizontal, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterSelect } from "@/features/app-shell/components/page-primitives";
import { Kanban } from "@/features/kanban/components/kanban-board";
import { LeadCard } from "@/features/leads/components/lead-card";
import { LeadList } from "@/features/leads/components/lead-list";
import {
  getLeadAttentionFilterValue,
  getLeadIntegrityFilterValue,
  type FunnelStatus,
  type Lead,
  type LeadAttentionFilter,
  type LeadIntegrityFilter,
  type LeadList as LeadListType,
  type LeadListColor,
  type UserRole,
} from "@/lib/crm";
import { motion } from "framer-motion";

type Props = {
  leads: Lead[]; leadLists: LeadListType[]; canEdit: boolean; currentRole: UserRole;
  onOpenLead: (id: string) => void; onEditLead: (lead: Lead) => void; onOpenMessages: () => void;
  onMoveLead: (id: string, status: FunnelStatus) => void | Promise<void>;
  onAddToLeadList: (listId: string, leadId: string) => Promise<void>;
  onCreateLeadList: (draft: { name: string; description: string; color: LeadListColor; leadIds: string[] }) => Promise<void>;
};

const attentionOptions: Array<{ value: LeadAttentionFilter; label: string }> = [
  { value: "all", label: "Todas as prioridades" },
  { value: "acao-imediata", label: "Ação imediata" },
  { value: "prioridade-alta", label: "Prioridade alta" },
  { value: "em-acompanhamento", label: "Em acompanhamento" },
  { value: "baixa-prioridade", label: "Baixa prioridade" },
];

const integrityOptions: Array<{ value: LeadIntegrityFilter; label: string }> = [
  { value: "all", label: "Qualquer integridade" },
  { value: "completo", label: "Cadastro completo" },
  { value: "incompleto", label: "Cadastro incompleto" },
  { value: "duplicado", label: "Possível duplicado" },
];

export function LeadsWorkspace({
  leads, leadLists, canEdit, currentRole, onOpenLead, onEditLead, onOpenMessages, onMoveLead, onAddToLeadList, onCreateLeadList,
}: Props) {
  const [mode, setMode] = React.useState<"list" | "kanban">(currentRole === "VIEWER" ? "list" : "kanban");
  const [attentionFilter, setAttentionFilter] = React.useState<LeadAttentionFilter>("all");
  const [integrityFilter, setIntegrityFilter] = React.useState<LeadIntegrityFilter>("all");

  React.useEffect(() => {
    if (currentRole === "VIEWER" && mode === "kanban") {
      setMode("list");
    }
  }, [currentRole, mode]);

  const allowKanban = currentRole !== "VIEWER";
  const visibleLeads = React.useMemo(() => {
    return leads.filter((lead) => {
      const attentionMatch = attentionFilter === "all" || getLeadAttentionFilterValue(lead) === attentionFilter;
      const integrityMatch = integrityFilter === "all" || getLeadIntegrityFilterValue(lead, leads) === integrityFilter;
      return attentionMatch && integrityMatch;
    });
  }, [attentionFilter, integrityFilter, leads]);

  const activePipelineCount = React.useMemo(() => visibleLeads.filter((l) => l.status_funil !== "Matriculado" && l.status_funil !== "Perdido").length, [visibleLeads]);
  const urgentCount = React.useMemo(() => visibleLeads.filter((l) => getLeadAttentionFilterValue(l) === "acao-imediata").length, [visibleLeads]);
  const duplicateCount = React.useMemo(() => visibleLeads.filter((l) => getLeadIntegrityFilterValue(l, leads) === "duplicado").length, [leads, visibleLeads]);

  return (
    <div className="space-y-8">
      {/* Top Banner (Sleek Glass Row) */}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-wide text-white">Central de Leads</h1>
          <p className="mt-2 text-[13px] font-light text-white/40">Acompanhe a carteira, priorize contatos quentes e conduza os fechamentos.</p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 bg-card border border-border p-1 rounded-full ">
            {[
              { id: "kanban", label: "Funil", icon: PanelLeft, count: activePipelineCount, disabled: !allowKanban },
              { id: "list", label: "Lista", icon: LayoutList, count: visibleLeads.length, disabled: false }
            ].map((m) => {
              const isActive = mode === m.id;
              return (
                <button
                  key={m.id}
                  disabled={m.disabled}
                  onClick={() => setMode(m.id as "list" | "kanban")}
                  className={`relative flex items-center gap-2 px-6 py-2 text-[12px] font-bold uppercase tracking-widest transition-colors duration-300 disabled:opacity-30 ${isActive ? "text-primary" : "text-white/40 hover:text-white"}`}
                >
                  {isActive && <div className="absolute inset-0 bg-primary/20 border border-primary/30 rounded-full transition-colors duration-300" />}
                  <m.icon className="relative z-10 h-4 w-4" />
                  <span className="relative z-10">{m.label}</span>
                  <span className={`relative z-10 ml-2 rounded-full px-2 py-0.5 text-[10px] ${isActive ? 'bg-primary/30 text-white' : 'bg-white/10 text-white/50'}`}>
                    {m.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric icon={UsersRound} label="Visíveis" value={String(visibleLeads.length)} tone="neutral" />
        <SummaryMetric icon={BriefcaseBusiness} label="Funil ativo" value={String(activePipelineCount)} tone="primary" />
        <SummaryMetric icon={CircleAlert} label="Ação Imediata" value={String(urgentCount)} tone="warning" />
        <SummaryMetric icon={CopyCheck} label="Duplicados" value={String(duplicateCount)} tone="danger" />
      </div>

      <div className="relative grid gap-4 rounded-[24px] border border-border bg-card  p-4 lg:grid-cols-3">
        <FilterSelect
          value={attentionFilter}
          onValueChange={(value) => setAttentionFilter(value as LeadAttentionFilter)}
          options={attentionOptions.map((option) => option.label)}
          placeholder="Todas as prioridades"
          optionValues={attentionOptions.map((option) => option.value)}
        />
        <FilterSelect
          value={integrityFilter}
          onValueChange={(value) => setIntegrityFilter(value as LeadIntegrityFilter)}
          options={integrityOptions.map((option) => option.label)}
          placeholder="Qualquer integridade"
          optionValues={integrityOptions.map((option) => option.value)}
        />
        <div className="rounded-[16px] border border-border bg-card px-4 py-2 flex items-center gap-3">
           <SlidersHorizontal className="h-4 w-4 text-white/40" />
           <p className="text-[12px] font-light text-white/60">Filtros limitam os leads exibidos abaixo.</p>
        </div>
      </div>

      <Tabs value={mode} onValueChange={(value) => setMode(value as "list" | "kanban")}> 
        <TabsContent value="list" className="mt-0">
          <LeadList
            leads={visibleLeads} allLeads={leads} leadLists={leadLists}
            onOpen={onOpenLead} onEdit={onEditLead} onOpenMessages={onOpenMessages}
            onAddToLeadList={onAddToLeadList} onCreateLeadList={onCreateLeadList} canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="kanban" className="mt-0">
          <Kanban
            leads={visibleLeads}
            onMove={onMoveLead}
            renderLeadCard={(lead) => (
              <LeadCard
                lead={lead} allLeads={leads} onOpen={onOpenLead} onEdit={onEditLead}
                onMove={onMoveLead} draggable leadLists={leadLists} onAddToLeadList={onAddToLeadList}
                onCreateLeadList={onCreateLeadList} canEdit={canEdit}
              />
            )}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryMetric({
  icon: Icon, label, value, tone,
}: {
  icon: typeof ShieldCheck; label: string; value: string; tone: "primary" | "warning" | "neutral" | "danger";
}) {
  const glowColor =
    tone === "danger" ? "rgba(239, 68, 68, 0.4)"
      : tone === "warning" ? "rgba(245, 158, 11, 0.4)"
        : tone === "primary" ? "rgba(219, 13, 113, 0.4)"
          : "rgba(255, 255, 255, 0.2)";

  const textColor =
    tone === "danger" ? "text-rose-400"
      : tone === "warning" ? "text-amber-400"
        : tone === "primary" ? "text-primary"
          : "text-white";

  return (
    <div className="group relative overflow-hidden rounded-[24px] border border-border bg-card  transition-colors duration-300 hover:bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">{label}</p>
          <p className={`mt-4 text-[32px] font-light tabular-nums drop-shadow-md ${textColor}`} style={{ textShadow: `0 0 20px ${glowColor}` }}>
            {value}
          </p>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border border-white/10 bg-white/5 transition-transform duration-300 group-hover:scale-110 ${textColor}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
