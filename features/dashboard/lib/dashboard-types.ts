"use client";

import type { ChartConfig } from "@/components/ui/chart";
import type { Lead, Period, Task } from "@/lib/crm";

export type TrendPoint = {
  label: string;
  leads: number;
  matriculas: number;
  tarefas: number;
};

export type ChartPoint = {
  name: string;
  value: number;
};

export type PieTooltipPayload = {
  name?: string;
  value?: number;
  color?: string;
};

export type FloatingMarker = {
  dataKey: keyof TrendPoint;
  label: string;
  value: number;
  x: string;
  color: string;
};

export type DashboardProps = {
  period: Period;
  setPeriod: (period: Period) => void;
  periodLeads: Lead[];
  newLeads: number;
  waiting: number;
  overdue: number;
  confirmed: number;
  conversion: number;
  trendData: TrendPoint[];
  courseData: ChartPoint[];
  originData: ChartPoint[];
  taskOwnerData: ChartPoint[];
  pendingTasks: number;
  pendingTaskItems: Task[];
  allLeads: Lead[];
};

export const dashboardChartConfig = {
  leads: { label: "Leads", color: "var(--chart-1)" },
  matriculas: { label: "Matrículas", color: "var(--chart-2)" },
  tarefas: { label: "Tarefas", color: "var(--chart-4)" },
} satisfies ChartConfig;
