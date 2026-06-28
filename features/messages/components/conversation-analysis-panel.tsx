"use client";

import * as React from "react";
import { Bot, Check, RefreshCw, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProposedAction } from "@/lib/ai-tools";
import type { Conversation, ConversationAnalysis } from "@/lib/messages";

// ---------------------------------------------------------------------------
// Action card
// ---------------------------------------------------------------------------

type ActionState = "idle" | "applying" | "applied" | "error";

function EnrichActionCard({
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
    upsertLead: "Atualizar campo",
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
      className={`rounded-xl border px-3 py-2.5 text-xs transition-all ${
        state === "applied"
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 shrink-0 text-amber-500 dark:text-amber-400" />
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              {tipoLabel[action.tipo] ?? action.tipo}
            </span>
          </div>
          <p className="mt-1 font-medium text-foreground">{action.descricao}</p>
          <p className="mt-0.5 text-muted-foreground">{action.justificativa}</p>
          {state === "error" && (
            <p className="mt-1 text-red-600 dark:text-red-400">{errorMsg}</p>
          )}
        </div>

        {state === "applied" ? (
          <div className="flex shrink-0 items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Aplicado</span>
          </div>
        ) : (
          <div className="flex shrink-0 gap-1.5">
            <Button
              size="sm"
              variant="default"
              className="h-7 px-2.5 text-xs"
              onClick={handleApply}
              disabled={state === "applying"}
            >
              {state === "applying" ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  Aplicar
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => onDismiss(action.id)}
              disabled={state === "applying"}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

type Props = {
  enrichActions: ProposedAction[];
  enrichLoading: boolean;
  dismissedActionIds: Set<string>;
  onApply: (action: ProposedAction) => Promise<void>;
  onDismiss: (id: string) => void;
  // Legacy props — kept for backward compatibility
  conversation?: Conversation;
  analysis?: ConversationAnalysis | null;
  analysisLoading?: boolean;
  applyingStatus?: boolean;
  canEdit?: boolean;
  onAnalyze?: () => void;
  onApplyStatus?: () => void;
};

export function ConversationAnalysisPanel({
  enrichActions,
  enrichLoading,
  dismissedActionIds,
  onApply,
  onDismiss,
}: Props) {
  const visibleActions = enrichActions.filter((a) => !dismissedActionIds.has(a.id));

  if (!enrichLoading && visibleActions.length === 0) {
    return null;
  }

  return (
    <div className="shrink-0 border-t px-4 py-3">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground">Enriquecimento IA</span>
        {enrichLoading && (
          <RefreshCw className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {enrichLoading && visibleActions.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Analisando conversa...</p>
      ) : (
        <div className="crm-scrollbar mt-2 max-h-48 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
          {visibleActions.map((action) => (
            <EnrichActionCard
              key={action.id}
              action={action}
              onApply={onApply}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}
