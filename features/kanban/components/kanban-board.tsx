"use client";

import * as React from "react";
import { ArrowLeft, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/features/app-shell/components/page-primitives";
import { computeLeadScore, formatDateTime, getLastLeadActivity, getLeadAttentionMeta, type FunnelStatus, type Lead } from "@/lib/crm";
import { motion } from "framer-motion";

const FUNNEL_STATUSES: FunnelStatus[] = [
  "Novo Lead", "Primeiro Contato Feito", "Interessado no Curso", "Informações Enviadas",
  "Aguardando Retorno", "Negociação / Matrícula", "Aguardando Pagamento", "Matriculado",
  "Perdido", "Reativar Futuramente",
];

type KanbanProps = {
  leads: Lead[];
  onMove: (id: string, status: FunnelStatus) => void | Promise<void>;
  renderLeadCard: (lead: Lead) => React.ReactNode;
};

export function Kanban({ leads, onMove, renderLeadCard }: KanbanProps) {
  return (
    <div className="kanban-scroll grid h-[min(76vh,900px)] min-h-[560px] auto-cols-[minmax(340px,1fr)] grid-flow-col gap-6 overflow-x-auto overflow-y-hidden pb-6 pt-2">
      {FUNNEL_STATUSES.map((status) => {
        const columnLeads = leads
          .filter((lead) => lead.status_funil === status)
          .sort((a, b) => (computeLeadScore(b)?.value ?? 0) - (computeLeadScore(a)?.value ?? 0));

        return (
          <section
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onMove(event.dataTransfer.getData("lead-id"), status)}
            className="flex h-full min-h-0 flex-col rounded-[32px] border border-white/5 bg-white/[0.015] backdrop-blur-[24px] shadow-lg"
          >
            <header className="space-y-2 border-b border-white/5 bg-white/[0.01] px-6 py-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-white/90">{status}</p>
                <Badge variant="outline" className="h-6 rounded-full border-white/10 bg-white/5 px-3 text-[11px] font-bold text-white/50">
                  {columnLeads.length}
                </Badge>
              </div>
            </header>
            <div className="crm-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid gap-4">
                {columnLeads.length ? columnLeads.map((lead) => <React.Fragment key={lead.id}>{renderLeadCard(lead)}</React.Fragment>) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center opacity-40">
                    <div className="mb-4 h-12 w-12 rounded-full border border-white/10 bg-white/5" />
                    <p className="text-sm font-light text-white">Nenhum lead</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

type KanbanLeadsPageProps = {
  leads: Lead[];
  onOpen: (id: string) => void;
  onEdit: (lead: Lead) => void;
  onBack: () => void;
  canEdit: boolean;
};

export function KanbanLeadsPage({ leads, onOpen, onEdit, onBack, canEdit }: KanbanLeadsPageProps) {
  const [search, setSearch] = React.useState("");

  const visibleLeads = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    const ordered = [...leads].sort((a, b) => {
      const scoreDiff = (computeLeadScore(b)?.value ?? 0) - (computeLeadScore(a)?.value ?? 0);
      return scoreDiff !== 0 ? scoreDiff : a.nome.localeCompare(b.nome, "pt-BR");
    });
    if (!term) return ordered;
    return ordered.filter((lead) =>
      [lead.nome, lead.telefone, lead.email, lead.cidade, lead.curso_de_interesse, lead.origem, lead.responsavel].some((value) =>
        value.toLowerCase().includes(term)
      )
    );
  }, [leads, search]);

  return (
    <div className="space-y-6">
      <Card className="rounded-[32px] border border-white/5 bg-white/[0.015] backdrop-blur-[24px]">
        <CardContent className="space-y-4 p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Button variant="ghost" size="sm" onClick={onBack} className="rounded-full text-white/50 hover:bg-white/5 hover:text-white mb-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Kanban
              </Button>
              <h2 className="text-2xl font-light tracking-wide text-white">Todos os leads do Kanban</h2>
              <p className="text-[13px] font-light text-white/40">Visualização completa dos leads do recorte atual.</p>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/5 px-4 py-1 text-[11px] uppercase tracking-widest text-white/50">{visibleLeads.length} registros</Badge>
          </div>
          <div className="relative pt-4">
            <Search className="absolute left-4 top-[2.2rem] h-5 w-5 text-white/30" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-14 rounded-2xl border-white/10 bg-white/5 pl-12 text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-primary/50"
              placeholder="Buscar por nome, telefone, curso, origem..."
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {visibleLeads.length ? visibleLeads.map((lead) => {
          const attention = getLeadAttentionMeta(lead);
          const lastActivity = getLastLeadActivity(lead);

          return (
            <Card key={`kanban-list-${lead.id}`} className="rounded-[24px] border border-white/5 bg-white/[0.015] hover:bg-white/[0.03] transition-colors">
              <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.25fr_1fr_1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="text-[16px] font-medium text-white mb-1">{lead.nome}</p>
                  <p className="text-[13px] font-light text-white/50">{lead.telefone || "Sem telefone"} · {lead.cidade || "Cidade não informada"}</p>
                  {lastActivity ? <p className="mt-2 text-[11px] text-white/30">{lastActivity.action} · {formatDateTime(lastActivity.createdAt)}</p> : null}
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-white">{lead.curso_de_interesse}</p>
                  <p className="mt-1 text-[12px] font-light text-white/50">{lead.origem} · {lead.responsavel}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] uppercase tracking-widest text-white/50">{lead.status_funil}</Badge>
                  <Badge variant={lead.status_matricula === "Matriculado" ? "success" : "gold"} className="text-[10px] uppercase tracking-widest">{lead.status_matricula}</Badge>
                  {attention ? <Badge variant={attention.variant} className="text-[10px] uppercase tracking-widest">{attention.label}</Badge> : null}
                </div>
                <div className="flex flex-wrap gap-3 lg:justify-end">
                  <Button size="sm" className="rounded-full px-6" onClick={() => onOpen(lead.id)}>Abrir</Button>
                  {canEdit ? <Button size="sm" variant="outline" className="rounded-full border-white/10 hover:bg-white/5 px-6" onClick={() => onEdit(lead)}>Editar</Button> : null}
                </div>
              </CardContent>
            </Card>
          );
        }) : <EmptyState text="Nenhum lead encontrado." />}
      </div>
    </div>
  );
}
