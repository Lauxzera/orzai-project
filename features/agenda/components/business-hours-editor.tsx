"use client";

import * as React from "react";
import { LoaderCircle, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { parseBusinessHours, type BusinessHoursConfig } from "@/features/agenda/lib/slots";
import type { AgendaDepartment } from "@/features/agenda/lib/types";

const WEEKDAYS: Array<{ key: string; label: string }> = [
  { key: "0", label: "Domingo" },
  { key: "1", label: "Segunda" },
  { key: "2", label: "Terça" },
  { key: "3", label: "Quarta" },
  { key: "4", label: "Quinta" },
  { key: "5", label: "Sexta" },
  { key: "6", label: "Sábado" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: AgendaDepartment[];
  onSaveDepartmentHours: (departmentId: string, businessHours: BusinessHoursConfig) => Promise<void>;
  onSaveProfessionalHours: (professionalId: string, businessHours: BusinessHoursConfig | null) => Promise<void>;
  onCreateProfessional: (departmentId: string, name: string) => Promise<void>;
  onToggleProfessional: (professionalId: string, active: boolean) => Promise<void>;
};

export function BusinessHoursEditor({
  open,
  onOpenChange,
  departments,
  onSaveDepartmentHours,
  onSaveProfessionalHours,
  onCreateProfessional,
  onToggleProfessional,
}: Props) {
  const [departmentId, setDepartmentId] = React.useState("");
  const [professionalId, setProfessionalId] = React.useState("");
  const [inheritFromDepartment, setInheritFromDepartment] = React.useState(true);
  const [draft, setDraft] = React.useState<BusinessHoursConfig | null>(null);
  const [newProfessionalName, setNewProfessionalName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [creatingProfessional, setCreatingProfessional] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ kind: "success" | "error"; message: string } | null>(null);

  const department = departments.find((item) => item.id === departmentId) ?? null;
  const professional = department?.professionals.find((item) => item.id === professionalId) ?? null;

  React.useEffect(() => {
    if (!open) return;
    setDepartmentId((current) => current || (departments[0]?.id ?? ""));
    setProfessionalId("");
    setFeedback(null);
    // `departments` fica fora das deps de propósito: recarregar a lista após
    // salvar não deve resetar a seleção nem apagar o feedback de sucesso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, departments.length]);

  // Depende só dos IDs selecionados: recarregar a lista de setores (após salvar)
  // não deve resetar o rascunho nem apagar o feedback de sucesso.
  React.useEffect(() => {
    if (!department) {
      setDraft(null);
      return;
    }
    if (professional) {
      const hasOwnHours = Boolean(professional.businessHours);
      setInheritFromDepartment(!hasOwnHours);
      setDraft(parseBusinessHours(hasOwnHours ? professional.businessHours : department.businessHours));
    } else {
      setInheritFromDepartment(true);
      setDraft(parseBusinessHours(department.businessHours));
    }
    setFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, professionalId, departments.length]);

  function updateDraft(mutate: (config: BusinessHoursConfig) => BusinessHoursConfig) {
    setDraft((current) => (current ? mutate(current) : current));
  }

  function setDayEnabled(dayKey: string, enabled: boolean) {
    updateDraft((config) => ({
      ...config,
      weekly: { ...config.weekly, [dayKey]: enabled ? [{ start: "09:00", end: "18:00" }] : [] },
    }));
  }

  function updateRange(dayKey: string, index: number, field: "start" | "end", value: string) {
    updateDraft((config) => {
      const ranges = [...(config.weekly[dayKey] ?? [])];
      ranges[index] = { ...ranges[index], [field]: value };
      return { ...config, weekly: { ...config.weekly, [dayKey]: ranges } };
    });
  }

  function addRange(dayKey: string) {
    updateDraft((config) => ({
      ...config,
      weekly: { ...config.weekly, [dayKey]: [...(config.weekly[dayKey] ?? []), { start: "14:00", end: "18:00" }] },
    }));
  }

  function removeRange(dayKey: string, index: number) {
    updateDraft((config) => {
      const ranges = (config.weekly[dayKey] ?? []).filter((_, rangeIndex) => rangeIndex !== index);
      return { ...config, weekly: { ...config.weekly, [dayKey]: ranges } };
    });
  }

  async function handleSave() {
    if (!department || !draft) return;
    setSaving(true);
    setFeedback(null);
    try {
      if (professional) {
        await onSaveProfessionalHours(professional.id, inheritFromDepartment ? null : draft);
      } else {
        await onSaveDepartmentHours(department.id, draft);
      }
      setFeedback({ kind: "success", message: "Horários salvos com sucesso." });
    } catch (saveError) {
      setFeedback({
        kind: "error",
        message: saveError instanceof Error ? saveError.message : "Não foi possível salvar os horários.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateProfessional() {
    if (!department || !newProfessionalName.trim()) return;
    setCreatingProfessional(true);
    try {
      await onCreateProfessional(department.id, newProfessionalName.trim());
      setNewProfessionalName("");
    } finally {
      setCreatingProfessional(false);
    }
  }

  const showRanges = draft && (!professional || !inheritFromDepartment);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-xl">
        <SheetHeader>
          <SheetTitle>Configurar horários</SheetTitle>
          <SheetDescription>Horário de funcionamento por setor, com exceção opcional por profissional.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Setor</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={departmentId}
                onChange={(event) => {
                  setDepartmentId(event.target.value);
                  setProfessionalId("");
                }}
              >
                {departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Profissional</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={professionalId}
                onChange={(event) => setProfessionalId(event.target.value)}
              >
                <option value="">Horário do setor</option>
                {(department?.professionals ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {professional ? (
            <label className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Herdar horário do setor</p>
                <p className="text-xs text-muted-foreground">Desative para definir um horário próprio para {professional.name}.</p>
              </div>
              <Switch checked={inheritFromDepartment} onCheckedChange={setInheritFromDepartment} />
            </label>
          ) : null}

          {showRanges && draft ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Duração do atendimento (min)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={480}
                    value={draft.slotMinutes}
                    onChange={(event) =>
                      updateDraft((config) => ({ ...config, slotMinutes: Number(event.target.value) || config.slotMinutes }))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Intervalo entre atendimentos (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={draft.bufferMinutes}
                    onChange={(event) => updateDraft((config) => ({ ...config, bufferMinutes: Number(event.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                {WEEKDAYS.map((weekday) => {
                  const ranges = draft.weekly[weekday.key] ?? [];
                  const enabled = ranges.length > 0;
                  return (
                    <div key={weekday.key} className="rounded-xl border border-border px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{weekday.label}</p>
                        <Switch checked={enabled} onCheckedChange={(checked) => setDayEnabled(weekday.key, checked)} />
                      </div>
                      {enabled ? (
                        <div className="mt-2 grid gap-2">
                          {ranges.map((range, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Input
                                type="time"
                                className="h-8 w-28"
                                value={range.start}
                                onChange={(event) => updateRange(weekday.key, index, "start", event.target.value)}
                              />
                              <span className="text-xs text-muted-foreground">até</span>
                              <Input
                                type="time"
                                className="h-8 w-28"
                                value={range.end}
                                onChange={(event) => updateRange(weekday.key, index, "end", event.target.value)}
                              />
                              {ranges.length > 1 ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => removeRange(weekday.key, index)}
                                  aria-label="Remover faixa"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              ) : null}
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" className="w-fit" onClick={() => addRange(weekday.key)}>
                            <Plus className="h-3.5 w-3.5" />
                            Adicionar faixa
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {feedback ? (
            <p
              className={
                feedback.kind === "success"
                  ? "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400"
                  : "rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              }
            >
              {feedback.message}
            </p>
          ) : null}

          <Button onClick={() => void handleSave()} disabled={saving || !draft}>
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Salvar horários
          </Button>

          {department ? (
            <div className="grid gap-2 border-t border-border pt-4">
              <Label>Profissionais de {department.name}</Label>
              {(department.professionals ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5">
                  <p className="text-sm font-medium">{item.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{item.active === false ? "Inativo" : "Ativo"}</span>
                    <Switch
                      checked={item.active !== false}
                      onCheckedChange={(checked) => void onToggleProfessional(item.id, checked)}
                    />
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newProfessionalName}
                  onChange={(event) => setNewProfessionalName(event.target.value)}
                  placeholder="Nome do novo profissional..."
                />
                <Button
                  variant="outline"
                  onClick={() => void handleCreateProfessional()}
                  disabled={creatingProfessional || !newProfessionalName.trim()}
                >
                  {creatingProfessional ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Adicionar
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
