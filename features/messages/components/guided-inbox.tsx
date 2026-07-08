"use client";

import * as React from "react";
import { ArrowRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Lead } from "@/lib/crm";
import type { Conversation } from "@/lib/messages";

type Props = {
  conversations: Conversation[];
  leads: Lead[];
  index: number;
  onIndexChange: (index: number) => void;
  onRespondNow: (conversationId: string) => void;
  onSendSuggestion: (conversationId: string, text: string) => void;
  sending: boolean;
};

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function buildSuggestions(conversation: Conversation, lead: Lead | null): string[] {
  const firstName = (lead?.nome || conversation.contactName || "").trim().split(/\s+/)[0] || "";
  const course = lead?.curso_de_interesse?.trim();
  const suggestions = [
    firstName
      ? `Oi ${firstName}! Tudo bem? Vou te passar os detalhes agora mesmo 😊`
      : "Oi! Tudo bem? Vou te passar os detalhes agora mesmo 😊",
  ];
  if (course) {
    suggestions.push(`Claro! Sobre ${course}, posso te enviar os valores e as próximas turmas?`);
  }
  suggestions.push("Que bom seu interesse! Quer que eu te retorne por aqui com todas as informações?");
  return suggestions;
}

export function GuidedInbox({ conversations, leads, index, onIndexChange, onRespondNow, onSendSuggestion, sending }: Props) {
  const total = conversations.length;
  const safeIndex = total ? Math.min(index, total - 1) : 0;
  const conversation = conversations[safeIndex] ?? null;
  const lead = React.useMemo(
    () => (conversation?.leadId ? leads.find((l) => l.id === conversation.leadId) ?? null : null),
    [conversation?.leadId, leads],
  );

  if (!conversation) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-sm font-medium text-foreground">Nenhuma conversa pendente por aqui.</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          O modo guiado mostra apenas conversas não lidas ou com retorno pendente, uma de cada vez.
        </p>
      </div>
    );
  }

  const suggestions = buildSuggestions(conversation, lead);

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-5 overflow-y-auto p-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-primary">Conversa {safeIndex + 1} de {total}</span>
        <span>·</span>
        <span>Uma de cada vez, sem pressa</span>
      </div>

      <div className="w-full max-w-xl overflow-hidden rounded-[22px] border border-border bg-card shadow-lg">
        <div className="flex items-center gap-3 border-b border-border px-6 py-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
            {initialsFor(lead?.nome || conversation.contactName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-foreground">{lead?.nome || conversation.contactName}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {conversation.contactPhone}
              {lead?.curso_de_interesse ? ` · Interesse em ${lead.curso_de_interesse}` : ""}
            </p>
          </div>
          {conversation.leadStatus ? (
            <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-secondary-foreground">
              {conversation.leadStatus}
            </span>
          ) : null}
        </div>

        <div className="px-6 py-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Última mensagem recebida</p>
          <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground">
            {conversation.lastMessage || "Sem mensagens ainda."}
          </div>

          <p className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Respostas rápidas sugeridas</p>
          <div className="flex flex-col gap-2">
            {suggestions.map((text) => (
              <button
                key={text}
                type="button"
                disabled={sending}
                onClick={() => onSendSuggestion(conversation.id, text)}
                className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-left text-sm leading-snug text-foreground transition-colors hover:bg-primary/10 disabled:opacity-50"
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={() => onIndexChange((safeIndex + 1) % total)}
          >
            <SkipForward className="mr-2 h-4 w-4" />
            Pular por agora
          </Button>
          <Button type="button" className="flex-1" onClick={() => onRespondNow(conversation.id)}>
            Responder agora
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="max-w-md text-center text-xs leading-relaxed text-muted-foreground">
        O modo guiado mostra <b className="text-foreground">uma conversa por vez</b> na ordem de prioridade — ideal
        para quem está começando e não quer se perder na lista.
      </p>
    </div>
  );
}
