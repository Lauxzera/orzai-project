"use client";

import * as React from "react";
import { courses, origins, owners, type FunnelStatus } from "@/lib/crm";
import {
  analyticsTrendConfig,
  buildAnalyticsAiPrompt,
  computeAnalytics,
  formatRangeLabel,
  previousRangeFor,
  resolveRange,
} from "@/features/analytics/lib/analytics-metrics";
import type {
  AnalyticsAiSummary,
  AnalyticsPeriodMode,
  AnalyticsViewProps,
  ConversationBundle,
  DateRange,
} from "@/features/analytics/lib/analytics-types";

type AnalyticsSnapshotResponse = {
  bundles: ConversationBundle[];
  updatedAt: string | null;
};

const ANALYTICS_SNAPSHOT_REFRESH_MS = 180_000;

export function useAnalyticsView({ leads, tasks }: Pick<AnalyticsViewProps, "leads" | "tasks">) {
  const [periodMode, setPeriodMode] = React.useState<AnalyticsPeriodMode>("month");
  const [courseFilter, setCourseFilter] = React.useState("all");
  const [originFilter, setOriginFilter] = React.useState("all");
  const [ownerFilter, setOwnerFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | FunnelStatus>("all");
  const [customRange, setCustomRange] = React.useState<DateRange>(() => {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date();
    start.setDate(start.getDate() - 29);
    return { start: start.toISOString().slice(0, 10), end };
  });
  const [conversationBundles, setConversationBundles] = React.useState<ConversationBundle[]>([]);
  const [loadingMessages, setLoadingMessages] = React.useState(true);
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = React.useState<string | null>(null);
  const [aiSummary, setAiSummary] = React.useState<AnalyticsAiSummary | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState("");
  const [pageVisible, setPageVisible] = React.useState(true);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const syncVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let activeController: AbortController | null = null;

    async function loadSnapshot(isBackground = false) {
      if (!isBackground) {
        setLoadingMessages(true);
      }
      activeController?.abort();
      activeController = new AbortController();
      try {
        const response = await fetch("/api/analytics/snapshot", { signal: activeController.signal });
        const data = (await response.json()) as AnalyticsSnapshotResponse;
        if (!cancelled) {
          setConversationBundles(data.bundles ?? []);
          setSnapshotUpdatedAt(data.updatedAt ?? null);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (!cancelled) {
          setConversationBundles([]);
          setSnapshotUpdatedAt(null);
        }
      } finally {
        if (!cancelled && !isBackground) {
          setLoadingMessages(false);
        }
      }
    }

    void loadSnapshot();
    if (!pageVisible) {
      return () => {
        cancelled = true;
        activeController?.abort();
      };
    }

    intervalId = setInterval(() => {
      void loadSnapshot(true);
    }, ANALYTICS_SNAPSHOT_REFRESH_MS);

    return () => {
      cancelled = true;
      activeController?.abort();
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [pageVisible]);

  const currentRange = React.useMemo(() => resolveRange(periodMode, customRange), [periodMode, customRange]);
  const previousRange = React.useMemo(() => previousRangeFor(currentRange), [currentRange]);

  const filteredLeads = React.useMemo(() => {
    return leads.filter((lead) => {
      const matchesCourse = courseFilter === "all" || lead.curso_de_interesse === courseFilter;
      const matchesOrigin = originFilter === "all" || lead.origem === originFilter;
      const matchesOwner = ownerFilter === "all" || lead.responsavel === ownerFilter;
      const matchesStatus = statusFilter === "all" || lead.status_funil === statusFilter;
      return matchesCourse && matchesOrigin && matchesOwner && matchesStatus;
    });
  }, [courseFilter, originFilter, ownerFilter, statusFilter, leads]);

  const filteredLeadIds = React.useMemo(() => new Set(filteredLeads.map((lead) => lead.id)), [filteredLeads]);
  const filteredTasks = React.useMemo(() => tasks.filter((task) => filteredLeadIds.has(task.leadId)), [filteredLeadIds, tasks]);

  const filteredBundles = React.useMemo(
    () =>
      conversationBundles.filter((bundle) =>
        bundle.conversation.leadId
          ? filteredLeadIds.has(bundle.conversation.leadId)
          : statusFilter === "all" && ownerFilter === "all" && originFilter === "all" && courseFilter === "all",
      ),
    [conversationBundles, courseFilter, filteredLeadIds, originFilter, ownerFilter, statusFilter],
  );

  const analytics = React.useMemo(
    () => computeAnalytics(filteredLeads, filteredTasks, filteredBundles, currentRange, previousRange, periodMode),
    [currentRange, filteredBundles, filteredLeads, filteredTasks, periodMode, previousRange],
  );

  async function analyzeWithAi() {
    setAiLoading(true);
    setAiError("");
    try {
      const prompt = buildAnalyticsAiPrompt({
        rangeLabel: formatRangeLabel(currentRange),
        periodMode,
        filters: {
          curso: courseFilter,
          origem: originFilter,
          responsavel: ownerFilter,
          status: statusFilter,
        },
        metrics: analytics.metrics,
        topOrigins: analytics.topOrigins,
        topStatuses: analytics.topStatuses,
        pendingResponses: analytics.pendingResponseItems.length,
        followUpDelays: analytics.followUpLagItems.length,
      });

      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          selectedLeadId: null,
        }),
      });
      const data = (await response.json()) as AnalyticsAiSummary;
      setAiSummary(data);
    } catch {
      setAiError("Não consegui analisar o recorte agora. Tente novamente em instantes.");
    } finally {
      setAiLoading(false);
    }
  }

  return {
    state: {
      periodMode,
      courseFilter,
      originFilter,
      ownerFilter,
      statusFilter,
      customRange,
      loadingMessages,
      aiSummary,
      aiLoading,
      aiError,
      currentRange,
      previousRange,
      analytics,
      snapshotUpdatedAt,
      filterOptions: {
        courses,
        origins,
        owners,
      },
    },
    actions: {
      setPeriodMode,
      setCourseFilter,
      setOriginFilter,
      setOwnerFilter,
      setStatusFilter,
      setCustomRange,
      analyzeWithAi,
    },
    constants: {
      analyticsTrendConfig,
    },
  };
}
