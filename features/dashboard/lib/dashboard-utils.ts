"use client";

export const snowChartColors = ["#9DB9E8", "#6FDDB2", "#F0A876", "#79B8F7", "#B696EE", "#6BD88A"];

export function badgeVariantForFunnelStatus(status: string): "outline" | "gold" | "danger" | "success" {
  if (status === "Matriculado") return "success";
  if (status === "Negociação") return "gold";
  return "outline";
}

export function isLateFollowUp(nextContact: string) {
  return Boolean(nextContact) && nextContact < new Date().toISOString().slice(0, 10);
}

export function compactLabel(value: string) {
  const firstWord = value.split(" ")[0] || value;
  return firstWord.length > 9 ?`${firstWord.slice(0, 8)}.` : firstWord;
}
