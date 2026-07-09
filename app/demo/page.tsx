"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dashboard } from "@/components/crm/dashboard";
import { ScorePill } from "@/features/app-shell/components/page-primitives";
import { Kanban } from "@/features/kanban/components/kanban-board";
import { badgeVariantForFunnelStatus } from "@/features/dashboard/lib/dashboard-utils";
import {
  buildTrend,
  computeLeadScore,
  formatDate,
  getLeadTrackedOriginLabel,
  groupCount,
  seedState,
  toChartData,
  withinPeriod,
  type FunnelStatus,
  type Lead,
  type Period,
} from "@/lib/crm";

const WHATSAPP_SALES_LINK = "https://wa.me/SEU_NUMERO_AQUI";

function useDemoState() {
  const [initial] = React.useState(() => seedState());
  const [leads, setLeads] = React.useState<Lead[]>(initial.leads);
  const [period, setPeriod] = React.useState<Period>("month");

  const moveLead = React.useCallback((id: string, status: FunnelStatus) => {
    setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, status_funil: status } : lead)));
  }, []);

  const dashboardProps = React.useMemo(() => {
    const periodLeads = leads.filter((lead) => withinPeriod(lead.data_entrada, period));
    const confirmedEnrollments = periodLeads.filter((lead) =>
      ["Pagamento confirmado", "Matriculado"].includes(lead.status_matricula)
    );
    const conversion = periodLeads.length ? Math.round((confirmedEnrollments.length / periodLeads.length) * 100) : 0;
    const trendData = buildTrend(periodLeads, initial.tasks, period);
    const courseData = toChartData(groupCount(periodLeads, "curso_de_interesse"));
    const originData = toChartData(
      periodLeads.reduce<Record<string, number>>((acc, lead) => {
        const key = getLeadTrackedOriginLabel(lead);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    );
    const periodTasks = initial.tasks.filter((task) => withinPeriod(task.dueDate, period));
    const taskOwnerData = toChartData(groupCount(periodTasks.filter((task) => !task.done), "owner"));
    const pendingTaskItems = initial.tasks.filter((task) => !task.done);

    return {
      period,
      setPeriod,
      periodLeads,
      newLeads: periodLeads.filter((lead) => lead.status_funil === "Novo Lead").length,
      waiting: periodLeads.filter((lead) => lead.status_funil === "Aguardando Retorno").length,
      overdue: leads.filter((lead) => lead.status_funil !== "Matriculado" && lead.proximo_contato < new Date().toISOString().slice(0, 10)).length,
      confirmed: confirmedEnrollments.length,
      conversion,
      trendData,
      courseData,
      originData,
      taskOwnerData,
      pendingTasks: pendingTaskItems.length,
      pendingTaskItems,
      allLeads: leads,
    };
  }, [leads, period, initial.tasks]);

  return { leads, moveLead, dashboardProps };
}

function DemoLeadCard({ lead }: { lead: Lead }) {
  const score = computeLeadScore(lead);

  return (
    <div
      draggable
      onDragStart={(event) => event.dataTransfer.setData("lead-id", lead.id)}
      className="cursor-grab rounded-2xl border border-border bg-background p-4 active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{lead.nome}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{lead.curso_de_interesse}</p>
        </div>
        {score ? <ScorePill score={score} /> : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Badge variant={badgeVariantForFunnelStatus(lead.status_funil)} className="text-[10px] uppercase tracking-widest">
          {lead.status_funil}
        </Badge>
        <span className="text-[11px] text-muted-foreground">{lead.responsavel}</span>
      </div>
      {lead.proximo_contato ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Próximo contato: {formatDate(lead.proximo_contato)}</p>
      ) : null}
    </div>
  );
}

export default function DemoPage() {
  const { leads, moveLead, dashboardProps } = useDemoState();
  const [tab, setTab] = React.useState<"dashboard" | "pipeline">("pipeline");

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-primary/10 px-6 py-3">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Modo demonstração</span>
            <span className="text-muted-foreground">— dados fictícios, nada aqui é salvo.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao site
              </Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <a href={WHATSAPP_SALES_LINK} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                Falar com vendas
              </a>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-light tracking-wide text-foreground">Base CRM — demonstração</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore o painel comercial e arraste os leads pelo funil como sua equipe faria no dia a dia.
            </p>
          </div>
          <div className="inline-flex items-center gap-1 self-start rounded-full border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setTab("dashboard")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${tab === "dashboard" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Painel Comercial
            </button>
            <button
              type="button"
              onClick={() => setTab("pipeline")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${tab === "pipeline" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Pipeline (Kanban)
            </button>
          </div>
        </div>

        {tab === "dashboard" ? (
          <Dashboard {...dashboardProps} showTodayAppointments={false} />
        ) : (
          <Kanban leads={leads} onMove={moveLead} renderLeadCard={(lead) => <DemoLeadCard lead={lead} />} />
        )}
      </div>
    </div>
  );
}
