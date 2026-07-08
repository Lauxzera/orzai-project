"use client";

import { ArrowLeft } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatDate, taskOverdue, type Task } from "@/lib/crm";
import type { ChartPoint } from "@/features/dashboard/lib/dashboard-types";
import { compactLabel, snowChartColors } from "@/features/dashboard/lib/dashboard-utils";

export function TaskOwnerChart({
  title, description, data, selectedOwner, onSelectOwner, tasks, leadNameById,
}: {
  title: string; description: string; data: ChartPoint[]; selectedOwner: string | null; onSelectOwner: (owner: string | null) => void; tasks: Task[]; leadNameById: Record<string, string>;
}) {
  return (
    <Card className="rounded-[32px] overflow-hidden border border-border bg-card ">
      <CardHeader className="border-b border-border bg-card px-8 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-light tracking-wide text-white">{title}</CardTitle>
            <CardDescription className="text-white/40">{description}</CardDescription>
          </div>
          {selectedOwner ? (
            <Button variant="outline" size="sm" onClick={() => onSelectOwner(null)} className="rounded-full border-white/10 hover:bg-white/5 text-white/50 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-8">
        {selectedOwner ? (
          <div className="min-h-[300px] space-y-6">
            <div className="space-y-1">
              <p className="text-[18px] font-light text-white">{selectedOwner}</p>
              <p className="text-[12px] font-light text-white/40">{tasks.length} tarefa{tasks.length === 1 ? "" : "s"} pendente{tasks.length === 1 ? "" : "s"} neste recorte.</p>
            </div>

            {tasks.length ? (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="rounded-2xl border border-border bg-card p-5 hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-white mb-1">{task.title}</p>
                        <p className="text-[12px] font-light text-white/40">{leadNameById[task.leadId] || "Lead removido"}</p>
                      </div>
                      <Badge variant={taskOverdue(task) ? "danger" : "gold"} className="text-[10px] uppercase tracking-widest font-bold whitespace-nowrap">
                        {taskOverdue(task) ? "Atrasada" : formatDate(task.dueDate)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid min-h-[220px] place-items-center rounded-2xl border border-white/5 text-sm text-white/30">
                Nenhuma tarefa pendente para este responsável.
              </div>
            )}
          </div>
        ) : (
          <ChartContainer config={{ value: { label: "Total", color: "var(--chart-1)" } }} className="h-[300px] w-full">
            <BarChart accessibilityLayer data={data.slice(0, 8).map((item) => ({ ...item, shortName: compactLabel(item.name) }))} margin={{ left: 12, right: 12, top: 24, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" />
              <XAxis dataKey="shortName" tickLine={false} axisLine={false} tickMargin={14} tick={{ fill: "#ffffff", opacity: 0.4, fontSize: 11, fontWeight: 700 }} />
              <YAxis width={34} tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: "#ffffff", opacity: 0.4, fontSize: 11, fontWeight: 700 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={[6, 6, 6, 6]} barSize={28} animationDuration={420} onClick={(entry) => { const ownerName = typeof entry?.name === "string" ? entry.name : null; if (ownerName) onSelectOwner(ownerName); }} style={{ cursor: "pointer" }}>
                {data.slice(0, 8).map((entry, index) => <Cell key={entry.name} fill={snowChartColors[index % snowChartColors.length]} />)}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
