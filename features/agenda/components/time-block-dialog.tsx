"use client";

import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AgendaDepartment, AgendaTimeBlock } from "@/features/agenda/lib/types";

const REASON_PRESETS = ["Folga", "Feriado", "Almoço"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: AgendaDepartment[];
  timeBlocks: AgendaTimeBlock[];
  defaultDate?: Date;
  onCreate: (payload: {
    departmentId: string;
    professionalId: string | null;
    startTime: string;
    endTime: string;
    reason: string;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function TimeBlockDialog({ open, onOpenChange, departments, timeBlocks, defaultDate, onCreate, onDelete }: Props) {
  const [departmentId, setDepartmentId] = React.useState("");
  const [professionalId, setProfessionalId] = React.useState("");
  const [date, setDate] = React.useState("");
  const [allDay, setAllDay] = React.useState(false);
  const [startTime, setStartTime] = React.useState("12:00");
  const [endTime, setEndTime] = React.useState("13:00");
  const [reason, setReason] = React.useState("Folga");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setDepartmentId(departments[0]?.id ?? "");
    setProfessionalId("");
    setDate(format(defaultDate ?? new Date(), "yyyy-MM-dd"));
    setAllDay(false);
    setStartTime("12:00");
    setEndTime("13:00");
    setReason("Folga");
    setError("");
    setSaving(false);
  }, [open, departments, defaultDate]);

  const department = departments.find((item) => item.id === departmentId) ?? null;
  const professionals = department?.professionals ?? [];

  async function handleCreate() {
    setError("");
    if (!departmentId || !date || !reason.trim()) {
      setError("Preencha setor, data e motivo.");
      return;
    }

    const start = allDay ? "00:00" : startTime;
    const end = allDay ? "23:59" : endTime;
    if (!allDay && start >= end) {
      setError("O horário final deve ser depois do inicial.");
      return;
    }

    setSaving(true);
    try {
      await onCreate({
        departmentId,
        professionalId: professionalId || null,
        startTime: new Date(`${date}T${start}:00`).toISOString(),
        endTime: new Date(`${date}T${end}:00`).toISOString(),
        reason: reason.trim(),
      });
      onOpenChange(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível criar o bloqueio.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  }

  const upcomingBlocks = [...timeBlocks].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bloquear horário</DialogTitle>
          <DialogDescription>Folga, feriado ou pausa — o período fica indisponível para agendamento.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
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
                <option value="">Setor inteiro</option>
                {professionals.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Início</Label>
              <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} disabled={allDay} />
            </div>
            <div className="grid gap-1.5">
              <Label>Fim</Label>
              <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} disabled={allDay} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} className="h-4 w-4" />
            Dia inteiro
          </label>

          <div className="grid gap-1.5">
            <Label>Motivo</Label>
            <div className="flex flex-wrap gap-2">
              {REASON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    reason === preset
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:border-primary/40",
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ou descreva o motivo..." />
          </div>

          {error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Fechar
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Bloquear
            </Button>
          </div>

          {upcomingBlocks.length > 0 ? (
            <div className="grid gap-1.5">
              <Label>Bloqueios no período visível</Label>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-border">
                {upcomingBlocks.map((block) => (
                  <div key={block.id} className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2 last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {block.reason}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {block.professionalName ?? "Setor inteiro"}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(block.startTime), "dd/MM HH:mm", { locale: ptBR })} –{" "}
                        {format(new Date(block.endTime), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleDelete(block.id)}
                      disabled={deletingId === block.id}
                      aria-label="Remover bloqueio"
                    >
                      {deletingId === block.id ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
