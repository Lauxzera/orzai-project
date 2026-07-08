"use client";

import * as React from "react";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SmoothInput as Input } from "@/components/ui/smooth-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { leadListColors, type Lead, type LeadList, type LeadListColor } from "@/lib/crm";

type LeadListDraft = {
  name: string;
  description: string;
  color: LeadListColor;
  leadIds: string[];
};

type Props = {
  lead: Lead;
  leadLists: LeadList[];
  canEdit: boolean;
  onAddToList: (listId: string, leadId: string) => Promise<void>;
  onCreateList: (draft: LeadListDraft) => Promise<void>;
  buttonLabel?: string;
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
  buttonSize?: React.ComponentProps<typeof Button>["size"];
  className?: string;
};

export function AddToLeadListDialog({
  lead,
  leadLists,
  canEdit,
  onAddToList,
  onCreateList,
  buttonLabel = "Adicionar a lista",
  buttonVariant = "outline",
  buttonSize = "sm",
  className,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"existing" | "new">(leadLists.length ? "existing" : "new");
  const [selectedListId, setSelectedListId] = React.useState(leadLists[0]?.id ?? "");
  const [newListName, setNewListName] = React.useState("");
  const [newListDescription, setNewListDescription] = React.useState("");
  const [newListColor, setNewListColor] = React.useState<LeadListColor>("blue");
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!leadLists.length) {
      setMode("new");
      setSelectedListId("");
      return;
    }
    if (!selectedListId || !leadLists.some((list) => list.id === selectedListId)) {
      setSelectedListId(leadLists[0].id);
    }
  }, [leadLists, selectedListId]);

  React.useEffect(() => {
    if (!open) {
      setFeedback("");
      setError("");
      setSaving(false);
    }
  }, [open]);

  async function handleSubmit() {
    if (!canEdit) return;
    setSaving(true);
    setError("");
    setFeedback("");

    try {
      if (mode === "existing") {
        if (!selectedListId) {
          throw new Error("Selecione uma lista para continuar.");
        }
        await onAddToList(selectedListId, lead.id);
        const listName = leadLists.find((list) => list.id === selectedListId)?.name ?? "lista";
        setFeedback(`Lead adicionado em "${listName}".`);
      } else {
        const trimmedName = newListName.trim();
        if (!trimmedName) {
          throw new Error("Informe um nome para a nova lista.");
        }
        await onCreateList({
          name: trimmedName,
          description: newListDescription.trim(),
          color: newListColor,
          leadIds: [lead.id],
        });
        setFeedback(`Lista "${trimmedName}" criada com o lead adicionado.`);
        setNewListName("");
        setNewListDescription("");
        setNewListColor("blue");
      }

      window.setTimeout(() => setOpen(false), 700);
    } catch (submissionError) {
      setError(submissionError instanceof Error ?submissionError.message : "Nao foi possivel adicionar o lead a lista.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size={buttonSize}
          variant={buttonVariant}
          className={className}
          disabled={!canEdit}
        >
          <FolderPlus className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar lead a uma lista</DialogTitle>
          <DialogDescription>
            Organize {lead.nome} em uma lista existente ou crie uma nova carteira para esse contato.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Destino</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "existing" ? "default" : "outline"}
                onClick={() => setMode("existing")}
                disabled={!leadLists.length}
              >
                Lista existente
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "new" ? "default" : "outline"}
                onClick={() => setMode("new")}
              >
                Nova lista
              </Button>
            </div>
          </div>

          {mode === "existing" ? (
            <div className="grid gap-2">
              <Label>Lista</Label>
              <Select value={selectedListId} onValueChange={setSelectedListId} disabled={!leadLists.length}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma lista" />
                </SelectTrigger>
                <SelectContent>
                  {leadLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!leadLists.length ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma lista criada ainda. Use a opcao de nova lista para comecar.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                <Label>Nome da lista</Label>
                <Input value={newListName} onChange={(event) => setNewListName(event.target.value)} placeholder="Ex.: Leads da semana" />
              </div>
              <div className="grid gap-2">
                <Label>Descricao</Label>
                <Textarea
                  value={newListDescription}
                  onChange={(event) => setNewListDescription(event.target.value)}
                  placeholder="Descreva o objetivo dessa lista."
                  className="min-h-24"
                />
              </div>
              <div className="grid gap-2">
                <Label>Cor</Label>
                <Select value={newListColor} onValueChange={(value: LeadListColor) => setNewListColor(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {leadListColors.map((color) => (
                      <SelectItem key={color} value={color}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {error ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          {feedback ? (
            <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {feedback}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
