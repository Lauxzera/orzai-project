"use client";

import { ArrowDown, ArrowUp, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { chartPalette } from "@/lib/crm";
import { formatDelta } from "@/features/analytics/lib/analytics-metrics";
import type { AnalyticsMetric } from "@/features/analytics/lib/analytics-types";
import { motion } from "framer-motion";

export function AnalyticsMetricCard({ metric }: { metric: AnalyticsMetric }) {
  const delta = metric.value - metric.previous;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Clock3;
  const positiveOutcome = direction === "flat" ? false : metric.trendGood === "down" ? delta < 0 : delta > 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative overflow-hidden rounded-[24px] border border-white/5 bg-white/[0.015] backdrop-blur-[32px] p-6 transition-all duration-500 hover:-translate-y-1 hover:bg-white/[0.03] hover:shadow-[0_0_40px_-15px_rgba(255,255,255,0.1)]"
    >
      <div className="flex flex-col space-y-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">{metric.label}</p>
          <span
            className={
              direction === "flat"
                ? "rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white/50 border border-white/10" 
                : positiveOutcome
                  ? "rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                  : "rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary border border-primary/20 shadow-[0_0_15px_rgba(219,13,113,0.3)]"
            }
          >
            <span className="inline-flex items-center gap-1.5">
              <Icon className="h-3 w-3" />
              {formatDelta(delta, metric.formatter)}
            </span>
          </span>
        </div>
        
        <p className="text-4xl lg:text-5xl font-light tracking-tighter text-white">
          {metric.formatter ? metric.formatter(metric.value) : metric.value}
        </p>
        
        <p className="text-[12px] font-light text-white/30">
          Anterior: <span className="font-medium text-white/50">{metric.formatter ? metric.formatter(metric.previous) : metric.previous}</span>
        </p>
      </div>
    </motion.div>
  );
}

export function MiniDistribution({ title, items }: { title: string; items: Array<{ name: string; value: number }> }) {
  return (
    <div className="space-y-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">{title}</p>
      {items.length ? (
        items.slice(0, 5).map((item, index) => (
          <div key={item.name} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-[12px] font-light">
              <span className="truncate text-white/70">{item.name}</span>
              <span className="font-medium text-white">{item.value}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(12, Math.min(100, (item.value / Math.max(1, items[0]?.value || 1)) * 100))}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full rounded-full shadow-[0_0_10px_currentColor]"
                style={{
                  background: chartPalette[index % chartPalette.length],
                  color: chartPalette[index % chartPalette.length],
                }}
              />
            </div>
          </div>
        ))
      ) : (
        <EmptyPanel compact text="Sem dados suficientes." />
      )}
    </div>
  );
}

export function EmptyPanel({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "rounded-[16px] border border-white/5 bg-white/[0.01] p-4 text-[12px] font-light text-white/30 text-center" 
          : "grid min-h-[220px] place-items-center rounded-[24px] border border-white/5 bg-white/[0.01] text-[13px] font-light text-white/30"
      }
    >
      {text}
    </div>
  );
}

export function CaseTag({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: "outline" | "gold" | "danger";
}) {
  const getVariantStyles = () => {
    switch (variant) {
      case "gold":
        return "border-primary/30 bg-primary/10 text-primary shadow-[0_0_15px_rgba(219,13,113,0.2)]";
      case "danger":
        return "border-red-500/30 bg-red-500/10 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]";
      default:
        return "border-white/10 bg-white/[0.02] text-white/60";
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors ${getVariantStyles()}`}>
      <span className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">{label}</span>
      <span className="text-[12px] font-semibold">{value}</span>
    </div>
  );
}

export function DateField({ date, prefix = "" }: { date: string; prefix?: string }) {
  return (
    <span className="text-[11px] font-light text-white/40 tracking-wide">
      {prefix} <span className="font-medium text-white/60">{date}</span>
    </span>
  );
}
