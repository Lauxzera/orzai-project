import type { Conversation } from "@/lib/messages";

export type FunnelTagConfig = {
  label: string;
  className: string;
  dotClass: string;
};

export const funnelTagMap: Record<string, FunnelTagConfig> = {
  "Novo Lead": {
    label: "Novo Lead",
    className: "border-blue-400/30 bg-blue-400/10 text-blue-700 dark:text-blue-300",
    dotClass: "bg-blue-400",
  },
  "Primeiro Contato Feito": {
    label: "1º Contato",
    className: "border-sky-400/30 bg-sky-400/10 text-sky-700 dark:text-sky-300",
    dotClass: "bg-sky-400",
  },
  "Interessado no Curso": {
    label: "Interessado",
    className: "border-teal-400/30 bg-teal-400/10 text-teal-700 dark:text-teal-300",
    dotClass: "bg-teal-400",
  },
  "Informações Enviadas": {
    label: "Info Enviada",
    className: "border-cyan-400/30 bg-cyan-400/10 text-cyan-700 dark:text-cyan-300",
    dotClass: "bg-cyan-400",
  },
  "Aguardando Retorno": {
    label: "Ag. Retorno",
    className: "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-300",
    dotClass: "bg-amber-400",
  },
  "Negociação / Matrícula": {
    label: "Negociação",
    className: "border-orange-400/30 bg-orange-400/10 text-orange-700 dark:text-orange-300",
    dotClass: "bg-orange-400",
  },
  "Aguardando Pagamento": {
    label: "Ag. Pagamento",
    className: "border-rose-400/30 bg-rose-400/10 text-rose-700 dark:text-rose-300",
    dotClass: "bg-rose-400",
  },
  "Matriculado": {
    label: "Matriculado",
    className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
    dotClass: "bg-emerald-400",
  },
  "Perdido": {
    label: "Perdido",
    className: "border-slate-400/30 bg-slate-400/10 text-slate-500 dark:text-slate-400",
    dotClass: "bg-slate-400",
  },
  "Reativar Futuramente": {
    label: "Reativar",
    className: "border-purple-400/30 bg-purple-400/10 text-purple-700 dark:text-purple-300",
    dotClass: "bg-purple-400",
  },
};

export const serviceStatusLabel: Record<NonNullable<Conversation["workspace"]>["serviceStatus"], string> = {
  fila: "Na fila",
  "em-atendimento": "Em atendimento",
  "aguardando-cliente": "Aguardando cliente",
  concluido: "Concluido",
};

export type PriorityConfig = {
  label: string;
  className: string;
  barClass: string;
};

export const priorityStyleMap: Record<NonNullable<Conversation["workspace"]>["priority"], PriorityConfig> = {
  normal: {
    label: "Normal",
    className: "  text-muted-foreground",
    barClass: "bg-transparent",
  },
  alta: {
    label: "Prioridade alta",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    barClass: "bg-amber-400",
  },
  urgente: {
    label: "Urgente",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    barClass: "bg-rose-500",
  },
};
