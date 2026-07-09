"use client";

import * as React from "react";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type TodayAppointment = {
  id: string;
  startTime: string;
  endTime: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  leadName: string;
  leadPhone: string;
  departmentName: string;
};

function formatHour(value: string) {
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function DashboardTodayAppointments() {
  const [appointments, setAppointments] = React.useState<TodayAppointment[] | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/crm/appointments/today")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Falha ao carregar agenda."))))
      .then((data) => { if (!cancelled) setAppointments(data.appointments); })
      .catch(() => { if (!cancelled) setError("Não foi possível carregar a agenda de hoje."); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Card className="rounded-[32px] overflow-hidden border border-border bg-card">
      <CardHeader className="border-b border-border bg-card px-8 py-6">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <CalendarClock className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-xl font-light tracking-wide text-white">Agenda de hoje</CardTitle>
            <CardDescription className="text-white/40">Compromissos marcados para o dia.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        {error ? (
          <p className="text-sm text-rose-400">{error}</p>
        ) : appointments === null ? (
          <p className="text-sm text-white/40">Carregando...</p>
        ) : appointments.length === 0 ? (
          <p className="text-sm text-white/40">Nenhum compromisso agendado para hoje.</p>
        ) : (
          <div className="grid gap-3">
            {appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/50 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-white">{appointment.leadName}</p>
                  <p className="mt-1 text-[12px] font-light text-white/40">
                    {appointment.leadPhone} · {appointment.departmentName}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-3">
                  <span className="text-sm font-medium text-white">
                    {formatHour(appointment.startTime)}–{formatHour(appointment.endTime)}
                  </span>
                  <Badge variant={appointment.status === "CONFIRMED" ? "success" : "gold"} className="text-[10px] uppercase tracking-widest">
                    {appointment.status === "CONFIRMED" ? "Confirmado" : "Pendente"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
