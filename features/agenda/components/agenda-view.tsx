"use client";

import * as React from "react";
import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Ban, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, LoaderCircle, Phone, Plus, Settings2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FilterSelect } from "@/features/app-shell/components/page-primitives";
import { AgendaMonthGrid } from "@/features/agenda/components/agenda-month-grid";
import { AgendaTimeGrid } from "@/features/agenda/components/agenda-time-grid";
import { AppointmentFormDialog } from "@/features/agenda/components/appointment-form-dialog";
import { TimeBlockDialog } from "@/features/agenda/components/time-block-dialog";
import { BusinessHoursEditor } from "@/features/agenda/components/business-hours-editor";
import type { AgendaAppointment, AgendaDepartment, AgendaMode, AgendaTimeBlock } from "@/features/agenda/lib/types";
import type { BusinessHoursConfig } from "@/features/agenda/lib/slots";
import { cn } from "@/lib/utils";
import type { Lead, UserRole } from "@/lib/crm";

type Props = {
  allowEdits: boolean;
  currentRole: UserRole;
  leads: Lead[];
};

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error((data && data.error) || "Não foi possível completar a solicitação.");
  }
  return data as T;
}

export function AgendaView({ allowEdits, currentRole, leads }: Props) {
  const canManageSettings = currentRole === "ADMIN" || currentRole === "MANAGER";

  const [mode, setMode] = React.useState<AgendaMode>(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? "day" : "week",
  );
  const [anchorDate, setAnchorDate] = React.useState(() => new Date());
  const [departments, setDepartments] = React.useState<AgendaDepartment[]>([]);
  const [appointments, setAppointments] = React.useState<AgendaAppointment[]>([]);
  const [timeBlocks, setTimeBlocks] = React.useState<AgendaTimeBlock[]>([]);
  const [departmentFilter, setDepartmentFilter] = React.useState("all");
  const [professionalFilter, setProfessionalFilter] = React.useState("all");
  const [showCancelled, setShowCancelled] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [selectedAppointment, setSelectedAppointment] = React.useState<AgendaAppointment | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [rescheduling, setRescheduling] = React.useState<AgendaAppointment | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = React.useState(false);
  const [hoursEditorOpen, setHoursEditorOpen] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  const range = React.useMemo(() => {
    if (mode === "day") {
      const start = new Date(anchorDate);
      start.setHours(0, 0, 0, 0);
      return { start, end: addDays(start, 1) };
    }
    if (mode === "week") {
      const start = startOfWeek(anchorDate, { weekStartsOn: 0 });
      return { start, end: addDays(start, 7) };
    }
    return {
      start: startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 0 }),
      end: addDays(endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 0 }), 1),
    };
  }, [anchorDate, mode]);

  const loadBootstrap = React.useCallback(async () => {
    try {
      const data = await fetchJson<{ departments: AgendaDepartment[] }>("/api/crm/agenda/bootstrap");
      setDepartments(data.departments);
    } catch (bootstrapError) {
      setError(bootstrapError instanceof Error ? bootstrapError.message : "Não foi possível carregar os setores.");
    }
  }, []);

  const loadAppointments = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      });
      if (departmentFilter !== "all") params.set("departmentId", departmentFilter);
      if (professionalFilter !== "all") params.set("professionalId", professionalFilter);

      const data = await fetchJson<{ appointments: AgendaAppointment[]; timeBlocks: AgendaTimeBlock[] }>(
        `/api/crm/agenda/appointments?${params.toString()}`,
      );
      setAppointments(data.appointments);
      setTimeBlocks(data.timeBlocks);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a agenda.");
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end, departmentFilter, professionalFilter]);

  React.useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  React.useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const filterDepartment = departments.find((item) => item.id === departmentFilter) ?? null;
  const professionalOptions = React.useMemo(() => {
    const pool = filterDepartment ? filterDepartment.professionals : departments.flatMap((item) => item.professionals);
    return pool.map((item) => item.name);
  }, [departments, filterDepartment]);
  const professionalValues = React.useMemo(() => {
    const pool = filterDepartment ? filterDepartment.professionals : departments.flatMap((item) => item.professionals);
    return pool.map((item) => item.id);
  }, [departments, filterDepartment]);

  function navigate(direction: -1 | 1) {
    setAnchorDate((current) => {
      if (mode === "day") return addDays(current, direction);
      if (mode === "week") return addDays(current, direction * 7);
      return addMonths(current, direction);
    });
  }

  const rangeLabel = React.useMemo(() => {
    if (mode === "day") return format(anchorDate, "EEEE, d 'de' MMMM", { locale: ptBR });
    if (mode === "week") {
      const start = startOfWeek(anchorDate, { weekStartsOn: 0 });
      const end = addDays(start, 6);
      return `${format(start, "d MMM", { locale: ptBR })} – ${format(end, "d MMM yyyy", { locale: ptBR })}`;
    }
    return format(anchorDate, "MMMM 'de' yyyy", { locale: ptBR });
  }, [anchorDate, mode]);

  async function handleCreateOrReschedule(payload: {
    leadId: string;
    departmentId: string;
    professionalId: string | null;
    startTime: string;
    endTime: string;
    anamnesis: string;
  }) {
    if (rescheduling) {
      await fetchJson("/api/crm/agenda/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule",
          id: rescheduling.id,
          startTime: payload.startTime,
          endTime: payload.endTime,
          professionalId: payload.professionalId,
        }),
      });
    } else {
      const lead = leads.find((item) => item.id === payload.leadId);
      await fetchJson("/api/crm/agenda/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: payload.leadId,
          professionalId: payload.professionalId,
          startTime: payload.startTime,
          endTime: payload.endTime,
          anamnesis: payload.anamnesis || undefined,
          // usado só pelo mock de preview para exibir o nome
          leadName: lead?.nome,
        }),
      });
    }
    setRescheduling(null);
    setSelectedAppointment(null);
    await loadAppointments();
  }

  async function handleStatusAction(appointment: AgendaAppointment, action: "cancel" | "confirm") {
    setActionLoading(action);
    try {
      await fetchJson("/api/crm/agenda/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: appointment.id }),
      });
      setSelectedAppointment(null);
      await loadAppointments();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Não foi possível atualizar o agendamento.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCreateTimeBlock(payload: {
    departmentId: string;
    professionalId: string | null;
    startTime: string;
    endTime: string;
    reason: string;
  }) {
    await fetchJson("/api/crm/agenda/time-blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadAppointments();
  }

  async function handleDeleteTimeBlock(id: string) {
    await fetchJson("/api/crm/agenda/time-blocks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadAppointments();
  }

  async function handleSaveDepartmentHours(departmentId: string, businessHours: BusinessHoursConfig) {
    await fetchJson("/api/crm/agenda/business-hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departmentId, businessHours }),
    });
    await loadBootstrap();
  }

  async function handleSaveProfessionalHours(professionalId: string, businessHours: BusinessHoursConfig | null) {
    await fetchJson("/api/crm/agenda/professionals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: professionalId, businessHours }),
    });
    await loadBootstrap();
  }

  async function handleCreateProfessional(departmentId: string, name: string) {
    await fetchJson("/api/crm/agenda/professionals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departmentId, name }),
    });
    await loadBootstrap();
  }

  async function handleToggleProfessional(professionalId: string, active: boolean) {
    await fetchJson("/api/crm/agenda/professionals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: professionalId, active }),
    });
    await loadBootstrap();
  }

  return (
    <div className="grid min-w-0 gap-4">
      {/* Toolbar */}
      <div className="rounded-[24px] border border-border bg-card p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <CalendarDays className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold capitalize">{rangeLabel}</h2>
                <p className="text-xs text-muted-foreground">Agenda de atendimentos</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {allowEdits ? (
                <>
                  <Button size="sm" onClick={() => { setRescheduling(null); setFormOpen(true); }}>
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Novo agendamento</span>
                    <span className="sm:hidden">Novo</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setBlockDialogOpen(true)}>
                    <Ban className="h-4 w-4" />
                    <span className="hidden sm:inline">Bloquear horário</span>
                  </Button>
                </>
              ) : null}
              {canManageSettings ? (
                <Button variant="outline" size="sm" onClick={() => setHoursEditorOpen(true)}>
                  <Settings2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Configurar horários</span>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} aria-label="Período anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={() => setAnchorDate(new Date())}>
                Hoje
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)} aria-label="Próximo período">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex rounded-lg border border-border p-0.5">
              {(["day", "week", "month"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
                    mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value === "day" ? "Dia" : value === "week" ? "Semana" : "Mês"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:max-w-xl">
            <FilterSelect
              value={departmentFilter}
              onValueChange={(value) => {
                setDepartmentFilter(value);
                setProfessionalFilter("all");
              }}
              options={departments.map((item) => item.name)}
              optionValues={departments.map((item) => item.id)}
              placeholder="Todos os setores"
            />
            <FilterSelect
              value={professionalFilter}
              onValueChange={setProfessionalFilter}
              options={professionalOptions}
              optionValues={professionalValues}
              placeholder="Todos os profissionais"
            />
          </div>

          <label className="flex w-fit items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-3.5 w-3.5"
              checked={showCancelled}
              onChange={(event) => setShowCancelled(event.target.checked)}
            />
            Mostrar cancelados
          </label>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      ) : null}

      {loading && appointments.length === 0 ? (
        <div className="grid place-items-center rounded-[24px] border border-border bg-card py-16">
          <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : mode === "month" ? (
        <AgendaMonthGrid
          anchorDate={anchorDate}
          appointments={appointments}
          onSelectDay={(day) => {
            setAnchorDate(day);
            setMode("day");
          }}
        />
      ) : (
        <AgendaTimeGrid
          anchorDate={anchorDate}
          mode={mode}
          appointments={appointments}
          timeBlocks={timeBlocks}
          showCancelled={showCancelled}
          onSelectAppointment={setSelectedAppointment}
        />
      )}

      {/* Sheet de detalhe do agendamento */}
      <Sheet open={Boolean(selectedAppointment)} onOpenChange={(open) => !open && setSelectedAppointment(null)}>
        <SheetContent className="max-w-md">
          {selectedAppointment ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedAppointment.leadName}</SheetTitle>
                <SheetDescription>
                  {format(new Date(selectedAppointment.startTime), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })} –{" "}
                  {format(new Date(selectedAppointment.endTime), "HH:mm")}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 grid gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      selectedAppointment.status === "CONFIRMED" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                      selectedAppointment.status === "PENDING" && "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                      selectedAppointment.status === "CANCELLED" && "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {selectedAppointment.status === "CONFIRMED"
                      ? "Confirmado"
                      : selectedAppointment.status === "PENDING"
                        ? "Pendente"
                        : "Cancelado"}
                  </Badge>
                  <Badge variant="outline">{selectedAppointment.departmentName}</Badge>
                </div>

                <div className="grid gap-2 text-sm">
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {selectedAppointment.leadPhone || "Sem telefone"}
                  </p>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    {selectedAppointment.professionalName ?? "Sem profissional definido"}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Motivo da visita
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">
                    {selectedAppointment.notes?.trim() || "Nenhum motivo registrado."}
                  </p>
                </div>

                {allowEdits && selectedAppointment.status !== "CANCELLED" ? (
                  <div className="grid gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRescheduling(selectedAppointment);
                        setFormOpen(true);
                      }}
                    >
                      Reagendar
                    </Button>
                    {selectedAppointment.status === "PENDING" ? (
                      <Button onClick={() => void handleStatusAction(selectedAppointment, "confirm")} disabled={actionLoading !== null}>
                        {actionLoading === "confirm" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                        Confirmar
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => void handleStatusAction(selectedAppointment, "cancel")}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === "cancel" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                      Cancelar agendamento
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <AppointmentFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setRescheduling(null);
        }}
        departments={departments}
        leads={leads}
        appointments={appointments}
        timeBlocks={timeBlocks}
        reschedulingAppointment={rescheduling}
        defaultDate={anchorDate}
        onSubmit={handleCreateOrReschedule}
      />

      <TimeBlockDialog
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        departments={departments}
        timeBlocks={timeBlocks}
        defaultDate={anchorDate}
        onCreate={handleCreateTimeBlock}
        onDelete={handleDeleteTimeBlock}
      />

      <BusinessHoursEditor
        open={hoursEditorOpen}
        onOpenChange={setHoursEditorOpen}
        departments={departments}
        onSaveDepartmentHours={handleSaveDepartmentHours}
        onSaveProfessionalHours={handleSaveProfessionalHours}
        onCreateProfessional={handleCreateProfessional}
        onToggleProfessional={handleToggleProfessional}
      />
    </div>
  );
}
