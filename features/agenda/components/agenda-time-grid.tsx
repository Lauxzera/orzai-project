"use client";

import * as React from "react";
import { addDays, eachDayOfInterval, format, isSameDay, isToday, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgendaAppointment, AgendaTimeBlock } from "@/features/agenda/lib/types";

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;
const SLOT_MINUTES = 30;
const ROWS_PER_HOUR = 60 / SLOT_MINUTES;
const TOTAL_ROWS = (DAY_END_HOUR - DAY_START_HOUR) * ROWS_PER_HOUR;

type Props = {
  anchorDate: Date;
  mode: "day" | "week";
  appointments: AgendaAppointment[];
  timeBlocks: AgendaTimeBlock[];
  showCancelled: boolean;
  onSelectAppointment: (appointment: AgendaAppointment) => void;
};

function minutesFromDayStart(date: Date) {
  return (date.getHours() - DAY_START_HOUR) * 60 + date.getMinutes();
}

function gridRowsFor(startTime: string, endTime: string) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const startMinutes = Math.max(0, minutesFromDayStart(start));
  const endMinutes = Math.min(TOTAL_ROWS * SLOT_MINUTES, minutesFromDayStart(end));
  const rowStart = Math.floor(startMinutes / SLOT_MINUTES) + 1;
  const rowEnd = Math.max(rowStart + 1, Math.ceil(endMinutes / SLOT_MINUTES) + 1);
  return { rowStart, rowEnd };
}

export function AgendaTimeGrid({ anchorDate, mode, appointments, timeBlocks, showCancelled, onSelectAppointment }: Props) {
  const days = React.useMemo(() => {
    if (mode === "day") return [anchorDate];
    const weekStart = startOfWeek(anchorDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  }, [anchorDate, mode]);

  const hours = React.useMemo(() => {
    const list: string[] = [];
    for (let hour = DAY_START_HOUR; hour < DAY_END_HOUR; hour += 1) {
      list.push(`${String(hour).padStart(2, "0")}:00`);
    }
    return list;
  }, []);

  return (
    <div className="min-w-0 max-w-full rounded-[24px] border border-border bg-card p-3 sm:p-4">
      <div className={cn(mode === "week" && "max-w-full overflow-x-auto crm-scrollbar")}>
        <div className={cn(mode === "week" && "min-w-[640px]")}>
          {/* Cabeçalho dos dias */}
          <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
            <div />
            {days.map((day) => (
              <div key={day.toISOString()} className="border-b border-border pb-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {format(day, "EEE", { locale: ptBR })}
                </p>
                <p
                  className={cn(
                    "mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-[14px] font-medium",
                    isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground",
                  )}
                >
                  {format(day, "d")}
                </p>
              </div>
            ))}
          </div>

          {/* Corpo do grid */}
          <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
            {/* Coluna de horários */}
            <div className="grid" style={{ gridTemplateRows: `repeat(${TOTAL_ROWS}, 2rem)` }}>
              {hours.map((hour, index) => (
                <div
                  key={hour}
                  className="pr-2 text-right text-[10px] text-muted-foreground"
                  style={{ gridRow: `${index * ROWS_PER_HOUR + 1} / span ${ROWS_PER_HOUR}` }}
                >
                  {hour}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayAppointments = appointments.filter(
                (appointment) =>
                  isSameDay(new Date(appointment.startTime), day) &&
                  (showCancelled || appointment.status !== "CANCELLED"),
              );
              const dayBlocks = timeBlocks.filter((block) => isSameDay(new Date(block.startTime), day));

              return (
                <div
                  key={day.toISOString()}
                  className="relative grid border-l border-border/60"
                  style={{ gridTemplateRows: `repeat(${TOTAL_ROWS}, 2rem)` }}
                >
                  {/* Linhas de meia hora */}
                  {Array.from({ length: TOTAL_ROWS }).map((_, index) => (
                    <div
                      key={index}
                      className={cn("border-b", index % ROWS_PER_HOUR === ROWS_PER_HOUR - 1 ? "border-border/60" : "border-border/25")}
                      style={{ gridRow: index + 1 }}
                    />
                  ))}

                  {/* Bloqueios */}
                  {dayBlocks.map((block) => {
                    const { rowStart, rowEnd } = gridRowsFor(block.startTime, block.endTime);
                    return (
                      <div
                        key={block.id}
                        className="z-10 mx-0.5 flex items-start gap-1 overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted/60 px-1.5 py-1"
                        style={{ gridRow: `${rowStart} / ${rowEnd}` }}
                        title={`${block.reason}${block.professionalName ? ` · ${block.professionalName}` : " · Setor inteiro"}`}
                      >
                        <Ban className="mt-0.5 h-3 w-3 flex-none text-muted-foreground" />
                        <span className="truncate text-[10px] font-medium text-muted-foreground">{block.reason}</span>
                      </div>
                    );
                  })}

                  {/* Agendamentos */}
                  {dayAppointments.map((appointment) => {
                    const { rowStart, rowEnd } = gridRowsFor(appointment.startTime, appointment.endTime);
                    return (
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={() => onSelectAppointment(appointment)}
                        className={cn(
                          "z-20 mx-0.5 flex flex-col items-start overflow-hidden rounded-lg border px-1.5 py-1 text-left transition-transform hover:scale-[1.02]",
                          appointment.status === "CONFIRMED" &&
                            "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                          appointment.status === "PENDING" &&
                            "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
                          appointment.status === "CANCELLED" &&
                            "border-border bg-muted/50 text-muted-foreground line-through",
                        )}
                        style={{ gridRow: `${rowStart} / ${rowEnd}` }}
                      >
                        <span className="text-[10px] font-semibold leading-tight">
                          {format(new Date(appointment.startTime), "HH:mm")}
                        </span>
                        <span className="w-full truncate text-[11px] font-medium leading-tight">{appointment.leadName}</span>
                        {appointment.professionalName ? (
                          <span className="w-full truncate text-[9px] leading-tight opacity-75">{appointment.professionalName}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
