"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatDate, type Lead } from "@/lib/crm";
import type { ChartPoint } from "@/features/dashboard/lib/dashboard-types";
import { badgeVariantForFunnelStatus, compactLabel, isLateFollowUp, snowChartColors } from "@/features/dashboard/lib/dashboard-utils";

export function CourseLeadChart({
  title, description, data, selectedCourse, onSelectCourse, leads,
}: {
  title: string; description: string; data: ChartPoint[]; selectedCourse: string | null; onSelectCourse: (course: string | null) => void; leads: Lead[];
}) {
  const statusData = React.useMemo(() => Object.entries(leads.reduce<Record<string, number>>((acc, lead) => { acc[lead.status_funil] = (acc[lead.status_funil] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]), [leads]);
  const overdueCount = React.useMemo(() => leads.filter((lead) => !["Matriculado", "Perdido", "Reativar Futuramente"].includes(lead.status_funil) && isLateFollowUp(lead.proximo_contato)).length, [leads]);

  return (
    <Card className="rounded-[32px] overflow-hidden border border-border bg-card ">
      <CardHeader className="border-b border-border bg-card px-8 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-light tracking-wide text-white">{title}</CardTitle>
            <CardDescription className="text-white/40">{description}</CardDescription>
          </div>
          {selectedCourse ? (
            <Button variant="outline" size="sm" onClick={() => onSelectCourse(null)} className="rounded-full border-white/10 hover:bg-white/5 text-white/50 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-8">
        {selectedCourse ? (
          <div className="min-h-[300px] space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-primary/20 bg-primary/10 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70 mb-2">Leads no curso</p>
                <p className="text-[28px] font-light text-primary">{leads.length}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">Status Dominante</p>
                <p className="text-[16px] font-medium text-white">{statusData[0]?.[0] || "Sem dados"}</p>
              </div>
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-400/70 mb-2">Atrasados</p>
                <p className="text-[28px] font-light text-rose-400">{overdueCount}</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[18px] font-light text-white">{selectedCourse}</p>
              <div className="flex flex-wrap gap-2">
                {statusData.length ? statusData.map(([status, count]) => (
                  <Badge key={status} variant={badgeVariantForFunnelStatus(status)} className="px-3 py-1 font-bold tracking-widest text-[10px] uppercase">
                    {status} · {count}
                  </Badge>
                )) : <span className="text-white/30 text-[12px]">Nenhum lead neste recorte.</span>}
              </div>
            </div>

            {leads.length ? (
              <div className="space-y-3 mt-4">
                {leads.slice().sort((a, b) => a.proximo_contato.localeCompare(b.proximo_contato)).map((lead) => (
                  <div key={lead.id} className="rounded-2xl border border-border bg-card p-5 hover:bg-white/[0.04] transition-colors">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-white mb-1">{lead.nome}</p>
                        <p className="text-[12px] font-light text-white/40">{lead.origem} · {lead.responsavel}{lead.cidade ? ` · ${lead.cidade}` : ""}</p>
                        {lead.objecao_principal && <p className="text-[12px] text-rose-400/60 mt-1">Objeção: {lead.objecao_principal}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={badgeVariantForFunnelStatus(lead.status_funil)} className="text-[10px] uppercase tracking-widest">{lead.status_funil}</Badge>
                        <Badge variant={isLateFollowUp(lead.proximo_contato) ? "danger" : "gold"} className="text-[10px] uppercase tracking-widest">
                          {isLateFollowUp(lead.proximo_contato) ? "Atrasado" : formatDate(lead.proximo_contato)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <ChartContainer config={{ value: { label: "Total", color: "var(--chart-1)" } }} className="h-[300px] w-full">
            <BarChart accessibilityLayer data={data.slice(0, 8).map((item) => ({ ...item, shortName: compactLabel(item.name) }))} margin={{ left: 12, right: 12, top: 24, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" />
              <XAxis dataKey="shortName" tickLine={false} axisLine={false} tickMargin={14} tick={{ fill: "#ffffff", opacity: 0.4, fontSize: 11, fontWeight: 700 }} />
              <YAxis width={34} tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: "#ffffff", opacity: 0.4, fontSize: 11, fontWeight: 700 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={[6, 6, 6, 6]} barSize={28} animationDuration={420} onClick={(entry) => { const courseName = typeof entry?.name === "string" ? entry.name : null; if (courseName) onSelectCourse(courseName); }} style={{ cursor: "pointer" }}>
                {data.slice(0, 8).map((entry, index) => <Cell key={entry.name} fill={snowChartColors[index % snowChartColors.length]} />)}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
