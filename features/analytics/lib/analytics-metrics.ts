"use client";

import {
  chartPalette,
  closingStatuses,
  currentDate,
  formatDate,
  getLeadTrackedCampaignLabel,
  getLeadTrackedOriginLabel,
  type FunnelStatus,
  type Lead,
  type Task
} from "@/lib/crm";
import type { Message } from "@/lib/messages";
import type {
  AnalyticsMetric,
  AnalyticsPeriodMode,
  ComputedAnalytics,
  ConversationBundle,
  DateRange,
  ExecutiveAlert,
  FollowUpLagInsight,
  FunnelConversionInsight,
  OwnerTrendInsight,
  OriginPerformanceInsight,
  OwnerPerformanceInsight,
  PeriodComparisonInsight,
  StalledLeadInsight,
} from "@/features/analytics/lib/analytics-types";

export function computeAnalytics(
  leads: Lead[],
  tasks: Task[],
  bundles: ConversationBundle[],
  range: DateRange,
  previousRange: DateRange,
  periodMode: AnalyticsPeriodMode
): ComputedAnalytics {
  const current = measureRange(leads, tasks, bundles, range);
  const previous = measureRange(leads, tasks, bundles, previousRange);
  const trend = buildAnalyticsTrend(leads, tasks, bundles, range, periodMode);

  return {
    metrics: [
      { key: "conversas", label: "Conversas iniciadas", value: current.conversationsStarted, previous: previous.conversationsStarted, trendGood: "up" },
      { key: "mensagens", label: "Mensagens enviadas/recebidas", value: current.messagesTotal, previous: previous.messagesTotal, trendGood: "up" },
      { key: "recebidas", label: "Mensagens recebidas", value: current.inboundMessages, previous: previous.inboundMessages, trendGood: "up" },
      { key: "sem-resposta", label: "Conversas sem resposta", value: current.pendingResponses, previous: previous.pendingResponses, trendGood: "down" },
      { key: "ganhos", label: "Leads ganhos", value: current.wonLeads, previous: previous.wonLeads, trendGood: "up" },
      { key: "perdidos", label: "Leads perdidos", value: current.lostLeads, previous: previous.lostLeads, trendGood: "down" },
      { key: "nao-preenchidos", label: "Leads não preenchidos", value: current.unfilledLeads, previous: previous.unfilledLeads, trendGood: "down" },
      { key: "parados", label: "Leads sem movimento", value: current.stalledLeads, previous: previous.stalledLeads, trendGood: "down" },
      { key: "tempo-resposta", label: "Tempo médio de resposta", value: current.averageResponseHours, previous: previous.averageResponseHours, trendGood: "down", formatter: formatHours },
      { key: "tempo-follow-up", label: "Tempo médio de follow-up", value: current.averageFollowUpHours, previous: previous.averageFollowUpHours, trendGood: "down", formatter: formatHours },
    ],
    periodComparisons: buildPeriodComparisons(current, previous),
    trend,
    topOrigins: toSortedDistribution(leads.filter((lead) => isInRange(lead.data_entrada, range)), (lead) => getLeadTrackedOriginLabel(lead)),
    topStatuses: toSortedDistribution(leads.filter((lead) => isInRange(lead.data_entrada, range)), (lead) => lead.status_funil),
    executiveAlerts: buildExecutiveAlerts(current),
    funnelConversions: current.funnelConversions,
    ownerPerformance: current.ownerPerformance,
    ownerTrends: buildOwnerTrends(current.ownerPerformance, previous.ownerPerformance),
    originPerformance: current.originPerformance,
    pendingResponseItems: current.pendingResponseItems.slice(0, 5),
    followUpLagItems: current.followUpLagItems.slice(0, 5),
    stalledLeadItems: current.stalledLeadItems.slice(0, 6),
  };
}

function buildPeriodComparisons(
  current: {
    conversationsStarted: number;
    wonLeads: number;
    lostLeads: number;
    averageResponseHours: number;
    pendingResponses: number;
  },
  previous: {
    conversationsStarted: number;
    wonLeads: number;
    lostLeads: number;
    averageResponseHours: number;
    pendingResponses: number;
  }
) {
  const rows: PeriodComparisonInsight[] = [
    {
      key: "conversas",
      label: "Conversas iniciadas",
      current: current.conversationsStarted,
      previous: previous.conversationsStarted,
      delta: current.conversationsStarted - previous.conversationsStarted,
      trendGood: "up",
    },
    {
      key: "ganhos",
      label: "Leads ganhos",
      current: current.wonLeads,
      previous: previous.wonLeads,
      delta: current.wonLeads - previous.wonLeads,
      trendGood: "up",
    },
    {
      key: "perdidos",
      label: "Leads perdidos",
      current: current.lostLeads,
      previous: previous.lostLeads,
      delta: current.lostLeads - previous.lostLeads,
      trendGood: "down",
    },
    {
      key: "tempo-resposta",
      label: "Tempo medio de resposta",
      current: current.averageResponseHours,
      previous: previous.averageResponseHours,
      delta: current.averageResponseHours - previous.averageResponseHours,
      trendGood: "down",
      formatter: formatHours,
    },
    {
      key: "sem-resposta",
      label: "Conversas sem retorno",
      current: current.pendingResponses,
      previous: previous.pendingResponses,
      delta: current.pendingResponses - previous.pendingResponses,
      trendGood: "down",
    },
  ];

  return rows;
}

function measureRange(leads: Lead[], tasks: Task[], bundles: ConversationBundle[], range: DateRange) {
  const leadsInRange = leads.filter((lead) => isInRange(lead.data_entrada, range));
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const tasksByLeadId = tasks.reduce<Record<string, Task[]>>((acc, task) => {
    (acc[task.leadId] ||= []).push(task);
    return acc;
  }, {});

  const conversationsStarted = bundles.filter((bundle) => {
    const firstMessage = bundle.messages[0];
    return firstMessage ? isInRange(firstMessage.timestamp, range) : false;
  }).length;

  const messagesInRange = bundles.flatMap((bundle) => bundle.messages.filter((message) => isInRange(message.timestamp, range)));
  const inboundMessages = messagesInRange.filter((message) => message.direction === "inbound").length;

  const pendingResponseItems = bundles
    .filter((bundle) => {
      const lastMessage = bundle.messages.at(-1);
      return Boolean(lastMessage && lastMessage.direction === "inbound" && isInRange(lastMessage.timestamp, range));
    })
    .map((bundle) => {
      const lastMessage = bundle.messages.at(-1);
      const lead = bundle.conversation.leadId ? leadById.get(bundle.conversation.leadId) ?? null : null;
      const silenceHours = lastMessage ? diffHours(lastMessage.timestamp, new Date().toISOString()) : 0;
      return {
        bundle,
        lead,
        silenceHours,
        reason: describePendingResponseReason(lead, silenceHours, lastMessage?.content || bundle.conversation.lastMessage),
      };
    });

  const wonLeads = leadsInRange.filter((lead) => ["Pagamento confirmado", "Matriculado"].includes(lead.status_matricula)).length;
  const lostLeads = leadsInRange.filter((lead) => lead.status_funil === "Perdido").length;
  const unfilledLeads = leadsInRange.filter((lead) => !lead.email.trim() || !lead.cidade.trim() || !lead.profissao.trim()).length;

  const stalledLeadItems = leadsInRange
    .filter((lead) => !closingStatuses.includes(lead.status_funil))
    .map((lead) => {
      const lastMovementAt = getLeadLastMovementAt(lead);
      const daysWithoutMovement = diffDays(lastMovementAt, new Date().toISOString());
      const overdueDays = lead.proximo_contato ? diffDays(`${lead.proximo_contato}T12:00:00.000Z`, `${currentDate(0)}T12:00:00.000Z`) : 0;
      return {
        lead,
        daysWithoutMovement,
        overdueDays,
        reason: describeStalledLeadReason(lead, daysWithoutMovement, overdueDays),
      };
    })
    .filter((item) => item.daysWithoutMovement >= 3 || item.overdueDays >= 1)
    .sort((a, b) => (b.overdueDays * 3 + b.daysWithoutMovement) - (a.overdueDays * 3 + a.daysWithoutMovement)) as StalledLeadInsight[];

  const responseDurations = bundles.flatMap((bundle) => collectResponseDurations(bundle.messages, range));
  const followUpLagItems = leadsInRange
    .map((lead) => {
      const leadTasks = (tasksByLeadId[lead.id] || []).slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const firstTask = leadTasks[0];
      if (!firstTask) return null;
      const hours = diffHours(`${lead.data_entrada}T12:00:00.000Z`, `${firstTask.dueDate}T12:00:00.000Z`);
      return {
        lead,
        hours,
        dueDate: firstTask.dueDate,
        stageLabel: describeFollowUpStage(lead),
        reason: describeFollowUpReason(lead, hours),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b?.hours || 0) - (a?.hours || 0)) as FollowUpLagInsight[];

  const followUpHours = followUpLagItems.map((item) => item.hours).filter((value) => Number.isFinite(value));
  const funnelConversions = buildFunnelConversions(leadsInRange, stalledLeadItems);
  const ownerPerformance = buildOwnerPerformance(leadsInRange, tasksByLeadId, bundles, range);
  const originPerformance = buildOriginPerformance(leadsInRange, stalledLeadItems);

  return {
    conversationsStarted,
    messagesTotal: messagesInRange.length,
    inboundMessages,
    pendingResponses: pendingResponseItems.length,
    pendingResponseItems,
    wonLeads,
    lostLeads,
    unfilledLeads,
    stalledLeads: stalledLeadItems.length,
    averageResponseHours: average(responseDurations),
    averageFollowUpHours: average(followUpHours),
    funnelConversions,
    ownerPerformance,
    originPerformance,
    followUpLagItems,
    stalledLeadItems,
  };
}

function buildExecutiveAlerts(current: {
  pendingResponses: number;
  stalledLeads: number;
  followUpLagItems: FollowUpLagInsight[];
  ownerPerformance: OwnerPerformanceInsight[];
  originPerformance: OriginPerformanceInsight[];
}) {
  const alerts: ExecutiveAlert[] = [];
  const topOwner = current.ownerPerformance[0];
  const weakestOrigin = [...current.originPerformance]
    .filter((item) => item.leadCount >= 3)
    .sort((a, b) => {
      if (a.conversionRate !== b.conversionRate) return a.conversionRate - b.conversionRate;
      return b.lossRate - a.lossRate;
    })[0];

  if (current.pendingResponses >= 5) {
    alerts.push({
      id: "pending-responses",
      title: "Fila com conversas sem retorno",
      description: `${current.pendingResponses} conversa(s) ficaram sem resposta no recorte atual.`,
      severity: "danger",
    });
  }

  if (current.stalledLeads >= 5) {
    alerts.push({
      id: "stalled-leads",
      title: "Volume alto de leads estagnados",
      description: `${current.stalledLeads} lead(s) estão parados ou com follow-up vencido.`,
      severity: "warning",
    });
  }

  if (current.followUpLagItems.length && current.followUpLagItems[0].hours >= 48) {
    alerts.push({
      id: "follow-up-lag",
      title: "Cadência de follow-up precisa de atenção",
      description: `O maior atraso identificado está em ${formatHours(current.followUpLagItems[0].hours)}.`,
      severity: "warning",
    });
  }

  if (topOwner && topOwner.overdueFollowUps >= 3) {
    alerts.push({
      id: `owner-${topOwner.owner}`,
      title: "Responsável com carteira pressionada",
      description: `${topOwner.owner} está com ${topOwner.overdueFollowUps} follow-up(s) atrasados.`,
      severity: "info",
    });
  }

  if (weakestOrigin && weakestOrigin.lossRate >= 0.4) {
    alerts.push({
      id: `origin-${weakestOrigin.origin}`,
      title: "Origem com perda acima do ideal",
      description: `${weakestOrigin.origin} concentra ${formatPercent(weakestOrigin.lossRate)} de perda no recorte analisado.`,
      severity: "warning",
    });
  }

  return alerts.slice(0, 4);
}

function buildAnalyticsTrend(leads: Lead[], tasks: Task[], bundles: ConversationBundle[], range: DateRange, periodMode: AnalyticsPeriodMode) {
  const points = periodMode === "year" ? buildMonthlyPoints(range) : buildDailyPoints(range);

  return points.map((point) => {
    const measure = measureRange(leads, tasks, bundles, point.range);
    return {
      label: point.label,
      conversas: measure.conversationsStarted,
      mensagens: measure.messagesTotal,
      recebidas: measure.inboundMessages,
      ganhos: measure.wonLeads,
      perdidos: measure.lostLeads,
    };
  });
}

function collectResponseDurations(messages: Message[], range: DateRange) {
  const durations: number[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.direction !== "inbound") continue;
    const nextOutbound = messages.slice(index + 1).find((candidate) => candidate.direction === "outbound");
    if (!nextOutbound || !isInRange(nextOutbound.timestamp, range)) continue;
    durations.push(diffHours(message.timestamp, nextOutbound.timestamp));
  }

  return durations;
}

export function resolveRange(mode: AnalyticsPeriodMode, customRange: DateRange): DateRange {
  const end = today();
  switch (mode) {
    case "day":
      return { start: end, end };
    case "week":
      return { start: shiftDate(end, -6), end };
    case "month":
      return { start: shiftDate(end, -29), end };
    case "year":
      return { start: shiftDate(end, -364), end };
    case "custom":
      return normalizeRange(customRange.start || end, customRange.end || end);
  }
}

export function previousRangeFor(range: DateRange): DateRange {
  const days = rangeSpanInDays(range);
  const previousEnd = shiftDate(range.start, -1);
  return {
    start: shiftDate(previousEnd, -(days - 1)),
    end: previousEnd,
  };
}

function normalizeRange(start: string, end: string): DateRange {
  return start <= end ? { start, end } : { start: end, end: start };
}

function isInRange(value: string, range: DateRange) {
  const date = value.slice(0, 10);
  return date >= range.start && date <= range.end;
}

function rangeSpanInDays(range: DateRange) {
  const start = new Date(`${range.start}T12:00:00`);
  const end = new Date(`${range.end}T12:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function buildDailyPoints(range: DateRange) {
  const days = rangeSpanInDays(range);
  return Array.from({ length: days }).map((_, index) => {
    const day = shiftDate(range.start, index);
    return {
      label: `${day.slice(8, 10)}/${day.slice(5, 7)}`,
      range: { start: day, end: day },
    };
  });
}

function buildMonthlyPoints(range: DateRange) {
  const points: Array<{ label: string; range: DateRange }> = [];
  const cursor = new Date(`${range.start}T12:00:00`);
  cursor.setDate(1);
  const end = new Date(`${range.end}T12:00:00`);

  while (cursor <= end) {
    const monthStart = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-01`;
    const monthEndDate = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 12, 0, 0, 0);
    const monthEnd = monthEndDate.toISOString().slice(0, 10);
    points.push({
      label: cursor.toLocaleDateString("pt-BR", { month: "short" }),
      range: {
        start: monthStart < range.start ? range.start : monthStart,
        end: monthEnd > range.end ? range.end : monthEnd,
      },
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return points;
}

function toSortedDistribution<T>(items: T[], pick: (item: T) => string) {
  const grouped = items.reduce<Record<string, number>>((acc, item) => {
    const key = pick(item) || "Não informado";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
}

function buildFunnelConversions(leads: Lead[], stalledLeadItems: StalledLeadInsight[]) {
  const total = Math.max(1, leads.length);
  const stalledByLeadId = new Set(stalledLeadItems.map((item) => item.lead.id));
  const grouped = leads.reduce<Record<string, Lead[]>>((acc, lead) => {
    (acc[lead.status_funil] ||= []).push(lead);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([status, group]) => ({
      status: status as FunnelStatus,
      total: group.length,
      share: group.length / total,
      stalled: group.filter((lead) => stalledByLeadId.has(lead.id)).length,
      averageDaysInStage: average(group.map((lead) => diffDays(getLeadLastMovementAt(lead), new Date().toISOString()))),
    }))
    .sort((a, b) => b.total - a.total) as FunnelConversionInsight[];
}

function buildOwnerPerformance(
  leads: Lead[],
  tasksByLeadId: Record<string, Task[]>,
  bundles: ConversationBundle[],
  range: DateRange
) {
  const ownerMap = new Map<string, OwnerPerformanceInsight>();
  const responseByLeadId = new Map<string, number[]>();

  for (const bundle of bundles) {
    if (!bundle.conversation.leadId) continue;
    const durations = collectResponseDurations(bundle.messages, range);
    if (!durations.length) continue;
    responseByLeadId.set(bundle.conversation.leadId, [
      ...(responseByLeadId.get(bundle.conversation.leadId) ?? []),
      ...durations,
    ]);
  }

  for (const lead of leads) {
    const owner = lead.responsavel || "Equipe Comercial";
    const current = ownerMap.get(owner) ?? {
      owner,
      leadCount: 0,
      activeLeads: 0,
      overdueFollowUps: 0,
      pendingTasks: 0,
      wonLeads: 0,
      conversionRate: 0,
      averageResponseHours: 0,
    };
    current.leadCount += 1;
    if (!closingStatuses.includes(lead.status_funil)) current.activeLeads += 1;
    if (lead.proximo_contato && lead.proximo_contato < currentDate(0) && !closingStatuses.includes(lead.status_funil)) {
      current.overdueFollowUps += 1;
    }
    if (["Pagamento confirmado", "Matriculado"].includes(lead.status_matricula)) {
      current.wonLeads += 1;
    }
    current.pendingTasks += (tasksByLeadId[lead.id] || []).filter((task) => !task.done).length;
    ownerMap.set(owner, current);
  }

  return Array.from(ownerMap.values())
    .map((item) => {
      const ownerLeadIds = leads.filter((lead) => lead.responsavel === item.owner).map((lead) => lead.id);
      const ownerDurations = ownerLeadIds.flatMap((leadId) => responseByLeadId.get(leadId) ?? []);
      return {
        ...item,
        conversionRate: item.leadCount ? item.wonLeads / item.leadCount : 0,
        averageResponseHours: average(ownerDurations),
      };
    })
    .sort((a, b) => {
      const urgencyA = a.overdueFollowUps * 3 + a.pendingTasks;
      const urgencyB = b.overdueFollowUps * 3 + b.pendingTasks;
      if (urgencyB !== urgencyA) return urgencyB - urgencyA;
      return b.leadCount - a.leadCount;
    });
}

function buildOwnerTrends(currentOwners: OwnerPerformanceInsight[], previousOwners: OwnerPerformanceInsight[]) {
  const previousByOwner = new Map(previousOwners.map((item) => [item.owner, item]));

  return currentOwners
    .map((currentOwner) => {
      const previousOwner = previousByOwner.get(currentOwner.owner);
      const portfolioDelta = currentOwner.leadCount - (previousOwner?.leadCount ?? 0);
      const conversionDelta = currentOwner.conversionRate - (previousOwner?.conversionRate ?? 0);
      const overdueDelta = currentOwner.overdueFollowUps - (previousOwner?.overdueFollowUps ?? 0);
      const score = portfolioDelta * 0.2 + conversionDelta * 100 - overdueDelta * 1.5;

      return {
        owner: currentOwner.owner,
        currentLeadCount: currentOwner.leadCount,
        previousLeadCount: previousOwner?.leadCount ?? 0,
        currentConversionRate: currentOwner.conversionRate,
        previousConversionRate: previousOwner?.conversionRate ?? 0,
        currentOverdueFollowUps: currentOwner.overdueFollowUps,
        previousOverdueFollowUps: previousOwner?.overdueFollowUps ?? 0,
        portfolioDelta,
        conversionDelta,
        overdueDelta,
        momentum: score > 2 ? "up" : score < -2 ? "down" : "flat",
      } satisfies OwnerTrendInsight;
    })
    .sort((a, b) => {
      const weightA = Math.abs(a.conversionDelta) * 100 + Math.abs(a.overdueDelta) * 2 + Math.abs(a.portfolioDelta);
      const weightB = Math.abs(b.conversionDelta) * 100 + Math.abs(b.overdueDelta) * 2 + Math.abs(b.portfolioDelta);
      return weightB - weightA;
    });
}

function buildOriginPerformance(leads: Lead[], stalledLeadItems: StalledLeadInsight[]) {
  const stalledByLeadId = new Set(stalledLeadItems.map((item) => item.lead.id));
  const originMap = new Map<string, OriginPerformanceInsight>();

  for (const lead of leads) {
    const origin = getLeadTrackedOriginLabel(lead);
    const campaign = getLeadTrackedCampaignLabel(lead);
    const current = originMap.get(origin) ?? {
      origin,
      leadCount: 0,
      wonLeads: 0,
      lostLeads: 0,
      stalledLeads: 0,
      conversionRate: 0,
      lossRate: 0,
      topCampaign: campaign,
    };

    current.leadCount += 1;
    if (["Pagamento confirmado", "Matriculado"].includes(lead.status_matricula)) {
      current.wonLeads += 1;
    }
    if (lead.status_funil === "Perdido") {
      current.lostLeads += 1;
    }
    if (stalledByLeadId.has(lead.id)) {
      current.stalledLeads += 1;
    }
    if (!current.topCampaign || current.topCampaign === "Sem campanha") {
      current.topCampaign = campaign;
    }
    originMap.set(origin, current);
  }

  return Array.from(originMap.values())
    .map((item) => ({
      ...item,
      conversionRate: item.leadCount ? item.wonLeads / item.leadCount : 0,
      lossRate: item.leadCount ? item.lostLeads / item.leadCount : 0,
    }))
    .sort((a, b) => {
      if (b.conversionRate !== a.conversionRate) return b.conversionRate - a.conversionRate;
      return b.leadCount - a.leadCount;
    });
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function diffHours(from: string, to: string) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  return Math.max(0, (end - start) / 3_600_000);
}

function diffDays(from: string, to: string) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDelta(value: number, formatter?: (value: number) => string) {
  const display = formatter ? formatter(Math.abs(value)) : String(Math.abs(Math.round(value * 10) / 10));
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${display}`;
}

export function formatHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "0h";
  if (hours >= 24) {
    const days = hours / 24;
    return `${days.toFixed(days >= 10 ? 0 : 1)}d`;
  }
  return `${Math.round(hours)}h`;
}

export function formatDays(days: number) {
  if (!Number.isFinite(days) || days <= 0) return "0d";
  return `${Math.round(days)}d`;
}

export function formatPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0%";
  return `${Math.round(value * 100)}%`;
}

export function formatRangeLabel(range: DateRange) {
  return `${formatDate(range.start)} até ${formatDate(range.end)}`;
}

function describePendingResponseReason(lead: Lead | null, silenceHours: number, lastMessage: string) {
  if (!lead) return "Conversa sem lead vinculado. Vale revisar a identificação antes do próximo contato.";
  if (lead.status_funil === "Aguardando Pagamento") return "O lead está em etapa de pagamento e ficou sem retorno após a última interação.";
  if (lead.status_funil === "Negociação / Matrícula") return "A conversa parou em momento de decisão. Vale retomar com proposta objetiva e urgência controlada.";
  if (lead.objecao_principal?.trim()) return `A objeção dominante é "${lead.objecao_principal}" e a conversa ficou parada depois disso.`;
  if (silenceHours >= 48) return "O lead falou por último e já existe silêncio prolongado. Este é um bom candidato para retomada prioritária.";
  if (/parcel|valor|pag/i.test(lastMessage)) return "A última mensagem sugere dúvida financeira. Uma retomada com condição clara pode destravar o avanço.";
  return "O lead falou por último e ainda não recebeu continuidade. Vale revisar contexto e próximo passo sugerido.";
}

function describeFollowUpStage(lead: Lead) {
  if (lead.status_funil === "Novo Lead") return "Entrada sem cadência";
  if (lead.status_funil === "Primeiro Contato Feito") return "Contato inicial sem sequência";
  if (lead.status_funil === "Informações Enviadas") return "Informações sem avanço";
  if (lead.status_funil === "Aguardando Retorno") return "Retorno prometido não retomado";
  if (lead.status_funil === "Negociação / Matrícula") return "Negociação sem follow-up";
  return "Follow-up em atraso";
}

function describeFollowUpReason(lead: Lead, hours: number) {
  if (lead.objecao_principal?.trim()) {
    return `A objeção principal registrada é "${lead.objecao_principal}" e o follow-up ficou ${formatHours(hours)} atrás do ideal.`;
  }
  if (lead.status_funil === "Novo Lead") {
    return `O lead entrou e ainda não ganhou tração comercial suficiente. Já são ${formatHours(hours)} até a primeira ação planejada.`;
  }
  if (lead.status_funil === "Aguardando Retorno") {
    return `A equipe estava aguardando retorno, mas o próximo toque ficou para trás em ${formatHours(hours)}.`;
  }
  return `Há um atraso de ${formatHours(hours)} entre a entrada do lead e a primeira ação prevista. Vale revisar a cadência deste responsável.`;
}

function describeStalledLeadReason(lead: Lead, daysWithoutMovement: number, overdueDays: number) {
  if (overdueDays >= 3) {
    return `Follow-up vencido há ${formatDays(overdueDays)} para um lead em ${lead.status_funil}.`;
  }
  if (lead.objecao_principal?.trim()) {
    return `A conversa estagnou por ${formatDays(daysWithoutMovement)} após a objeção "${lead.objecao_principal}".`;
  }
  return `Sem movimentação relevante há ${formatDays(daysWithoutMovement)} nesta etapa do funil.`;
}

function getLeadLastMovementAt(lead: Lead) {
  const latestHistory = lead.history
    .map((entry) => entry.createdAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  return latestHistory || `${lead.data_entrada}T12:00:00.000Z`;
}

export function buildAnalyticsAiPrompt({
  rangeLabel,
  periodMode,
  filters,
  metrics,
  topOrigins,
  topStatuses,
  pendingResponses,
  followUpDelays,
}: {
  rangeLabel: string;
  periodMode: AnalyticsPeriodMode;
  filters: { curso: string; origem: string; responsavel: string; status: string };
  metrics: AnalyticsMetric[];
  topOrigins: Array<{ name: string; value: number }>;
  topStatuses: Array<{ name: string; value: number }>;
  pendingResponses: number;
  followUpDelays: number;
}) {
  const metricLines = metrics
    .map((metric) => `- ${metric.label}: ${metric.formatter ? metric.formatter(metric.value) : metric.value} (anterior: ${metric.formatter ? metric.formatter(metric.previous) : metric.previous})`)
    .join("\n");
  const originLines = topOrigins.slice(0, 4).map((item) => `${item.name}: ${item.value}`).join(", ") || "sem destaque";
  const statusLines = topStatuses.slice(0, 4).map((item) => `${item.name}: ${item.value}`).join(", ") || "sem destaque";

  return [
    "Analise este recorte de analytics do Base CRM e responda de forma objetiva e conversacional.",
    "Quero um resumo executivo curto do estado atual, os principais sinais de atenção, o que parece estar indo bem e 3 prioridades práticas para o time comercial.",
    "Evite falar que precisa de mais contexto. Trabalhe apenas com os dados abaixo.",
    "",
    `Período analisado: ${rangeLabel}`,
    `Modo do período: ${periodMode}`,
    `Filtros ativos: curso=${filters.curso}, origem=${filters.origem}, responsável=${filters.responsavel}, status=${filters.status}`,
    "",
    "Métricas:",
    metricLines,
    "",
    `Origens em destaque: ${originLines}`,
    `Status em destaque: ${statusLines}`,
    `Conversas sem resposta: ${pendingResponses}`,
    `Leads com atraso relevante de follow-up: ${followUpDelays}`,
  ].join("\n");
}

export const analyticsTrendConfig = {
  conversas: { label: "Conversas", color: chartPalette[0] },
  mensagens: { label: "Mensagens", color: chartPalette[1] },
  ganhos: { label: "Leads ganhos", color: "#16a34a" },
  perdidos: { label: "Leads perdidos", color: "#dc2626" },
};

