"use client";

import { Area, AreaChart, CartesianGrid, Cell, Line, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Activity, BarChart3, Bell, BookOpen, CalendarClock, CheckCircle2, CircleDollarSign, Download, ListChecks, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CourseLeadChart } from "@/features/dashboard/components/dashboard-course-chart";
import { ActiveOriginShape, ChartMarker, MetricCard, OriginTooltipContent } from "@/features/dashboard/components/dashboard-primitives";
import { TaskOwnerChart } from "@/features/dashboard/components/dashboard-task-owner-chart";
import { useDashboardView } from "@/features/dashboard/hooks/use-dashboard-view";
import { dashboardChartConfig, type DashboardProps } from "@/features/dashboard/lib/dashboard-types";
import { snowChartColors } from "@/features/dashboard/lib/dashboard-utils";
import { motion } from "framer-motion";

const InteractivePie = Pie as unknown as React.ComponentType<Record<string, unknown>>;

export function Dashboard({
  period, setPeriod, periodLeads, newLeads, waiting, overdue, confirmed, conversion, trendData, courseData, originData, taskOwnerData, pendingTasks, pendingTaskItems, allLeads,
}: DashboardProps) {
  const { state, actions } = useDashboardView({ originData, courseData, taskOwnerData, periodLeads, pendingTaskItems, allLeads, trendData });

  return (
    <div className="space-y-8">
      {/* Top Banner (Sleek Glass Row) */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-wide text-white">Painel Comercial</h1>
          <p className="mt-2 text-[13px] font-light text-white/40">Acompanhe captação, conversão, retornos e tarefas operacionais.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white/[0.015] border border-white/5 p-2 rounded-full backdrop-blur-md">
           {["day", "week", "month"].map((p) => {
             const label = p === "day" ? "Dia" : p === "week" ? "Semana" : "Mês";
             const isActive = period === p;
             return (
               <button key={p} onClick={() => setPeriod(p as "day"|"week"|"month")} className="relative px-6 py-2 text-[12px] font-bold uppercase tracking-widest transition-colors duration-300">
                 {isActive && <motion.div layoutId="period-pill" className="absolute inset-0 bg-primary/20 border border-primary/30 rounded-full shadow-[0_0_15px_rgba(219,13,113,0.3)]" />}
                 <span className={`relative z-10 ${isActive ? "text-primary drop-shadow-[0_0_5px_rgba(219,13,113,0.8)]" : "text-white/40 hover:text-white"}`}>{label}</span>
               </button>
             );
           })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Leads no período" value={periodLeads.length} icon={UsersRound} tone="blue" />
        <MetricCard label="Novos leads" value={newLeads} icon={UserRound} tone="violet" />
        <MetricCard label="Aguardando retorno" value={waiting} icon={CalendarClock} tone="blue" />
        <MetricCard label="Retornos atrasados" value={overdue} icon={Bell} tone="danger" />
        <MetricCard label="Matrículas confirmadas" value={confirmed} icon={CheckCircle2} tone="success" />
        <MetricCard label={`Taxa de conversão`} value={`${conversion}%`} icon={CircleDollarSign} tone="violet" />
        <MetricCard label="Tarefas pendentes" value={pendingTasks} icon={ListChecks} tone="blue" />
        <MetricCard label="Cursos em demanda" value={courseData.length} icon={BookOpen} tone="gold" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="rounded-[32px] overflow-hidden border border-white/5 bg-white/[0.015] backdrop-blur-[24px]">
          <CardHeader className="border-b border-white/5 bg-white/[0.01] px-8 py-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-xl font-light tracking-wide text-white">Analytics do Funil</CardTitle>
                <CardDescription className="text-white/40">Leads, matrículas e tarefas ativas.</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                 <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-[11px] font-bold tracking-widest uppercase text-emerald-400">+{conversion}% CV</span>
                 <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[11px] font-bold tracking-widest uppercase text-white/50">All Time High</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <ChartContainer config={dashboardChartConfig} className="h-[360px] w-full">
              <AreaChart accessibilityLayer data={trendData} margin={{ left: 12, right: 26, top: 34, bottom: 8 }}>
                <defs>
                  <linearGradient id="leadsGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="75%" stopColor="var(--chart-1)" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="matriculasGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                    <stop offset="80%" stopColor="var(--chart-2)" stopOpacity={0.01} />
                  </linearGradient>
                  <filter id="neonDropShadow" x="-20%" y="-20%" width="140%" height="140%">
                     <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="var(--chart-1)" floodOpacity="0.4"/>
                  </filter>
                  <filter id="neonDropShadow2" x="-20%" y="-20%" width="140%" height="140%">
                     <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="var(--chart-2)" floodOpacity="0.4"/>
                  </filter>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={16} tick={{ fill: "#ffffff", opacity: 0.4, fontSize: 11, fontWeight: 700 }} />
                <YAxis width={40} tickLine={false} axisLine={false} allowDecimals={false} tickMargin={10} tick={{ fill: "#ffffff", opacity: 0.4, fontSize: 11, fontWeight: 700 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="leads" stroke="var(--color-leads)" strokeWidth={4} fill="url(#leadsGlow)" dot={false} activeDot={{ r: 6, strokeWidth: 3, stroke: "#fff" }} animationDuration={420} filter="url(#neonDropShadow)" />
                <Area type="monotone" dataKey="matriculas" stroke="var(--color-matriculas)" strokeWidth={3} fill="url(#matriculasGlow)" dot={false} activeDot={{ r: 5, strokeWidth: 3, stroke: "#fff" }} animationDuration={420} filter="url(#neonDropShadow2)" />
                <Line type="monotone" dataKey="tarefas" stroke="var(--color-tarefas)" strokeWidth={2.5} strokeDasharray="6 6" dot={{ r: 3 }} animationDuration={420} />
                {state.chartMarkers.map((marker) => <ChartMarker key={`${marker.dataKey}-${marker.x}`} marker={marker} />)}
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="rounded-[32px] overflow-hidden border border-white/5 bg-white/[0.015] backdrop-blur-[24px]">
          <CardHeader className="border-b border-white/5 bg-white/[0.01] px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-light tracking-wide text-white">Canais de Aquisição</CardTitle>
                <CardDescription className="text-white/40">Fatia de volume por canal.</CardDescription>
              </div>
              <span className="rounded-full bg-white/5 border border-white/10 px-4 py-1 text-[11px] font-bold tracking-widest text-white/50">{periodLeads.length} leads</span>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
              <ChartContainer config={{ value: { label: "Leads", color: "var(--chart-2)" } }} className="h-[280px] w-full filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
                <PieChart>
                  <ChartTooltip content={<OriginTooltipContent total={periodLeads.length} />} />
                  <InteractivePie
                    activeIndex={state.selectedOriginIndex >= 0 ? state.selectedOriginIndex : undefined}
                    activeShape={ActiveOriginShape}
                    data={originData} dataKey="value" nameKey="name" innerRadius={72} outerRadius={100} paddingAngle={4} cornerRadius={8} animationDuration={240}
                    onClick={(_data: unknown, index: number) => actions.setSelectedOrigin((c) => c === originData[index]?.name ? null : (originData[index]?.name ?? null))}
                  >
                    {originData.map((entry, index) => <Cell key={entry.name} fill={snowChartColors[index % snowChartColors.length]} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />)}
                  </InteractivePie>
                </PieChart>
              </ChartContainer>

              <div className="rounded-[24px] border border-white/5 bg-white/[0.02] p-6">
                {state.selectedOrigin ? (
                  <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">Canal Selecionado</p>
                    <p className="text-[20px] font-light text-white mb-6">{state.selectedOrigin}</p>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center"><span className="text-[12px] font-light text-white/50">Volume</span> <span className="text-[14px] font-medium text-white">{state.selectedOriginValue}</span></div>
                      <div className="flex justify-between items-center"><span className="text-[12px] font-light text-white/50">Fatia</span> <span className="text-[14px] font-medium text-white">{state.selectedOriginShare}%</span></div>
                      <div className="flex justify-between items-center"><span className="text-[12px] font-light text-white/50">Curso Top</span> <span className="text-[12px] font-medium text-white max-w-[100px] truncate text-right">{state.selectedOriginCourses[0]?.[0] || "-"}</span></div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-4 px-2">Top 6 Origens</p>
                    {originData.slice(0, 6).map((item, index) => {
                      const share = periodLeads.length ? Math.round((item.value / periodLeads.length) * 100) : 0;
                      return (
                        <button key={item.name} onClick={() => actions.setSelectedOrigin(item.name)} className="flex w-full items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors">
                          <span className="flex items-center gap-3 min-w-0">
                            <span className="h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ background: snowChartColors[index % snowChartColors.length], color: snowChartColors[index % snowChartColors.length] }} />
                            <span className="text-[12px] font-medium text-white/70 truncate">{item.name}</span>
                          </span>
                          <span className="text-[11px] font-bold text-white/30">{share}%</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CourseLeadChart title="Leads por curso" description="Cursos com maior demanda comercial." data={courseData} selectedCourse={state.selectedCourse} onSelectCourse={actions.setSelectedCourse} leads={state.selectedCourseLeads} />
        <TaskOwnerChart title="Tarefas pendentes por responsável" description="Carga operacional de follow-up." data={taskOwnerData} selectedOwner={state.selectedTaskOwner} onSelectOwner={actions.setSelectedTaskOwner} tasks={state.selectedOwnerTasks} leadNameById={state.leadNameById} />
      </div>
    </div>
  );
}
