"use client";

import * as React from "react";
import { Bot, Check, LoaderCircle, SendHorizontal, Sparkles, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SmoothInput as Input } from "@/components/ui/smooth-input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { type CrmState } from "@/lib/crm";
import type { ProposedAction } from "@/lib/ai-tools";

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: "openrouter" | "fallback";
  actions?: ProposedAction[];
  references?: Array<{ title: string; url: string; snippet?: string }>;
};

type ActionState = "idle" | "applying" | "applied" | "dismissed" | "error";

const starterPrompts = [
  "Quais leads estao com retorno atrasado?",
  "Quem preciso contatar agora e por que?",
  "Analise o lead selecionado e sugira proximas acoes.",
  "Quais cursos estao com maior demanda?",
  "Resuma o desempenho da equipe esta semana.",
];

// ---------------------------------------------------------------------------
// Action card component
// ---------------------------------------------------------------------------

function ActionCard({
  action,
  onApply,
  onDismiss,
}: {
  action: ProposedAction;
  onApply: (action: ProposedAction) => Promise<void>;
  onDismiss: (id: string) => void;
}) {
  const [state, setState] = React.useState<ActionState>("idle");
  const [errorMsg, setErrorMsg] = React.useState("");

  const tipoLabel: Record<ProposedAction["tipo"], string> = {
    changeLeadStatus: "Mover no funil",
    addTask: "Criar tarefa",
    addHistory: "Registrar histórico",
    upsertLead: "Atualizar lead",
    toggleTask: "Concluir tarefa",
  };

  async function handleApply() {
    setState("applying");
    setErrorMsg("");
    try {
      await onApply(action);
      setState("applied");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao aplicar ação.");
      setState("error");
    }
  }

  return (
    <div
      className={`mt-2 rounded-xl border px-3 py-2.5 text-xs transition-all ${
        state === "applied"
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
          : state === "dismissed"
          ? " bg-muted/30 opacity-50"
          : "border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 shrink-0 text-amber-500 dark:text-amber-400" />
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              {tipoLabel[action.tipo] || action.tipo}
            </span>
          </div>
          <p className="mt-1 font-medium text-foreground">{action.descricao}</p>
          <p className="mt-0.5 text-muted-foreground">{action.justificativa}</p>
          {state === "error" && (
            <p className="mt-1 text-red-600 dark:text-red-400">{errorMsg}</p>
          )}
        </div>

        {(state === "idle" || state === "error") ? (
          <div className="flex shrink-0 gap-1.5">
            <Button
              size="sm"
              variant="default"
              className="h-7 px-2.5 text-xs"
              onClick={handleApply}
            >
              <>
                <Check className="mr-1 h-3 w-3" />
                Aplicar
              </>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => {
                setState("dismissed");
                onDismiss(action.id);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : state === "applied" ? (
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Aplicado</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AssistantSheet({
  open,
  onOpenChange,
  crmState,
  selectedLeadId,
  onCommandApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crmState: CrmState;
  selectedLeadId?: string | null;
  onCommandApplied?: () => void;
}) {
  const [messages, setMessages] = React.useState<AssistantMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        "Oi! Sou o assistente comercial do Base CRM. Tenho acesso completo aos leads, tarefas e histórico. Posso analisar situações, sugerir próximas ações e propor mudanças no CRM para você aprovar.",
    },
  ]);
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, open]);

  async function handleSend(message?: string) {
    const content = (message ?? draft).trim();
    if (!content || loading) return;

    const nextMessages: AssistantMessage[] = [
      ...messages,
      { id: uid(), role: "user", content },
    ];
    setMessages(nextMessages);
    setDraft("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: c }) => ({ role, content: c })),
          selectedLeadId,
        }),
      });

      const data = (await response.json()) as {
        answer: string;
        source: "openrouter" | "fallback";
        actions?: ProposedAction[];
        references?: Array<{ title: string; url: string; snippet?: string }>;
      };

      setMessages((current) => [
        ...current,
        {
          id: uid(),
          role: "assistant",
          content: data.answer,
          source: data.source,
          actions: data.actions,
          references: data.references,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: uid(),
          role: "assistant",
          content: "Não consegui consultar o assistente agora. Tenta de novo em alguns segundos.",
          source: "fallback",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyAction(action: ProposedAction) {
    const response = await fetch("/api/crm/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action.payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || `Erro ${response.status}`);
    }

    // Refresh CRM state after applying
    onCommandApplied?.();
  }

  function handleDismissAction(actionId: string) {
    // No-op — state is managed inside ActionCard
    void actionId;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-[640px] sm:max-w-[640px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-accent" />
            Assistente Comercial
          </SheetTitle>
          <SheetDescription>
            Analisa leads, sugere ações e propõe mudanças no CRM para você aprovar.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex h-[calc(100vh-7rem)] flex-col gap-4">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Leads: {crmState.leads.length}</Badge>
            <Badge variant="outline">Tarefas: {crmState.tasks.filter((t) => !t.done).length} pendentes</Badge>
            {selectedLeadId ? <Badge variant="gold">Lead em foco</Badge> : null}
          </div>

          {/* Starter prompts */}
          <div className="flex flex-wrap gap-2">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSend(prompt)}
                className="rounded-full border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto rounded-lg border p-3"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6  ${
                  message.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : " text-foreground"
                }`}
              >
                {message.role === "assistant" ? (
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-accent" />
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {message.source === "openrouter" ? "Assistente IA" : "Resposta rápida"}
                    </span>
                  </div>
                ) : null}

                <div className="whitespace-pre-wrap">{message.content}</div>

                {/* Action cards */}
                {message.actions?.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    onApply={handleApplyAction}
                    onDismiss={handleDismissAction}
                  />
                ))}

                {/* Web references */}
                {message.references?.length ? (
                  <div className="mt-3 space-y-2 rounded-xl border bg-background/40 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Referências da web
                    </div>
                    <div className="space-y-2">
                      {message.references.map((ref) => (
                        <a
                          key={`${message.id}-${ref.url}`}
                          href={ref.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-lg border px-3 py-2 text-xs transition-colors hover:bg-muted/60"
                        >
                          <div className="font-medium text-foreground">{ref.title}</div>
                          {ref.snippet ? (
                            <div className="mt-1 text-muted-foreground">{ref.snippet}</div>
                          ) : null}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}

            {loading ? (
              <div className="flex max-w-[92%] items-center gap-2 rounded-2xl px-4 py-3 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Analisando o CRM...
              </div>
            ) : null}
          </div>

          {/* Input */}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Pergunte sobre leads, tarefas ou peça uma análise..."
            />
            <Button type="submit" size="icon" disabled={loading || !draft.trim()}>
              <SendHorizontal className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function uid() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
