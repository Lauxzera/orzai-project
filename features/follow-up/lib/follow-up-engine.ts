import "server-only";

import { closingStatuses, currentDate, isOverdue, type Lead, type Task } from "@/lib/crm";
import { applyCrmCommand, getCrmState } from "@/lib/server/crm-repository";
import type { SessionUser } from "@/lib/server/crm/types";
import type { FollowUpFailure, FollowUpReport, FollowUpTrigger } from "./follow-up-types";

const SYSTEM_ACTOR: SessionUser = {
  id: "system",
  name: "Follow-up automático",
  username: "system",
  role: "ADMIN",
};

type RuleResult = {
  ruleName: string;
  taskTitle: string;
  dueDate: string;
  historyNote: string;
};

type Rule = {
  id: string;
  evaluate: (lead: Lead, pendingTasks: Task[]) => RuleResult | null;
};

// Retorna quantos dias se passaram desde uma data no formato YYYY-MM-DD
function daysSince(dateStr: string): number {
  if (!dateStr) return 0;
  const ref = new Date(`${dateStr}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.floor((today.getTime() - ref.getTime()) / 86_400_000);
}

function daysSinceLastActivity(lead: Lead): number {
  if (!lead.history.length) return daysSince(lead.data_entrada);
  const last = lead.history[lead.history.length - 1];
  return daysSince(last.createdAt.slice(0, 10));
}

function hasPendingTask(pendingTasks: Task[], titlePrefix: string): boolean {
  return pendingTasks.some((task) =>
    task.title.toLowerCase().startsWith(titlePrefix.toLowerCase())
  );
}

const RULES: Rule[] = [
  {
    id: "overdue-contact",
    evaluate(lead, pendingTasks) {
      if (!isOverdue(lead.proximo_contato)) return null;
      if (hasPendingTask(pendingTasks, "Contato atrasado")) return null;
      return {
        ruleName: "Contato atrasado",
        taskTitle: "Contato atrasado — retomar hoje",
        dueDate: currentDate(0),
        historyNote: `Próximo contato estava previsto para ${lead.proximo_contato} e não foi realizado.`,
      };
    },
  },
  {
    id: "new-lead-no-contact",
    evaluate(lead, pendingTasks) {
      if (lead.status_funil !== "Novo Lead") return null;
      if (daysSince(lead.data_entrada) < 1) return null;
      if (hasPendingTask(pendingTasks, "Primeiro contato")) return null;
      return {
        ruleName: "Novo lead sem primeiro contato",
        taskTitle: "Primeiro contato pendente",
        dueDate: currentDate(0),
        historyNote: `Lead entrou em ${lead.data_entrada} e ainda não foi contatado.`,
      };
    },
  },
  {
    id: "info-sent-stale",
    evaluate(lead, pendingTasks) {
      if (!["Informações Enviadas", "Interessado no Curso"].includes(lead.status_funil)) return null;
      const days = daysSinceLastActivity(lead);
      if (days < 3) return null;
      if (hasPendingTask(pendingTasks, "Confirmar interesse")) return null;
      return {
        ruleName: "Informações enviadas sem follow-up",
        taskTitle: "Confirmar interesse após informações enviadas",
        dueDate: currentDate(1),
        historyNote: `Lead em "${lead.status_funil}" sem atividade há ${days} dia(s).`,
      };
    },
  },
  {
    id: "awaiting-return-stale",
    evaluate(lead, pendingTasks) {
      if (lead.status_funil !== "Aguardando Retorno") return null;
      const days = daysSinceLastActivity(lead);
      if (days < 5) return null;
      if (hasPendingTask(pendingTasks, "Reengajar")) return null;
      return {
        ruleName: "Aguardando retorno prolongado",
        taskTitle: "Reengajar lead parado",
        dueDate: currentDate(0),
        historyNote: `Lead em "Aguardando Retorno" sem atividade há ${days} dia(s).`,
      };
    },
  },
  {
    id: "negotiation-stale",
    evaluate(lead, pendingTasks) {
      if (!["Negociação / Matrícula", "Aguardando Pagamento"].includes(lead.status_funil)) return null;
      const days = daysSinceLastActivity(lead);
      if (days < 2) return null;
      if (hasPendingTask(pendingTasks, "Retomar negociação")) return null;
      return {
        ruleName: "Negociação/pagamento parado",
        taskTitle: "Retomar negociação urgente",
        dueDate: currentDate(0),
        historyNote: `Lead em "${lead.status_funil}" sem atividade há ${days} dia(s). Risco de perda.`,
      };
    },
  },
];

export async function runFollowUpEngine(): Promise<FollowUpReport> {
  const state = await getCrmState();
  const activeLeads = state.leads.filter((lead) => !closingStatuses.includes(lead.status_funil));

  const triggers: FollowUpTrigger[] = [];
  const failureDetails: FollowUpFailure[] = [];
  let actionsApplied = 0;

  for (const lead of activeLeads) {
    const leadTasks = state.tasks.filter((task) => task.leadId === lead.id);
    // cópia local para atualizar entre regras do mesmo lead sem re-ler o store
    const pendingTasks = leadTasks.filter((task) => !task.done);

    for (const rule of RULES) {
      const result = rule.evaluate(lead, pendingTasks);
      if (!result) continue;

      try {
        await applyCrmCommand(
          { type: "addTask", leadId: lead.id, title: result.taskTitle, owner: lead.responsavel, dueDate: result.dueDate },
          SYSTEM_ACTOR
        );
        await applyCrmCommand(
          { type: "addHistory", leadId: lead.id, note: `[Follow-up automático] ${result.historyNote}` },
          SYSTEM_ACTOR
        );
        actionsApplied += 2;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(
          `[follow-up] Falha ao aplicar regra "${result.ruleName}" para lead "${lead.nome}" (${lead.id}):`,
          errorMessage
        );
        failureDetails.push({ leadId: lead.id, leadName: lead.nome, ruleName: result.ruleName, error: errorMessage });
        continue;
      }

      triggers.push({ leadId: lead.id, leadName: lead.nome, ruleName: result.ruleName, taskTitle: result.taskTitle, historyNote: result.historyNote });

      // atualiza pendingTasks localmente para que regras seguintes deste lead não gerem duplicata
      pendingTasks.push({ id: "tmp", leadId: lead.id, title: result.taskTitle, owner: lead.responsavel, dueDate: result.dueDate, done: false });
    }
  }

  return {
    processedAt: new Date().toISOString(),
    leadsEvaluated: activeLeads.length,
    triggered: triggers.length,
    actionsApplied,
    failures: failureDetails.length,
    triggers,
    failureDetails,
  };
}
