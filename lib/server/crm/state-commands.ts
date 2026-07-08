import {
  buildLeadOwnerChangeEntry,
  buildLeadUpdateHistoryEntry,
  findLeadDuplicate,
  historyEntry,
  normalizeCrmState,
  seedState,
  validateLead,
} from "@/lib/crm";
import { uid } from "@/lib/server/crm/shared";
import type { CrmCommand, CrmState, Lead, SessionUser, Task } from "@/lib/server/crm/types";

function isAutomaticWhatsappInboxCommand(command: Extract<CrmCommand, { type: "upsertLead" }>, actor: SessionUser | null) {
  if (command.source === "automatic_whatsapp_inbox") return true;
  return !actor && command.lead.origem === "WhatsApp" && command.lead.captado_via === "Conversa WhatsApp";
}

export function applyCommandToState(state: CrmState, command: CrmCommand, actor: SessionUser | null) {
  const normalizedState = normalizeCrmState(state);

  switch (command.type) {
    case "restoreDemoData":
      return seedState();
    case "toggleTask":
      return {
        ...normalizedState,
        tasks: normalizedState.tasks.map((task) => (task.id === command.taskId ? { ...task, done: !task.done } : task)),
      };
    case "changeLeadStatus":
      return {
        ...normalizedState,
        leads: normalizedState.leads.map((lead) => {
          if (lead.id !== command.leadId || lead.status_funil === command.status) return lead;
          return {
            ...lead,
            status_funil: command.status,
            status_matricula: command.status === "Matriculado" ? "Matriculado" : lead.status_matricula,
            history: [
              ...lead.history,
              historyEntry(`Status alterado de ${lead.status_funil} para ${command.status}`, actor?.name || "Atualizado no CRM"),
            ],
          };
        }),
      };
    case "addHistory":
      if (!command.note.trim()) return normalizedState;
      return {
        ...normalizedState,
        leads: normalizedState.leads.map((lead) =>
          lead.id === command.leadId
            ? {
                ...lead,
                history: [...lead.history, historyEntry("Atendimento registrado", command.note.trim())],
              }
            : lead,
        ),
      };
    case "addTask": {
      if (!command.title.trim()) return normalizedState;
      const task: Task = {
        id: uid("task"),
        leadId: command.leadId,
        title: command.title.trim(),
        owner: command.owner,
        dueDate: command.dueDate,
        done: false,
      };

      return {
        ...normalizedState,
        leads: normalizedState.leads.map((lead) =>
          lead.id === command.leadId
            ? {
                ...lead,
                proximo_contato: command.dueDate,
                history: [...lead.history, historyEntry("Tarefa de follow-up criada", `${task.title} - ${task.dueDate}`)],
              }
            : lead,
        ),
        tasks: [task, ...normalizedState.tasks],
      };
    }
    case "upsertLead": {
      const validation = validateLead(command.lead);
      if (validation) throw new Error(validation);

      const duplicate = findLeadDuplicate(normalizedState.leads, command.lead, command.leadId);
      if (duplicate) {
        throw new Error(`Já existe um lead com este ${duplicate.field} (${duplicate.lead.nome}).`);
      }

      if (!command.leadId) {
        const automaticWhatsappLead = isAutomaticWhatsappInboxCommand(command, actor);
        const lead: Lead = {
          id: uid("lead"),
          ...command.lead,
          predictive_score: null,
          predictive_score_confidence: "",
          predictive_score_reasons: [],
          predictive_score_risks: [],
          predictive_score_source: "",
          predictive_score_updated_at: "",
          history: [
            historyEntry(
              automaticWhatsappLead ? "Lead cadastrado automaticamente" : "Lead cadastrado manualmente",
              [
                command.lead.origem,
                command.lead.curso_de_interesse || "Sem curso definido",
                automaticWhatsappLead ? "Origem do cadastro: inbox automatico" : `Origem do cadastro: ${command.source ?? "manual"}`,
              ].join(" - "),
            ),
          ],
        };
        return { ...normalizedState, leads: [lead, ...normalizedState.leads] };
      }

      return {
        ...normalizedState,
        leads: normalizedState.leads.map((lead) => {
          if (lead.id !== command.leadId) return lead;
          const statusChanged = lead.status_funil !== command.lead.status_funil;
          const updateEntry = buildLeadUpdateHistoryEntry(lead, command.lead);
          const ownerEntry = buildLeadOwnerChangeEntry(lead, command.lead);
          return {
            ...lead,
            ...command.lead,
            history: [
              ...lead.history,
              ...(ownerEntry ? [ownerEntry] : []),
              ...(updateEntry ? [updateEntry] : []),
              ...(statusChanged
                ? [
                    historyEntry(
                      `Status alterado de ${lead.status_funil} para ${command.lead.status_funil}`,
                      command.lead.objecao_principal || "Atualização manual",
                    ),
                  ]
                : []),
            ],
          };
        }),
      };
    }
    case "deleteLead": {
      if (!normalizedState.leads.some((lead) => lead.id === command.leadId)) {
        throw new Error("Lead não encontrado.");
      }

      return {
        ...normalizedState,
        leads: normalizedState.leads.filter((lead) => lead.id !== command.leadId),
        tasks: normalizedState.tasks.filter((task) => task.leadId !== command.leadId),
        leadLists: normalizedState.leadLists.map((list) => ({
          ...list,
          leadIds: list.leadIds.filter((leadId) => leadId !== command.leadId),
        })),
      };
    }
    case "createLeadList": {
      const name = command.name.trim();
      if (!name) throw new Error("Informe um nome para a lista.");
      const now = new Date().toISOString();
      const leadIds = uniqueLeadIds(command.leadIds, normalizedState);

      return {
        ...normalizedState,
        leadLists: [
          {
            id: uid("list"),
            name,
            description: command.description.trim(),
            color: command.color,
            leadIds,
            createdAt: now,
            updatedAt: now,
          },
          ...normalizedState.leadLists,
        ],
      };
    }
    case "updateLeadList": {
      const name = command.name.trim();
      if (!name) throw new Error("Informe um nome para a lista.");
      if (!normalizedState.leadLists.some((list) => list.id === command.listId)) {
        throw new Error("Lista não encontrada.");
      }
      const leadIds = uniqueLeadIds(command.leadIds, normalizedState);

      return {
        ...normalizedState,
        leadLists: normalizedState.leadLists.map((list) =>
          list.id === command.listId
            ? {
                ...list,
                name,
                description: command.description.trim(),
                color: command.color,
                leadIds,
                updatedAt: new Date().toISOString(),
              }
            : list,
        ),
      };
    }
    case "deleteLeadList":
      return {
        ...normalizedState,
        leadLists: normalizedState.leadLists.filter((list) => list.id !== command.listId),
      };
    default:
      return normalizedState;
  }
}

function uniqueLeadIds(leadIds: string[], state: CrmState) {
  return [...new Set(leadIds)].filter((leadId) => state.leads.some((lead) => lead.id === leadId));
}
