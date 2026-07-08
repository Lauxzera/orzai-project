"use client";

import * as React from "react";
import { FolderKanban, FolderPlus, Layers3, PencilLine, Search, Sparkles, Tags, Trash2, Upload, UsersRound, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { EmptyState } from "@/features/app-shell/components/page-primitives";
import {
  formatDateTime,
  leadListColors,
  type CrmState,
  type Lead,
  type LeadList,
  type LeadListColor,
} from "@/lib/crm";
import { cn } from "@/lib/utils";

type ListDraft = {
  name: string;
  description: string;
  color: LeadListColor;
  leadIds: string[];
};

type LeadListImportSummary = {
  listName: string;
  matched: number;
  unmatched: number;
  rowsRead: number;
  duplicates: number;
};

type Props = {
  state: CrmState;
  availableLeads: Lead[];
  canEdit: boolean;
  importing: boolean;
  importSummary: string;
  onCreateList: (draft: ListDraft) => Promise<void>;
  onUpdateList: (listId: string, draft: ListDraft) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onImportList: (
    file: File,
    options: { listId?: string | null; listName: string; description: string; color: LeadListColor }
  ) => Promise<LeadListImportSummary>;
  onOpenLead: (leadId: string) => void;
  onOpenMessages: (leadId?: string | null) => void;
};

const blankDraft: ListDraft = {
  name: "",
  description: "",
  color: "blue",
  leadIds: [],
};

const colorMap: Record<LeadListColor, string> = {
  slate: "bg-slate-500/15 text-slate-700 border-slate-500/20 dark:text-slate-200",
  blue: "bg-blue-500/15 text-blue-700 border-blue-500/20 dark:text-blue-200",
  violet: "bg-violet-500/15 text-violet-700 border-violet-500/20 dark:text-violet-200",
  emerald: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20 dark:text-emerald-200",
  amber: "bg-amber-500/15 text-amber-700 border-amber-500/20 dark:text-amber-200",
  rose: "bg-rose-500/15 text-rose-700 border-rose-500/20 dark:text-rose-200",
};

const colorDotMap: Record<LeadListColor, string> = {
  slate: "bg-slate-400 ring-4 ring-slate-400/16",
  blue: "bg-blue-400 ring-4 ring-blue-400/16",
  violet: "bg-violet-400 ring-4 ring-violet-400/16",
  emerald: "bg-emerald-400 ring-4 ring-emerald-400/16",
  amber: "bg-amber-400 ring-4 ring-amber-400/18",
  rose: "bg-rose-400 ring-4 ring-rose-400/16",
};

export function LeadListsView({
  state,
  availableLeads,
  canEdit,
  importing,
  importSummary,
  onCreateList,
  onUpdateList,
  onDeleteList,
  onImportList,
  onOpenLead,
  onOpenMessages,
}: Props) {
  const [selectedListId, setSelectedListId] = React.useState<string | null>(state.leadLists[0]?.id ?? null);
  const [draft, setDraft] = React.useState<ListDraft>(blankDraft);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createLeadIds, setCreateLeadIds] = React.useState<string[]>([]);
  const [importOpen, setImportOpen] = React.useState(false);
  const importInputRef = React.useRef<HTMLInputElement | null>(null);
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [importDraft, setImportDraft] = React.useState({
    listId: "new",
    listName: "",
    description: "",
    color: "blue" as LeadListColor,
  });

  React.useEffect(() => {
    if (!state.leadLists.length) {
      setSelectedListId(null);
      setDraft(blankDraft);
      return;
    }
    if (!selectedListId || !state.leadLists.some((list) => list.id === selectedListId)) {
      setSelectedListId(state.leadLists[0].id);
    }
  }, [selectedListId, state.leadLists]);

  const selectedList = React.useMemo(
    () => state.leadLists.find((list) => list.id === selectedListId) ?? null,
    [selectedListId, state.leadLists]
  );

  React.useEffect(() => {
    if (!selectedList) {
      setDraft(blankDraft);
      return;
    }
    setDraft({
      name: selectedList.name,
      description: selectedList.description,
      color: selectedList.color,
      leadIds: selectedList.leadIds,
    });
  }, [selectedList]);

  React.useEffect(() => {
    if (!createOpen) return;
    setCreateLeadIds(availableLeads.map((lead) => lead.id));
  }, [availableLeads, createOpen]);

  const coverage = React.useMemo(() => {
    const unique = new Set(state.leadLists.flatMap((list) => list.leadIds));
    return unique.size;
  }, [state.leadLists]);

  async function handleCreate() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await onCreateList({
        name: importDraft.listName.trim() || "Nova lista",
        description: importDraft.description.trim(),
        color: importDraft.color,
        leadIds: createLeadIds,
      });
      setCreateOpen(false);
      setCreateLeadIds([]);
      setImportDraft({ listId: "new", listName: "", description: "", color: "blue" });
      setSuccess("Lista criada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ?err.message : "Não foi possível criar a lista.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSelected() {
    if (!selectedList) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await onUpdateList(selectedList.id, draft);
      setSuccess("Lista atualizada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ?err.message : "Não foi possível atualizar a lista.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSelected() {
    if (!selectedList) return;
    if (!window.confirm(`Excluir a lista "${selectedList.name}"? `)) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await onDeleteList(selectedList.id);
      setSuccess("Lista removida com sucesso.");
    } catch (err) {
      setError(err instanceof Error ?err.message : "Não foi possível excluir a lista.");
    } finally {
      setSaving(false);
    }
  }

  async function handleImport() {
    if (!importFile) {
      setError("Selecione um arquivo para importar.");
      return;
    }
    setError("");
    setSuccess("");
    try {
      const result = await onImportList(importFile, {
        listId: importDraft.listId === "new" ? null : importDraft.listId,
        listName: importDraft.listId === "new" ?importDraft.listName.trim() : "",
        description: importDraft.description.trim(),
        color: importDraft.color,
      });
      setImportOpen(false);
      setImportFile(null);
      if (importInputRef.current) importInputRef.current.value = "";
      setImportDraft({ listId: "new", listName: "", description: "", color: "blue" });
      setSuccess(
        `Importação concluída: ${result.matched} lead(s) vinculados em "${result.listName}". ${result.unmatched} não localizado(s).`
      );
    } catch (err) {
      setError(err instanceof Error ?err.message : "Não foi possível importar a lista.");
    }
  }

  function mergeVisibleLeads() {
    if (!selectedList) return;
    const nextIds = [...new Set([...draft.leadIds, ...availableLeads.map((lead) => lead.id)])];
    setDraft((current) => ({ ...current, leadIds: nextIds }));
  }

  function toggleCreateLead(leadId: string) {
    setCreateLeadIds((current) =>
      current.includes(leadId) ?current.filter((id) => id !== leadId) : [...current, leadId]
    );
  }

  function toggleDraftLead(leadId: string) {
    setDraft((current) => ({
      ...current,
      leadIds: current.leadIds.includes(leadId)
        ? current.leadIds.filter((id) => id !== leadId)
        : [...current.leadIds, leadId],
    }));
  }

  return (
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-2xl border">
        <div className="relative grid gap-5 p-6 lg:p-8">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent dark:from-primary/10 dark:via-background dark:to-background" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Segmentação comercial</Badge>
                <Badge variant="gold">Listas de leads</Badge>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Carteiras de leads
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Organize públicos para campanhas, atendimento e rotinas comerciais sem perder o controle de quem entra em cada carteira.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[620px]">
              <Metric icon={FolderKanban} label="Listas ativas" value={String(state.leadLists.length)} hint="Segmentos organizados no CRM" tone="primary" />
              <Metric icon={UsersRound} label="Leads cobertos" value={String(coverage)} hint="Pelo menos uma lista" tone="success" />
              <Metric icon={Layers3} label="Leads filtrados" value={String(availableLeads.length)} hint="Disponíveis para adicionar agora" tone="neutral" />
            </div>
          </div>

          <div className="relative flex flex-col justify-between gap-4 rounded-xl border bg-background p-5 lg:flex-row lg:items-center">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold">Ações rápidas da carteira</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Crie listas manuais, importe bases externas e mantenha públicos prontos para operação e disparos.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl" disabled={!canEdit}>
                    <FolderPlus className="h-4 w-4" />
                    Nova lista
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar lista</DialogTitle>
                    <DialogDescription>
                      Monte uma nova carteira e, se quiser, já comece com os leads filtrados na tela.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4">
                    <LeadListForm
                      draft={importDraft}
                      onDraftChange={(partial) => setImportDraft((current) => ({ ...current, ...partial }))}
                      showListSelector={false}
                    />
                    <p className="text-xs text-muted-foreground">
                      Escolha quais dos {availableLeads.length} lead(s) visíveis devem entrar na nova lista.
                    </p>
                    <LeadMembershipPicker
                      leads={availableLeads}
                      selectedLeadIds={createLeadIds}
                      onToggleLead={toggleCreateLead}
                      onOpenLead={onOpenLead}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={() => void handleCreate()} disabled={saving}>
                      {saving ? "Criando..." : "Criar lista"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl" variant="outline" disabled={!canEdit}>
                    <Upload className="h-4 w-4" />
                    Importar lista
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Importar membros para lista</DialogTitle>
                    <DialogDescription>
                      Envie um CSV, TSV ou TXT com IDs, nomes, telefones ou emails para montar uma carteira mais rápido.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4">
                    <LeadListForm
                      draft={importDraft}
                      onDraftChange={(partial) => setImportDraft((current) => ({ ...current, ...partial }))}
                      showListSelector
                      lists={state.leadLists}
                    />
                    <div className="grid gap-2">
                      <Label>Arquivo</Label>
                      <Input
                        ref={importInputRef}
                        type="file"
                        accept=".csv,.tsv,.txt"
                        onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                      />
                      <p className="text-xs text-muted-foreground">
                        O arquivo pode ter uma coluna com telefone, email, nome ou id do lead. Um item por linha também funciona.
                      </p>
                    </div>
                    {importSummary ? (
                      <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        {importSummary}
                      </p>
                    ) : null}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setImportOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={() => void handleImport()} disabled={importing}>
                      {importing ? "Importando..." : "Importar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </section>

      {error ?<div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</div> : null}
      {success ?<div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{success}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <Card className="overflow-hidden rounded-2xl border">
          <CardContent className="grid gap-3 p-4">
            <div className="rounded-2xl border bg-background/55 px-4 py-3">
              <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Tags className="h-3.5 w-3.5" />
                Listas salvas
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Selecione uma carteira para editar seus membros.</p>
            </div>
            {state.leadLists.length === 0 ? (
              <EmptyState text="Nenhuma lista criada ainda. Use os filtros atuais para montar a primeira." />
            ) : (
              state.leadLists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setSelectedListId(list.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border px-4 py-4 text-left transition hover:border-primary/25 hover:bg-muted/50",
                    selectedListId === list.id && "border-primary/30 bg-primary/8 shadow-[inset_4px_0_0_var(--primary)]"
                  )}
                >
                  <span className={cn("absolute right-3 top-3 h-2 w-2 rounded-full", colorDotMap[list.color])} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 pr-4">
                      <p className="truncate text-sm font-semibold">{list.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{list.description || "Sem descrição."}</p>
                    </div>
                    <Badge variant="outline" className={cn("mt-4 shrink-0 rounded-full", colorMap[list.color])}>
                      {list.leadIds.length}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <UsersRound className="h-3 w-3" />
                      {list.leadIds.length} lead(s)
                    </span>
                    <span>{formatDateTime(list.updatedAt)}</span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border">
          <CardContent className="grid gap-4 p-5">
            {!selectedList ? (
              <EmptyState text="Selecione uma lista para editar seus membros e acompanhar a carteira." />
            ) : (
              <>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="rounded-3xl border bg-background/55 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn(colorMap[draft.color])}>
                        {draft.color}
                      </Badge>
                      <Badge variant="outline">{draft.leadIds.length} lead(s)</Badge>
                        <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          Carteira selecionada
                        </Badge>
                      </div>
                      <h3 className="mt-3 truncate text-xl font-semibold tracking-tight">{draft.name || "Lista sem nome"}</h3>
                      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                        Ajuste o nome, a cor, a descrição e os leads vinculados a esta carteira.
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Nome da lista</Label>
                        <Input
                          value={draft.name}
                          disabled={!canEdit}
                          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Cor</Label>
                        <Select
                          value={draft.color}
                          onValueChange={(value: LeadListColor) => setDraft((current) => ({ ...current, color: value }))}
                          disabled={!canEdit}
                        >
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
                    </div>
                    <div className="grid gap-2">
                      <Label>Descrição</Label>
                      <Textarea
                        value={draft.description}
                        disabled={!canEdit}
                        onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                        className="min-h-24"
                      />
                    </div>
                    <LeadMembershipPicker
                      leads={availableLeads}
                      selectedLeadIds={draft.leadIds}
                      onToggleLead={toggleDraftLead}
                      onOpenLead={onOpenLead}
                      title="Adicionar ou remover leads da lista"
                      description="Use os leads filtrados na tela para montar ou ajustar essa carteira."
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 rounded-2xl border bg-background/55 p-3 xl:w-[210px] xl:flex-col">
                    <Button className="justify-start rounded-xl" variant="outline" onClick={mergeVisibleLeads} disabled={!canEdit || availableLeads.length === 0}>
                      <WandSparkles className="h-4 w-4" />
                      Adicionar filtrados
                    </Button>
                    <Button className="justify-start rounded-xl" variant="outline" onClick={handleSaveSelected} disabled={!canEdit || saving}>
                      <PencilLine className="h-4 w-4" />
                      Salvar lista
                    </Button>
                    <Button className="justify-start rounded-xl" variant="outline" onClick={handleDeleteSelected} disabled={!canEdit || saving}>
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof FolderKanban;
  label: string;
  value: string;
  hint: string;
  tone: "primary" | "success" | "neutral";
}) {
  const toneClassName =
    tone === "primary"
      ? "border-primary/20 bg-primary/8 text-primary"
      : tone === "success"
        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "  text-muted-foreground";

  return (
    <div className={`rounded-2xl border p-4 ${toneClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">{label}</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-80">{hint}</p>
        </div>
        <div className="rounded-xl border border-current/15 bg-background/70 p-2">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function LeadListForm({
  draft,
  onDraftChange,
  showListSelector,
  lists = [],
}: {
  draft: { listId: string; listName: string; description: string; color: LeadListColor };
  onDraftChange: (partial: Partial<{ listId: string; listName: string; description: string; color: LeadListColor }>) => void;
  showListSelector: boolean;
  lists?: LeadList[];
}) {
  return (
    <div className="grid gap-4">
      {showListSelector ? (
        <div className="grid gap-2">
          <Label>Destino</Label>
          <Select value={draft.listId} onValueChange={(value) => onDraftChange({ listId: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">Criar nova lista</SelectItem>
              {lists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {draft.listId === "new" ? (
        <>
          <div className="grid gap-2">
            <Label>Nome da lista</Label>
            <Input value={draft.listName} onChange={(event) => onDraftChange({ listName: event.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Textarea value={draft.description} onChange={(event) => onDraftChange({ description: event.target.value })} className="min-h-24" />
          </div>
          <div className="grid gap-2">
            <Label>Cor</Label>
            <Select value={draft.color} onValueChange={(value: LeadListColor) => onDraftChange({ color: value })}>
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
      ) : null}
    </div>
  );
}

function LeadMembershipPicker({
  leads,
  selectedLeadIds,
  onToggleLead,
  onOpenLead,
  title = "Leads da lista",
  description = "Selecione os leads que devem compor esta lista.",
}: {
  leads: Lead[];
  selectedLeadIds: string[];
  onToggleLead: (leadId: string) => void;
  onOpenLead: (leadId: string) => void;
  title?: string;
  description?: string;
}) {
  const [query, setQuery] = React.useState("");
  const term = query.trim().toLowerCase();

  const visibleLeads = React.useMemo(() => {
    if (!term) return leads;
    return leads.filter((lead) =>
      [lead.nome, lead.telefone, lead.curso_de_interesse, lead.responsavel, lead.cidade]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [leads, term]);

  function selectVisible() {
    for (const lead of visibleLeads) {
      if (!selectedLeadIds.includes(lead.id)) onToggleLead(lead.id);
    }
  }

  function clearVisible() {
    for (const lead of visibleLeads) {
      if (selectedLeadIds.includes(lead.id)) onToggleLead(lead.id);
    }
  }

  return (
    <div className="grid gap-3 rounded-3xl border p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            <span className="h-2 w-2 rounded-full bg-primary ring-4 ring-primary/12" />
            {title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className="shrink-0 rounded-full border-primary/20 bg-primary/10 text-primary">
          {selectedLeadIds.length} selecionado(s)
        </Badge>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="rounded-xl bg-background/70 pl-9"
            placeholder="Buscar lead por nome, telefone, curso..."
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={selectVisible}>
            Selecionar visíveis
          </Button>
          <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={clearVisible}>
            Limpar visíveis
          </Button>
        </div>
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto crm-scrollbar pr-1">
        {visibleLeads.length === 0 ? (
          <p className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
            Nenhum lead encontrado com esse filtro.
          </p>
        ) : (
          visibleLeads.map((lead) => {
            const selected = selectedLeadIds.includes(lead.id);
            return (
              <div
                key={lead.id}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-2xl border px-3 py-3 transition-colors",
                  selected ? "border-primary/30 bg-primary/10" : " bg-background/60 hover:bg-muted/50"
                )}
              >
                <button type="button" onClick={() => onToggleLead(lead.id)} className="min-w-0 flex-1 text-left">
                  <p className="inline-flex max-w-full items-center gap-2 truncate text-sm font-semibold">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", selected ? "bg-primary" : "bg-slate-300 dark:bg-slate-600")} />
                    <span className="truncate">{lead.nome}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lead.telefone} · {lead.curso_de_interesse} · {lead.responsavel}
                  </p>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl px-2.5 text-xs" onClick={() => onOpenLead(lead.id)}>
                    Visualizar lead
                  </Button>
                  <Badge variant={selected ? "default" : "outline"} className="rounded-full">
                    {selected ? "Na lista" : "Adicionar"}
                  </Badge>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
