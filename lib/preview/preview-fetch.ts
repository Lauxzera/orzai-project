"use client";

import { applyCommandToState } from "@/lib/server/crm/state-commands";
import { buildAssignableOwners, defaultCrmCustomizations, normalizeCrmState, seedState, type CrmCustomizations, type CrmState, type CrmUser } from "@/lib/crm";
import type { CrmCommand } from "@/lib/server/crm/types";
import { isPreviewMode } from "@/lib/preview/is-preview-mode";

const PREVIEW_USER: CrmUser = {
  id: "preview-user",
  name: "Visitante (Preview)",
  username: "preview",
  role: "ADMIN",
  active: true,
};

let installed = false;
let previewState: CrmState = seedState();
let previewCustomizations: CrmCustomizations = defaultCrmCustomizations;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function matchesPath(url: string, pathname: string) {
  try {
    return new URL(url, "http://localhost").pathname === pathname;
  } catch {
    return url === pathname;
  }
}

async function handlePreviewRequest(input: RequestInfo | URL, init?: RequestInit): Promise<Response | null> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET") || "GET").toUpperCase();

  if (matchesPath(url, "/api/crm/state") && method === "GET") {
    return jsonResponse({
      user: PREVIEW_USER,
      state: previewState,
      assignableOwners: buildAssignableOwners(previewState.leads.map((lead) => lead.responsavel)),
      customizations: previewCustomizations,
    });
  }

  if (matchesPath(url, "/api/crm/command") && method === "POST") {
    try {
      const command = JSON.parse(String(init?.body ?? "{}")) as CrmCommand;
      previewState = applyCommandToState(previewState, command, PREVIEW_USER);
      return jsonResponse({ state: previewState });
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : "Não foi possível completar a ação." }, 400);
    }
  }

  if (matchesPath(url, "/api/crm/customizations") && method === "POST") {
    try {
      const next = JSON.parse(String(init?.body ?? "{}")) as CrmCustomizations;
      previewCustomizations = next;
      return jsonResponse({
        customizations: previewCustomizations,
        assignableOwners: buildAssignableOwners(previewCustomizations.owners),
      });
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : "Não foi possível salvar." }, 400);
    }
  }

  if (matchesPath(url, "/api/ai/conversation-analysis") && method === "POST") {
    return jsonResponse({ error: "Análise de conversa não está disponível no modo de demonstração." });
  }

  if (matchesPath(url, "/api/ai/assistant") && method === "POST") {
    return jsonResponse({
      answer:
        "Este é um ambiente de demonstração com dados fictícios. O assistente de IA completo está disponível na versão real do Orzai CRM.",
      source: "fallback",
    });
  }

  if ((matchesPath(url, "/api/integrations/import") || matchesPath(url, "/api/lead-lists/import")) && method === "POST") {
    return jsonResponse({ error: "Importação de arquivos não está disponível no modo de demonstração." }, 400);
  }

  if (matchesPath(url, "/api/crm/appointments/today") && method === "GET") {
    const today = new Date();
    const at = (hour: number, minute: number) => {
      const date = new Date(today);
      date.setHours(hour, minute, 0, 0);
      return date.toISOString();
    };
    return jsonResponse({
      appointments: [
        {
          id: "preview-appt-1",
          startTime: at(10, 0),
          endTime: at(10, 45),
          status: "CONFIRMED",
          leadName: "Mariana Alves",
          leadPhone: "(11) 90000-0001",
          departmentName: "Estética Facial",
        },
        {
          id: "preview-appt-2",
          startTime: at(15, 30),
          endTime: at(16, 0),
          status: "PENDING",
          leadName: "Renata Lima",
          leadPhone: "(11) 90000-0002",
          departmentName: "Extensão de Cílios",
        },
      ],
    });
  }

  return null;
}

export function installPreviewFetch() {
  if (installed || typeof window === "undefined" || !isPreviewMode()) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const mocked = await handlePreviewRequest(input, init);
    if (mocked) return mocked;
    return originalFetch(input, init);
  };
}
