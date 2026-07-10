"use client";

import * as React from "react";
import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { AgendaAppointment } from "@/features/agenda/lib/types";

const WEEKDAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

type Props = {
  anchorDate: Date;
  appointments: AgendaAppointment[];
  onSelectDay: (date: Date) => void;
};

export function AgendaMonthGrid({ anchorDate, appointments, onSelectDay }: Props) {
  const days = React.useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [anchorDate]);

  const appointmentsByDay = React.useMemo(() => {
    const map = new Map<string, AgendaAppointment[]>();
    for (const appointment of appointments) {
      if (appointment.status === "CANCELLED") continue;
      const key = format(new Date(appointment.startTime), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(appointment);
      map.set(key, list);
    }
    return map;
  }, [appointments]);

  return (
    <div className="rounded-[24px] border border-border bg-card p-3 sm:p-4">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="pb-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayAppointments = (appointmentsByDay.get(key) ?? []).sort(
            (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
          );
          const inMonth = isSameMonth(day, anchorDate);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                "flex min-h-16 flex-col items-stretch gap-1 rounded-xl border border-transparent p-1.5 text-left transition-colors hover:border-primary/30 hover:bg-primary/5 sm:min-h-24",
                !inMonth && "opacity-40",
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full text-[12px] font-medium",
                  isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground",
                )}
              >
                {format(day, "d", { locale: ptBR })}
              </span>

              {/* Desktop: pills; mobile: contagem */}
              <div className="hidden flex-col gap-0.5 sm:flex">
                {dayAppointments.slice(0, 3).map((appointment) => (
                  <span
                    key={appointment.id}
                    className={cn(
                      "truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                      appointment.status === "CONFIRMED"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {format(new Date(appointment.startTime), "HH:mm")} {appointment.leadName}
                  </span>
                ))}
                {dayAppointments.length > 3 ? (
                  <span className="px-1.5 text-[10px] text-muted-foreground">+{dayAppointments.length - 3}</span>
                ) : null}
              </div>
              {dayAppointments.length > 0 ? (
                <span className="mx-auto rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary sm:hidden">
                  {dayAppointments.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
