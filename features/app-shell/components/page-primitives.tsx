"use client";

import { Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type LeadScore } from "@/lib/crm";
import { cn } from "@/lib/utils";

export function FilterSelect({
  value,
  onValueChange,
  options,
  placeholder,
  optionValues,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder: string;
  optionValues?: string[];
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((option, index) => (
          <SelectItem key={optionValues?.[index] ?? option} value={optionValues?.[index] ?? option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ScorePill({ score, showLabel = false }: { score: LeadScore; showLabel?: boolean }) {
  const styles: Record<LeadScore["tier"], string> = {
    hot: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    warm: "bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-300",
    cooling: "bg-sky-100    text-sky-800    dark:bg-sky-900/30    dark:text-sky-300",
    cold: "bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground",
  };

  return (
    <span
      title={`Score preditivo: ${score.value}/100 — ${score.label}`}
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums", styles[score.tier])}
    >
      {score.value}
      {showLabel ?<span className="font-medium">{score.label}</span> : null}
    </span>
  );
}

export function EmptyState({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-lg border border-dashed  text-center text-sm text-muted-foreground", compact ? "p-6" : "p-12")}>
      {text}
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg border" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="h-[420px] animate-pulse rounded-lg border" />
        <div className="h-[420px] animate-pulse rounded-lg border" />
      </div>
    </div>
  );
}
