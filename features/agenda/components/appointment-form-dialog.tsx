"use client";

import * as React from "react";
import { format } from "date-fns";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getFreeSlotsForDay } from "@/features/agenda/lib/slots";
import type { AgendaAppointment, AgendaDepartment, AgendaTimeBlock } from "@/features/agenda/lib/types";
import type { Lead } from "@/lib/crm";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: AgendaDepartment[];
  leads: Lead[];
  appointments: AgendaAppointment[];
  timeBlocks: AgendaTimeBlock[];
  /** Se presente, o dialog opera em modo reagendamento. */
  reschedulingAppointment: AgendaAppointment | null;
  defaultDate?: Date;
  onSubmit: (payload: {
    leadId: string;
    departmentId: string;
    professionalId: string | null;
    startTime: string;
    endTime: string;
    anamnesis: string;
  }) => Promise<void>;
};

export function AppointmentFormDialog({
  open,
  onOpenChange,
  departments,
  leads,
  appointments,
  timeBlocks,
  reschedulingAppointment,
  defaultDate,
  onSubmit,
}: Props) {
  const isRescheduling = Boolean(reschedulingAppointment);

  const [leadSearch, setLeadSearch] = React.useState("");
  const [leadId, setLeadId] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("");
  const [professionalId, setProfessionalId] = React.useState("");
  const [date, setDate] = React.useState("");
  const [selectedSlot, setSelectedSlot] = React.useState<{ start: string; end: string } | null>(null);
  const [anamnesis, setAnamnesis] = React.useState("");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setError("");
    setSelectedSlot(null);
    setSaving(false);
    if (reschedulingAppointment) {
      setLeadId(reschedulingAppointment.leadId);
      setLeadSearch(reschedulingAppointment.leadName);
      setDepartmentId(reschedulingAppointment.departmentId);
      setProfessionalId(reschedulingAppointment.professionalId ?? "");
      setDate(format(new Date(reschedulingAppointment.startTime), "yyyy-MM-dd"));
      setAnamnesis(reschedulingAppointment.notes ?? "");
    } else {
      setLeadId("");
      setLeadSearch("");
      setDepartmentId(departments[0]?.id ?? "");
      setProfessionalId("");
      setDate(format(defaultDate ?? new Date(), "yyyy-MM-dd"));
      setAnamnesis("");
    }
  }, [open, reschedulingAppointment, departments, defaultDate]);

  const department = departments.find((item) => item.id === departmentId) ?? null;
  const professionals = department?.professionals ?? [];
  const professional = professionals.find((item) => item.id === professionalId) ?? null;

  const filteredLeads = React.useMemo(() => {
    const term = leadSearch.trim().toLowerCase();
    if (!term) return leads.slice(0, 8);
    return leads
      .filter((lead) => [lead.nome, lead.telefone, lead.email].some((value) => value?.toLowerCase().includes(term)))
      .slice(0, 8);
  }, [leadSearch, leads]);

  const freeSlots = React.useMemo(() => {
    if (!date || !department) return [];
    const busy = [
      ...appointments
        .filter((appointment) => {
          if (appointment.status === "CANCELLED") return false;
          if (reschedulingAppointment && appointment.id === reschedulingAppointment.id) return false;
          if (appointment.departmentId !== department.id) return false;
          if (professionalId && appointment.professionalId && appointment.professionalId !== professionalId) return false;
          return true;
        })
        .map((appointment) => ({ startTime: appointment.startTime, endTime: appointment.endTime })),
      ...timeBlocks
        .filter((block) => {
          if (block.departmentId !== department.id) return false;
          if (professionalId && block.professionalId && block.professionalId !== professionalId) return false;
          return true;
        })
        .map((block) => ({ startTime: block.startTime, endTime: block.endTime })),
    ];

    return getFreeSlotsForDay({
      date,
      departmentHours: department.businessHours,
      professionalHours: professional?.businessHours ?? undefined,
      busy,
    });
  }, [date, department, professional, professionalId, appointments, timeBlocks, reschedulingAppointment]);

  async function handleSubmit() {
    setError("");
    if (!isRescheduling && !leadId) {
      setError("Selecione um lead.");
      return;
    }
    if (!departmentId) {
      setError("Selecione um setor.");
      return;
    }
    if (!selectedSlot) {
      setError("Selecione um horário disponível.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        leadId,
        departmentId,
        professionalId: professionalId || null,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        anamnesis: anamnesis.trim(),
      });
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível salvar o agendamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isRescheduling ? "Reagendar horário" : "Novo agendamento"}</DialogTitle>
          <DialogDescription>
            {isRescheduling
              ? `Escolha o novo horário para ${reschedulingAppointment?.leadName}.`
              : "Escolha o lead, o setor e um horário disponível."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {!isRescheduling ? (
            <div className="grid gap-1.5">
              <Label>Lead</Label>
              <Input
                value={leadSearch}
                onChange={(event) => {
                  setLeadSearch(event.target.value);
                  setLeadId("");
                }}
                placeholder="Buscar lead por nome, telefone ou e-mail..."
              />
              {!leadId && leadSearch.trim() ? (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-border">
                  {filteredLeads.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum lead encontrado.</p>
                  ) : (
                    filteredLeads.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                        onClick={() => {
                          setLeadId(lead.id);
                          setLeadSearch(lead.nome);
                        }}
                      >
                        <span className="font-medium">{lead.nome}</span>
                        <span className="text-xs text-muted-foreground">{lead.telefone}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Setor</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={departmentId}
                onChange={(event) => {
                  setDepartmentId(event.target.value);
                  setProfessionalId("");
                  setSelectedSlot(null);
                }}
                disabled={isRescheduling}
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
                onChange={(event) => {
                  setProfessionalId(event.target.value);
                  setSelectedSlot(null);
                }}
              >
                <option value="">Qualquer profissional</option>
                {professionals.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Data</Label>
            <Input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setSelectedSlot(null);
              }}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Horários disponíveis</Label>
            {freeSlots.length === 0 ? (
              <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Nenhum horário livre nesse dia. Tente outra data ou profissional.
              </p>
            ) : (
              <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                {freeSlots.map((slot) => {
                  const value = { start: slot.start.toISOString(), end: slot.end.toISOString() };
                  const selected = selectedSlot?.start === value.start;
                  return (
                    <button
                      key={value.start}
                      type="button"
                      onClick={() => setSelectedSlot(value)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:border-primary/40 hover:bg-primary/5",
                      )}
                    >
                      {format(slot.start, "HH:mm")}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {!isRescheduling ? (
            <div className="grid gap-1.5">
              <Label>Motivo da visita (anamnese)</Label>
              <Textarea
                value={anamnesis}
                onChange={(event) => setAnamnesis(event.target.value)}
                placeholder="Ex.: Avaliação para design de sobrancelhas..."
                rows={3}
              />
              <p className="text-[11px] text-muted-foreground">
                Fica registrado no agendamento e no histórico interno do lead. Não sai do CRM.
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={saving}>
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {isRescheduling ? "Reagendar" : "Agendar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
