"use client";

import { type ElementType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FloatingMarker, PieTooltipPayload } from "@/features/dashboard/lib/dashboard-types";
import { ReferenceDot, Sector } from "recharts";

export function ActiveOriginShape(props: {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
}) {
  const {
    cx = 0,
    cy = 0,
    innerRadius = 0,
    outerRadius = 0,
    startAngle = 0,
    endAngle = 0,
    fill = "var(--chart-2)",
  } = props;

  return (
    <g
      style={{
        transform: "translateX(-4px)",
        transition: "transform 240ms ease-out, filter 240ms ease-out",
        filter: "drop-shadow(0 8px 12px rgba(31, 48, 67, 0.12))",
      }}
    >
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="rgba(255,255,255,0.95)"
        strokeWidth={3}
      />
    </g>
  );
}

export function ChartMarker({ marker }: { marker: FloatingMarker }) {
  return (
    <ReferenceDot
      x={marker.x}
      y={marker.value}
      r={5}
      fill={marker.color}
      stroke="#ffffff"
      strokeWidth={3}
      ifOverflow="extendDomain"
      label={<MarkerLabel value={marker.value} />}
    />
  );
}

export function MarkerLabel({ viewBox, value }: { viewBox?: { x?: number; y?: number }; value?: number }) {
  const x = viewBox?.x ?? 0;
  const y = viewBox?.y ?? 0;

  return (
    <g transform={`translate(${x - 24}, ${y - 52})`}>
      <rect width="48" height="34" rx="12" fill="#111827" />
      <path d="M20 33 L24 39 L28 33 Z" fill="#111827" />
      <text x="24" y="21" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="700">
        {value}
      </text>
    </g>
  );
}

export function OriginTooltipContent({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: PieTooltipPayload[];
  total: number;
}) {
  const item = payload?.[0];
  if (!active || !item) return null;

  const value = item.value ?? 0;
  const share = total ?Math.round((value / total) * 100) : 0;

  return (
    <div className="grid min-w-44 gap-2 rounded-md border p-3 text-xs shadow-xl">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
        <strong className="text-sm text-foreground">{item.name || "Canal"}</strong>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Total de leads</span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Participação no período</span>
        <span className="font-semibold text-foreground">{share}%</span>
      </div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: ElementType;
  tone?: "blue" | "violet" | "danger" | "success" | "gold";
}) {
  const glowColor =
    tone === "danger"
      ? "rgba(239, 68, 68, 0.3)"
      : tone === "success"
        ? "rgba(16, 185, 129, 0.3)"
        : tone === "violet"
          ? "rgba(167, 139, 250, 0.3)"
          : tone === "gold"
            ? "rgba(245, 158, 11, 0.3)"
            : "rgba(219, 13, 113, 0.3)";

  const textColor =
    tone === "danger"
      ? "text-rose-400"
      : tone === "success"
        ? "text-emerald-400"
        : tone === "violet"
          ? "text-violet-400"
          : tone === "gold"
            ? "text-amber-400"
            : "text-primary";

  return (
    <Card className="group relative overflow-hidden rounded-[24px] border border-white/5 bg-white/[0.015] backdrop-blur-[24px] transition-all duration-300 hover:bg-white/[0.03]">
      <CardContent className="flex items-start justify-between gap-4 p-6">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">{label}</p>
          <p 
            className={cn("mt-4 text-[32px] font-light tabular-nums drop-shadow-md", textColor)} 
            style={{ textShadow: `0 0 20px ${glowColor}` }}
          >
            {value}
          </p>
        </div>
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border border-white/10 bg-white/5 transition-transform duration-300 group-hover:scale-110", textColor)}>
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}
