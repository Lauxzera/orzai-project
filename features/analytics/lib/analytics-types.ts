"use client";

import type { FunnelStatus, Lead, Task } from "@/lib/crm";
import type { Conversation, Message } from "@/lib/messages";

export type AnalyticsPeriodMode = "day" | "week" | "month" | "year" | "custom";
export type DateRange = { start: string; end: string };
export type ConversationBundle = { conversation: Conversation; messages: Message[] };
export type TrendPoint = {
  label: string;
  conversas: number;
  mensagens: number;
  recebidas: number;
  ganhos: number;
  perdidos: number;
};

export type AnalyticsMetric = {
  key: string;
  label: string;
  value: number;
  previous: number;
  trendGood?: "up" | "down";
  formatter?: (value: number) => string;
};

export type PeriodComparisonInsight = {
  key: string;
  label: string;
  current: number;
  previous: number;
  delta: number;
  trendGood?: "up" | "down";
  formatter?: (value: number) => string;
};

export type PendingResponseInsight = {
  bundle: ConversationBundle;
  lead: Lead | null;
  silenceHours: number;
  reason: string;
};

export type FollowUpLagInsight = {
  lead: Lead;
  hours: number;
  dueDate: string;
  stageLabel: string;
  reason: string;
};

export type FunnelConversionInsight = {
  status: FunnelStatus;
  total: number;
  share: number;
  stalled: number;
  averageDaysInStage: number;
};

export type OwnerPerformanceInsight = {
  owner: string;
  leadCount: number;
  activeLeads: number;
  overdueFollowUps: number;
  pendingTasks: number;
  wonLeads: number;
  conversionRate: number;
  averageResponseHours: number;
};

export type OwnerTrendInsight = {
  owner: string;
  currentLeadCount: number;
  previousLeadCount: number;
  currentConversionRate: number;
  previousConversionRate: number;
  currentOverdueFollowUps: number;
  previousOverdueFollowUps: number;
  portfolioDelta: number;
  conversionDelta: number;
  overdueDelta: number;
  momentum: "up" | "down" | "flat";
};

export type StalledLeadInsight = {
  lead: Lead;
  daysWithoutMovement: number;
  overdueDays: number;
  reason: string;
};

export type ExecutiveAlert = {
  id: string;
  title: string;
  description: string;
  severity: "warning" | "danger" | "info";
};

export type OriginPerformanceInsight = {
  origin: string;
  leadCount: number;
  wonLeads: number;
  lostLeads: number;
  stalledLeads: number;
  conversionRate: number;
  lossRate: number;
  topCampaign: string;
};

export type ComputedAnalytics = {
  metrics: AnalyticsMetric[];
  periodComparisons: PeriodComparisonInsight[];
  trend: TrendPoint[];
  topOrigins: Array<{ name: string; value: number }>;
  topStatuses: Array<{ name: string; value: number }>;
  executiveAlerts: ExecutiveAlert[];
  funnelConversions: FunnelConversionInsight[];
  ownerPerformance: OwnerPerformanceInsight[];
  ownerTrends: OwnerTrendInsight[];
  originPerformance: OriginPerformanceInsight[];
  pendingResponseItems: PendingResponseInsight[];
  followUpLagItems: FollowUpLagInsight[];
  stalledLeadItems: StalledLeadInsight[];
};

export type AnalyticsAiSummary = {
  answer: string;
  source: "openrouter" | "fallback";
};

export type AnalyticsViewProps = {
  leads: Lead[];
  tasks: Task[];
  onOpenConversation: (leadId?: string | null, conversationId?: string | null) => void;
  onOpenLead: (leadId: string) => void;
};

export type AnalyticsFilters = {
  curso: string;
  origem: string;
  responsavel: string;
  status: string;
};

export const funnelStatusOptions: FunnelStatus[] = [
  "Novo Lead",
  "Primeiro Contato Feito",
  "Interessado no Curso",
  "Informações Enviadas",
  "Aguardando Retorno",
  "Negociação / Matrícula",
  "Aguardando Pagamento",
  "Matriculado",
  "Perdido",
  "Reativar Futuramente",
];
