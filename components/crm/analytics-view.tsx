"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Bot, CalendarRange, LoaderCircle, MessageCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterSelect } from "@/features/app-shell/components/page-primitives";
import { AnalyticsMetricCard, CaseTag, DateField, EmptyPanel, MiniDistribution } from "@/features/analytics/components/analytics-primitives";
import { useAnalyticsView } from "@/features/analytics/hooks/use-analytics-view";
import { formatDays, formatDelta, formatHours, formatPercent, formatRangeLabel } from "@/features/analytics/lib/analytics-metrics";
import { funnelStatusOptions, type AnalyticsPeriodMode, type AnalyticsViewProps } from "@/features/analytics/lib/analytics-types";
import { chartPalette, formatDate } from "@/lib/crm";

type WorkspaceView = "overview" | "pipeline" | "team" | "risks";
type TrendMode = "activity" | "outcomes";
type OriginChartMode = "bar" | "pie";
type PipelineMetric = "volume" | "stalled" | "days";
type TeamMetric = "portfolio" | "conversion" | "overdue";
type TeamTrendMetric = "conversionDelta" | "portfolioDelta" | "overdueDelta";

const trendConfig = {
  conversations: { label: "Conversas", color: chartPalette[0] },
  messages: { label: "Mensagens", color: chartPalette[1] },
  inbound: { label: "Recebidas", color: chartPalette[3] },
  wins: { label: "Ganhos", color: "#16a34a" },
  losses: { label: "Perdidos", color: "#dc2626" },
};

const originConfig = {
  leads: { label: "Leads", color: chartPalette[0] },
  conversion: { label: "Conversão %", color: chartPalette[1] },
  loss: { label: "Perda %", color: "#dc2626" },
};

const pipelineConfig = {
  total: { label: "Leads", color: chartPalette[0] },
  stalled: { label: "Parados", color: "#dc2626" },
  days: { label: "Dias médios", color: chartPalette[1] },
};

const teamConfig = {
  portfolio: { label: "Carteira", color: chartPalette[0] },
  conversion: { label: "Conversão %", color: chartPalette[1] },
  overdue: { label: "Follow-ups atrasados", color: "#dc2626" },
};

const teamTrendConfig = {
  conversionDelta: { label: "Variacao de conversao", color: chartPalette[1] },
  portfolioDelta: { label: "Variacao de carteira", color: chartPalette[0] },
  overdueDelta: { label: "Variacao de atrasos", color: "#dc2626" },
};

const originChartMetricsConfig = {
  leadCount: { label: "Leads", color: chartPalette[0] },
  conversionPct: { label: "Conversao %", color: chartPalette[1] },
  lossPct: { label: "Perda %", color: "#dc2626" },
};

export function AnalyticsView({ leads, tasks, onOpenConversation, onOpenLead }: AnalyticsViewProps) {
  const { state, actions } = useAnalyticsView({ leads, tasks });
  const [workspaceView, setWorkspaceView] = React.useState<WorkspaceView>("overview");
  const [showExtendedMetrics, setShowExtendedMetrics] = React.useState(false);
  const [trendMode, setTrendMode] = React.useState<TrendMode>("activity");
  const [originChartMode, setOriginChartMode] = React.useState<OriginChartMode>("bar");
  const [pipelineMetric, setPipelineMetric] = React.useState<PipelineMetric>("volume");
  const [teamMetric, setTeamMetric] = React.useState<TeamMetric>("portfolio");
  const [teamTrendMetric, setTeamTrendMetric] = React.useState<TeamTrendMetric>("conversionDelta");

  const visibleMetrics = showExtendedMetrics ? state.analytics.metrics : state.analytics.metrics.slice(0, 5);
  const comparisonData = React.useMemo(() => state.analytics.periodComparisons.slice(0, 5), [state.analytics.periodComparisons]);

  const trendData = React.useMemo(
    () =>
      state.analytics.trend.map((point) => ({
        label: point.label,
        conversations: point.conversas,
        messages: point.mensagens,
        inbound: point.recebidas,
        wins: point.ganhos,
        losses: point.perdidos,
      })),
    [state.analytics.trend]
  );

  const originData = React.useMemo(
    () =>
      [...state.analytics.originPerformance]
        .sort((a, b) => {
          if (b.leadCount !== a.leadCount) return b.leadCount - a.leadCount;
          if (b.conversionRate !== a.conversionRate) return b.conversionRate - a.conversionRate;
          return a.lossRate - b.lossRate;
        })
        .slice(0, 6)
        .map((item, index) => ({
          ...item,
          conversionPct: Math.round(item.conversionRate * 100),
          lossPct: Math.round(item.lossRate * 100),
          color: chartPalette[index % chartPalette.length],
        })),
    [state.analytics.originPerformance]
  );

  const pipelineData = React.useMemo(
    () =>
      state.analytics.funnelConversions.map((item) => ({
        status: item.status,
        total: item.total,
        stalled: item.stalled,
        days: Math.round(item.averageDaysInStage),
        shareLabel: formatPercent(item.share),
      })),
    [state.analytics.funnelConversions]
  );

  const teamData = React.useMemo(
    () =>
      state.analytics.ownerPerformance.map((item, index) => ({
        ...item,
        conversionPct: Math.round(item.conversionRate * 100),
        color: chartPalette[index % chartPalette.length],
      })),
    [state.analytics.ownerPerformance]
  );

  const teamTrendData = React.useMemo(
    () =>
      state.analytics.ownerTrends.slice(0, 6).map((item, index) => ({
        ...item,
        conversionDeltaPct: Math.round(item.conversionDelta * 100),
        color: chartPalette[index % chartPalette.length],
      })),
    [state.analytics.ownerTrends]
  );

  const [selectedOrigin, setSelectedOrigin] = React.useState<string | null>(null);
  const [selectedOwner, setSelectedOwner] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!originData.length) {
      setSelectedOrigin(null);
      return;
    }
    if (!selectedOrigin || !originData.some((item) => item.origin === selectedOrigin)) {
      setSelectedOrigin(originData[0].origin);
    }
  }, [originData, selectedOrigin]);

  React.useEffect(() => {
    if (!teamData.length) {
      setSelectedOwner(null);
      return;
    }
    if (!selectedOwner || !teamData.some((item) => item.owner === selectedOwner)) {
      setSelectedOwner(teamData[0].owner);
    }
  }, [selectedOwner, teamData]);

  const activeOrigin = originData.find((item) => item.origin === selectedOrigin) ?? null;
  const activeOwner = teamData.find((item) => item.owner === selectedOwner) ?? null;
  const activeOwnerTrend = teamTrendData.find((item) => item.owner === selectedOwner) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Analytics comercial</h2>
          <p className="text-sm text-muted-foreground">
            Um painel desenhado para leitura rápida, correlação clara entre os dados e decisões mais seguras do time.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <Tabs value={state.periodMode} onValueChange={(value) => actions.setPeriodMode(value as AnalyticsPeriodMode)}>
            <TabsList className="bg-white/[0.02] border border-white/5 rounded-full p-1 h-auto">
              <TabsTrigger className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-[0_0_15px_rgba(219,13,113,0.3)] text-white/50 px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider" value="day">Dia</TabsTrigger>
              <TabsTrigger className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-[0_0_15px_rgba(219,13,113,0.3)] text-white/50 px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider" value="week">Semana</TabsTrigger>
              <TabsTrigger className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-[0_0_15px_rgba(219,13,113,0.3)] text-white/50 px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider" value="month">Mês</TabsTrigger>
              <TabsTrigger className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-[0_0_15px_rgba(219,13,113,0.3)] text-white/50 px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider" value="year">Ano</TabsTrigger>
              <TabsTrigger className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-[0_0_15px_rgba(219,13,113,0.3)] text-white/50 px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider" value="custom">Personalizado</TabsTrigger>
            </TabsList>
          </Tabs>
          {state.snapshotUpdatedAt ? (
            <p className="text-xs text-muted-foreground">
              Snapshot atualizado em {new Date(state.snapshotUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          ) : null}
        </div>
      </div>

      <Card className="rounded-2xl border border-white/5 bg-white/[0.015] backdrop-blur-[24px] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)]">
        <CardContent className="grid gap-3 p-4">
          <div className="grid gap-3 xl:grid-cols-4">
            <FilterSelect value={state.courseFilter} onValueChange={actions.setCourseFilter} options={state.filterOptions.courses} placeholder="Todos os cursos" />
            <FilterSelect value={state.originFilter} onValueChange={actions.setOriginFilter} options={state.filterOptions.origins} placeholder="Todas as origens" />
            <FilterSelect value={state.ownerFilter} onValueChange={actions.setOwnerFilter} options={state.filterOptions.owners} placeholder="Todos os responsáveis" />
            <FilterSelect
              value={state.statusFilter}
              onValueChange={(value) => actions.setStatusFilter(value as "all" | typeof funnelStatusOptions[number])}
              options={funnelStatusOptions}
              placeholder="Todos os status"
            />
          </div>

          {state.periodMode === "custom" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[220px_220px_1fr]">
              <DateField label="Data inicial" value={state.customRange.start} onChange={(value) => actions.setCustomRange((current) => ({ ...current, start: value }))} />
              <DateField label="Data final" value={state.customRange.end} onChange={(value) => actions.setCustomRange((current) => ({ ...current, end: value }))} />
              <div className="flex items-end">
                <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <CalendarRange className="h-4 w-4" />
                  {formatRangeLabel(state.currentRange)}
                </div>
              </div>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm text-muted-foreground">
              <CalendarRange className="h-4 w-4" />
              {formatRangeLabel(state.currentRange)}
            </div>
          )}
        </CardContent>
      </Card>

      {state.loadingMessages ? (
        <div className="grid min-h-[220px] place-items-center rounded-xl border bg-white/[0.015] backdrop-blur-[24px]">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando dados de conversas para analytics...
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {visibleMetrics.map((metric) => (
          <AnalyticsMetricCard key={metric.key} metric={metric} />
        ))}
      </div>

      <Card className="rounded-2xl border border-white/5 bg-white/[0.015] backdrop-blur-[24px] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)]">
        <CardHeader>
          <CardTitle>Comparativo do periodo</CardTitle>
          <CardDescription>Leitura lado a lado do recorte atual contra o periodo anterior, para entender mudancas de ritmo sem sair do topo do painel.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-5">
          {comparisonData.map((item) => {
            const positive = item.delta > 0;
            const effectiveGood = item.trendGood === "up" ? positive : item.trendGood === "down" ? item.delta < 0 : false;
            return (
              <div key={item.key} className="rounded-xl border bg-white/[0.015] backdrop-blur-[24px] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-normal">
                      {item.formatter ? item.formatter(item.current) : item.current}
                    </p>
                  </div>
                  <Badge variant={item.delta === 0 ? "outline" : effectiveGood ? "success" : "danger"}>
                    {item.delta === 0 ? "Estavel" : formatDelta(item.delta, item.formatter)}
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Periodo anterior: {item.formatter ? item.formatter(item.previous) : item.previous}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {state.analytics.executiveAlerts.length ? (
        <Card className="rounded-2xl border border-white/5 bg-white/[0.015] backdrop-blur-[24px] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)]">
          <CardHeader>
            <CardTitle>Alertas executivos</CardTitle>
            <CardDescription>Os sinais mais importantes do recorte atual para ação rápida da gestão.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 xl:grid-cols-2">
            {state.analytics.executiveAlerts.map((alert) => (
              <div
                key={alert.id}
                className={
                  alert.severity === "danger"
                    ? "rounded-xl border border-destructive/30 bg-destructive/10 p-4"
                    : alert.severity === "warning"
                      ? "rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
                      : "rounded-xl border bg-white/[0.015] backdrop-blur-[24px] p-4"
                }
              >
                <div className="flex items-center gap-2">
                  <Badge variant={alert.severity === "danger" ? "danger" : alert.severity === "warning" ? "gold" : "outline"}>
                    {alert.severity === "danger" ? "Crítico" : alert.severity === "warning" ? "Atenção" : "Observação"}
                  </Badge>
                  <p className="text-sm font-semibold">{alert.title}</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{alert.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 rounded-full border border-white/5 bg-white/[0.015] backdrop-blur-[24px] p-2 px-4 lg:flex-row lg:items-center lg:justify-between shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)]">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={workspaceView === "overview" ? "default" : "ghost"} className={workspaceView === "overview" ? "rounded-full shadow-[0_0_15px_rgba(219,13,113,0.3)] bg-primary" : "rounded-full text-white/50 hover:bg-white/5 hover:text-white"} size="sm" onClick={() => setWorkspaceView("overview")}>
            Visão geral
          </Button>
          <Button type="button" variant={workspaceView === "pipeline" ? "default" : "ghost"} className={workspaceView === "pipeline" ? "rounded-full shadow-[0_0_15px_rgba(219,13,113,0.3)] bg-primary" : "rounded-full text-white/50 hover:bg-white/5 hover:text-white"} size="sm" onClick={() => setWorkspaceView("pipeline")}>
            Pipeline
          </Button>
          <Button type="button" variant={workspaceView === "team" ? "default" : "ghost"} className={workspaceView === "team" ? "rounded-full shadow-[0_0_15px_rgba(219,13,113,0.3)] bg-primary" : "rounded-full text-white/50 hover:bg-white/5 hover:text-white"} size="sm" onClick={() => setWorkspaceView("team")}>
            Equipe
          </Button>
          <Button type="button" variant={workspaceView === "risks" ? "default" : "ghost"} className={workspaceView === "risks" ? "rounded-full shadow-[0_0_15px_rgba(219,13,113,0.3)] bg-primary" : "rounded-full text-white/50 hover:bg-white/5 hover:text-white"} size="sm" onClick={() => setWorkspaceView("risks")}>
            Riscos
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{state.analytics.pendingResponseItems.length} sem resposta</Badge>
          <Badge variant="outline">{state.analytics.stalledLeadItems.length} estagnados</Badge>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowExtendedMetrics((current) => !current)}>
            {showExtendedMetrics ? "Mostrar menos indicadores" : "Mostrar todos os indicadores"}
          </Button>
        </div>
      </div>

      <div
        key={workspaceView}
        className="animate-in fade-in duration-300"
      >
          {workspaceView === "overview" ? (
        <div className="grid gap-4 xl:grid-cols-[1.55fr_0.95fr]">
          <div className="space-y-4">
            <Card className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.015] backdrop-blur-[24px] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)]">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle>Evolução do período</CardTitle>
                    <CardDescription>Leitura temporal para acompanhar atividade e resultado sem perder o contexto do recorte.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant={trendMode === "activity" ? "default" : "outline"} onClick={() => setTrendMode("activity")}>
                      Atividade
                    </Button>
                    <Button type="button" size="sm" variant={trendMode === "outcomes" ? "default" : "outline"} onClick={() => setTrendMode("outcomes")}>
                      Resultado
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer config={trendConfig} className="h-[360px] w-full">
                  <AreaChart data={trendData} margin={{ left: 10, right: 10, top: 18, bottom: 4 }}>
                    <defs>
                      <linearGradient id="trendActivityFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-conversations)" stopOpacity={0.24} />
                        <stop offset="100%" stopColor="var(--color-conversations)" stopOpacity={0.03} />
                      </linearGradient>
                      <linearGradient id="trendOutcomeFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-wins)" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="var(--color-wins)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeOpacity={1} />
                    <XAxis dataKey="label" stroke="rgba(255,255,255,0.3)" tick={{fill: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 300}} axisLine={{stroke: "rgba(255,255,255,0.05)"}} tickLine={false} />
                    <YAxis allowDecimals={false} width={34} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)" }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    {trendMode === "activity" ? (
                      <>
                        <Area type="monotone" dataKey="conversations" stroke="var(--color-conversations)" fill="url(#trendActivityFill)" strokeWidth={3} />
                        <Line type="monotone" dataKey="messages" stroke="var(--color-messages)" strokeWidth={2.4} dot={false} />
                        <Line type="monotone" dataKey="inbound" stroke="var(--color-inbound)" strokeWidth={2.1} dot={false} />
                      </>
                    ) : (
                      <>
                        <Area type="monotone" dataKey="wins" stroke="var(--color-wins)" fill="url(#trendOutcomeFill)" strokeWidth={3} />
                        <Line type="monotone" dataKey="losses" stroke="var(--color-losses)" strokeWidth={2.4} dot={false} />
                      </>
                    )}
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.015] backdrop-blur-[24px] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)]">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle>Origens e conversão</CardTitle>
                    <CardDescription>Compare volume e qualidade das origens e clique para aprofundar o recorte.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant={originChartMode === "bar" ? "default" : "outline"} onClick={() => setOriginChartMode("bar")}>
                      Barras
                    </Button>
                    <Button type="button" size="sm" variant={originChartMode === "pie" ? "default" : "outline"} onClick={() => setOriginChartMode("pie")}>
                      Pizza
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <ChartContainer config={originChartMetricsConfig} className="h-[320px] w-full">
                  {originChartMode === "bar" ? (
                    <ComposedChart data={originData} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeOpacity={1} />
                      <XAxis dataKey="origin" stroke="rgba(255,255,255,0.3)" tick={{fill: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 300}} axisLine={{stroke: "rgba(255,255,255,0.05)"}} tickLine={false} />
                      <YAxis yAxisId="count" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)" }} />
                      <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)" }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar yAxisId="count" dataKey="leadCount" radius={[8, 8, 0, 0]} onClick={(_, index) => setSelectedOrigin(originData[index]?.origin ?? null)}>
                        {originData.map((entry) => (
                          <Cell key={entry.origin} fill={entry.color} opacity={selectedOrigin === entry.origin ? 1 : 0.7} />
                        ))}
                      </Bar>
                      <Line yAxisId="rate" type="monotone" dataKey="conversionPct" stroke="var(--color-conversionPct)" strokeWidth={2.4} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Line yAxisId="rate" type="monotone" dataKey="lossPct" stroke="var(--color-lossPct)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                    </ComposedChart>
                  ) : (
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie
                        data={originData}
                        dataKey="leadCount"
                        nameKey="origin"
                        innerRadius={58}
                        outerRadius={104}
                        paddingAngle={3}
                        onClick={(_, index) => setSelectedOrigin(originData[index]?.origin ?? null)}
                      >
                        {originData.map((entry) => (
                          <Cell key={entry.origin} fill={entry.color} opacity={selectedOrigin === entry.origin ? 1 : 0.75} />
                        ))}
                      </Pie>
                    </PieChart>
                  )}
                </ChartContainer>

                <Card className="border bg-white/[0.015] backdrop-blur-[24px] shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Origem em foco</CardTitle>
                    <CardDescription>Detalhamento da origem selecionada no gráfico.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {activeOrigin ? (
                      <>
                      <div>
                        <p className="text-base font-semibold">{activeOrigin.origin}</p>
                        <p className="text-sm text-muted-foreground">{activeOrigin.leadCount} lead(s) no recorte atual.</p>
                        <p className="mt-1 text-xs text-muted-foreground">Campanha principal: {activeOrigin.topCampaign || "Sem campanha"}</p>
                      </div>
                        <div className="flex flex-wrap gap-2">
                          <CaseTag variant="gold" label="Conversão" value={`${activeOrigin.conversionPct}%`} />
                          <CaseTag variant={activeOrigin.lossPct >= 40 ? "danger" : "outline"} label="Perda" value={`${activeOrigin.lossPct}%`} />
                          <CaseTag variant={activeOrigin.stalledLeads > 0 ? "danger" : "outline"} label="Parados" value={String(activeOrigin.stalledLeads)} />
                        </div>
                      <p className="text-sm text-muted-foreground">
                        {activeOrigin.wonLeads} ganho(s) e {activeOrigin.lostLeads} perdido(s). Use esta leitura para calibrar investimento, campanha e expectativa de qualidade.
                      </p>
                      </>
                    ) : (
                      <EmptyPanel compact text="Selecione uma origem no gráfico para ver o detalhamento." />
                    )}
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">


            <Card className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.015] backdrop-blur-[24px] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)]">
              <CardHeader>
                <CardTitle>Saúde do pipeline</CardTitle>
                <CardDescription>Leituras rápidas para entender de onde os leads vêm e em quais estágios se concentram.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <MiniDistribution title="Origem dos leads" items={state.analytics.topOrigins} />
                <MiniDistribution title="Status predominantes" items={state.analytics.topStatuses} />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {workspaceView === "pipeline" ? (
        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
          <Card className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.015] backdrop-blur-[24px] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)]">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle>Mapa do funil</CardTitle>
                  <CardDescription>Troque o foco entre volume, estagnação e tempo médio para entender onde o funil trava.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={pipelineMetric === "volume" ? "default" : "outline"} onClick={() => setPipelineMetric("volume")}>
                    Volume
                  </Button>
                  <Button type="button" size="sm" variant={pipelineMetric === "stalled" ? "default" : "outline"} onClick={() => setPipelineMetric("stalled")}>
                    Parados
                  </Button>
                  <Button type="button" size="sm" variant={pipelineMetric === "days" ? "default" : "outline"} onClick={() => setPipelineMetric("days")}>
                    Dias médios
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={pipelineConfig} className="h-[420px] w-full">
                <BarChart data={pipelineData} layout="vertical" margin={{ left: 12, right: 18, top: 8, bottom: 8 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeOpacity={1} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)" }} />
                  <YAxis type="category" dataKey="status" width={160} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey={pipelineMetric === "volume" ? "total" : pipelineMetric === "stalled" ? "stalled" : "days"}
                    radius={[0, 8, 8, 0]}
                    fill={
                      pipelineMetric === "volume"
                        ? "var(--color-total)"
                        : pipelineMetric === "stalled"
                          ? "var(--color-stalled)"
                          : "var(--color-days)"
                    }
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.015] backdrop-blur-[24px] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)]">
            <CardHeader>
              <CardTitle>Leitura das etapas</CardTitle>
              <CardDescription>Uma visão resumida da participação e do tempo em cada estágio do pipeline.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {state.analytics.funnelConversions.length ? (
                state.analytics.funnelConversions.map((item) => (
                  <div key={item.status} className="rounded-xl border bg-white/[0.015] backdrop-blur-[24px] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{item.status}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.total} lead(s) • {formatPercent(item.share)} da base filtrada
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <CaseTag variant="outline" label="Tempo" value={formatDays(item.averageDaysInStage)} />
                        <CaseTag variant={item.stalled > 0 ? "danger" : "outline"} label="Parados" value={String(item.stalled)} />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyPanel compact text="Sem leads suficientes para medir a conversão por etapa." />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {workspaceView === "team" ? (
        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
          <Card className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.015] backdrop-blur-[24px] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)]">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle>Performance por responsável</CardTitle>
                  <CardDescription>Troque a visão para comparar carteira, conversão e pressão de follow-up.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={teamMetric === "portfolio" ? "default" : "outline"} onClick={() => setTeamMetric("portfolio")}>
                    Carteira
                  </Button>
                  <Button type="button" size="sm" variant={teamMetric === "conversion" ? "default" : "outline"} onClick={() => setTeamMetric("conversion")}>
                    Conversão
                  </Button>
                  <Button type="button" size="sm" variant={teamMetric === "overdue" ? "default" : "outline"} onClick={() => setTeamMetric("overdue")}>
                    Atrasos
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <ChartContainer config={teamConfig} className="h-[340px] w-full">
                <BarChart data={teamData} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeOpacity={1} />
                  <XAxis dataKey="owner" stroke="rgba(255,255,255,0.3)" tick={{fill: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 300}} axisLine={{stroke: "rgba(255,255,255,0.05)"}} tickLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey={teamMetric === "portfolio" ? "leadCount" : teamMetric === "conversion" ? "conversionPct" : "overdueFollowUps"}
                    radius={[8, 8, 0, 0]}
                    onClick={(_, index) => setSelectedOwner(teamData[index]?.owner ?? null)}
                  >
                    {teamData.map((entry) => (
                      <Cell key={entry.owner} fill={entry.color} opacity={selectedOwner === entry.owner ? 1 : 0.72} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>

              <Card className="border bg-white/[0.015] backdrop-blur-[24px] shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Responsável em foco</CardTitle>
                  <CardDescription>Detalhamento do responsável selecionado no gráfico.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activeOwner ? (
                    <>
                      <div>
                        <p className="text-base font-semibold">{activeOwner.owner}</p>
                        <p className="text-sm text-muted-foreground">{activeOwner.leadCount} lead(s) no recorte atual.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <CaseTag variant="outline" label="Ativos" value={String(activeOwner.activeLeads)} />
                        <CaseTag variant={activeOwner.overdueFollowUps > 0 ? "danger" : "outline"} label="Atrasados" value={String(activeOwner.overdueFollowUps)} />
                        <CaseTag variant="gold" label="Conversão" value={formatPercent(activeOwner.conversionRate)} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {activeOwner.pendingTasks} tarefa(s) pendente(s) e tempo médio de resposta em {formatHours(activeOwner.averageResponseHours)}.
                      </p>
                    </>
                  ) : (
                    <EmptyPanel compact text="Selecione um responsável no gráfico para ver o detalhamento." />
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.015] backdrop-blur-[24px] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)]">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle>Tendencia por responsavel</CardTitle>
                  <CardDescription>Veja quem melhorou ou piorou no recorte atual sem sair da leitura de equipe.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={teamTrendMetric === "conversionDelta" ? "default" : "outline"} onClick={() => setTeamTrendMetric("conversionDelta")}>
                    Conversao
                  </Button>
                  <Button type="button" size="sm" variant={teamTrendMetric === "portfolioDelta" ? "default" : "outline"} onClick={() => setTeamTrendMetric("portfolioDelta")}>
                    Carteira
                  </Button>
                  <Button type="button" size="sm" variant={teamTrendMetric === "overdueDelta" ? "default" : "outline"} onClick={() => setTeamTrendMetric("overdueDelta")}>
                    Atrasos
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <ChartContainer config={teamTrendConfig} className="h-[280px] w-full">
                <BarChart data={teamTrendData} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeOpacity={1} />
                  <XAxis dataKey="owner" stroke="rgba(255,255,255,0.3)" tick={{fill: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 300}} axisLine={{stroke: "rgba(255,255,255,0.05)"}} tickLine={false} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey={teamTrendMetric === "conversionDelta" ? "conversionDeltaPct" : teamTrendMetric === "portfolioDelta" ? "portfolioDelta" : "overdueDelta"}
                    radius={[8, 8, 0, 0]}
                    onClick={(_, index) => setSelectedOwner(teamTrendData[index]?.owner ?? null)}
                  >
                    {teamTrendData.map((entry) => (
                      <Cell key={entry.owner} fill={entry.color} opacity={selectedOwner === entry.owner ? 1 : 0.72} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>

              <Card className="border bg-white/[0.015] backdrop-blur-[24px] shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Variacao em foco</CardTitle>
                  <CardDescription>Resumo do responsavel selecionado no grafico de tendencia.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activeOwnerTrend ? (
                    <>
                      <div>
                        <p className="text-base font-semibold">{activeOwnerTrend.owner}</p>
                        <p className="text-sm text-muted-foreground">
                          {activeOwnerTrend.momentum === "up"
                            ? "Momento de melhora no recorte atual."
                            : activeOwnerTrend.momentum === "down"
                              ? "Momento de pressao no recorte atual."
                              : "Momento estavel no recorte atual."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <CaseTag variant={activeOwnerTrend.portfolioDelta >= 0 ? "outline" : "gold"} label="Carteira" value={formatDelta(activeOwnerTrend.portfolioDelta)} />
                        <CaseTag variant={activeOwnerTrend.conversionDelta >= 0 ? "outline" : "danger"} label="Conversao" value={formatDelta(activeOwnerTrend.conversionDelta, formatPercent)} />
                        <CaseTag variant={activeOwnerTrend.overdueDelta <= 0 ? "outline" : "danger"} label="Atrasos" value={formatDelta(activeOwnerTrend.overdueDelta)} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Agora sao {activeOwnerTrend.currentLeadCount} lead(s) na carteira contra {activeOwnerTrend.previousLeadCount} no periodo anterior.
                      </p>
                    </>
                  ) : (
                    <EmptyPanel compact text="Selecione um responsavel para analisar a variacao do periodo." />
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.015] backdrop-blur-[24px] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)]">
            <CardHeader>
              <CardTitle>Maior atraso de follow-up</CardTitle>
              <CardDescription>Onde a cadência do time está demorando mais para sair do papel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {state.analytics.followUpLagItems.length ? (
                state.analytics.followUpLagItems.map((item) => (
                  <div
                    key={item.lead.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenLead(item.lead.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenLead(item.lead.id);
                      }
                    }}
                    className="rounded-xl border bg-white/[0.015] backdrop-blur-[24px] p-4 transition-colors hover:bg-white/[0.015] backdrop-blur-[24px] focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{item.lead.nome}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.lead.curso_de_interesse} • tarefa prevista para {formatDate(item.dueDate)}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">{item.reason}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <CaseTag variant="outline" label="Funil" value={item.lead.status_funil} />
                        <CaseTag variant={item.hours > 48 ? "danger" : "gold"} label="Atraso" value={formatHours(item.hours)} />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyPanel compact text="Nenhum atraso relevante de follow-up encontrado neste recorte." />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {workspaceView === "risks" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.015] backdrop-blur-[24px] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)]">
            <CardHeader>
              <CardTitle>Conversas sem resposta</CardTitle>
              <CardDescription>Últimas conversas cujo lead falou por último e ainda aguardam retorno.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {state.analytics.pendingResponseItems.length ? (
                state.analytics.pendingResponseItems.map((item) => {
                  const lastMessage = item.bundle.messages.at(-1);
                  return (
                    <div
                      key={item.bundle.conversation.id}
                      role={item.lead ? "button" : undefined}
                      tabIndex={item.lead ? 0 : -1}
                      onClick={() => item.lead && onOpenLead(item.lead.id)}
                      onKeyDown={(event) => {
                        if (!item.lead) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onOpenLead(item.lead.id);
                        }
                      }}
                      className="rounded-xl border bg-white/[0.015] backdrop-blur-[24px] p-4 transition-colors hover:bg-white/[0.015] backdrop-blur-[24px] focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{item.bundle.conversation.contactName}</p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">{lastMessage?.content || item.bundle.conversation.lastMessage}</p>
                          <p className="mt-2 text-xs text-muted-foreground">{item.reason}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <CaseTag variant="danger" label="Silêncio" value={formatHours(item.silenceHours)} />
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenConversation(item.bundle.conversation.leadId, item.bundle.conversation.id);
                            }}
                            aria-label={`Abrir conversa de ${item.bundle.conversation.contactName}`}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyPanel compact text="Nenhuma conversa sem resposta dentro do recorte atual." />
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.015] backdrop-blur-[24px] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)]">
            <CardHeader>
              <CardTitle>Leads estagnados</CardTitle>
              <CardDescription>Casos sem movimentação recente ou com follow-up vencido, para priorização da carteira.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {state.analytics.stalledLeadItems.length ? (
                state.analytics.stalledLeadItems.map((item) => (
                  <div
                    key={item.lead.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenLead(item.lead.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenLead(item.lead.id);
                      }
                    }}
                    className="rounded-xl border bg-white/[0.015] backdrop-blur-[24px] p-4 transition-colors hover:bg-white/[0.015] backdrop-blur-[24px] focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{item.lead.nome}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.lead.curso_de_interesse} • {item.lead.responsavel} • {item.lead.status_funil}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">{item.reason}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <CaseTag variant="outline" label="Sem mover" value={formatDays(item.daysWithoutMovement)} />
                        <CaseTag variant={item.overdueDays > 0 ? "danger" : "outline"} label="Vencido" value={formatDays(item.overdueDays)} />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyPanel compact text="Nenhum lead estagnado relevante neste recorte." />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
          </div>
    </div>
  );
}
