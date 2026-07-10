/**
 * Cálculo de slots client-side para o slot picker do formulário de agendamento.
 * Diferente do motor do servidor (UTC-based, usado pelo fluxo de IA), aqui os
 * horários de businessHours são interpretados no fuso local do navegador —
 * "09:00" vira 09:00 na parede do usuário, que é como o negócio pensa a agenda.
 */

export type BusinessHoursConfig = {
  slotMinutes: number;
  bufferMinutes: number;
  weekly: Partial<Record<string, Array<{ start: string; end: string }>>>;
};

export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  slotMinutes: 30,
  bufferMinutes: 10,
  weekly: {
    "1": [{ start: "09:00", end: "18:00" }],
    "2": [{ start: "09:00", end: "18:00" }],
    "3": [{ start: "09:00", end: "18:00" }],
    "4": [{ start: "09:00", end: "18:00" }],
    "5": [{ start: "09:00", end: "18:00" }],
  },
};

export function parseBusinessHours(value: unknown): BusinessHoursConfig {
  if (!value || typeof value !== "object") return DEFAULT_BUSINESS_HOURS;
  const candidate = value as Partial<BusinessHoursConfig>;
  if (!candidate.weekly || typeof candidate.slotMinutes !== "number") return DEFAULT_BUSINESS_HOURS;
  return {
    slotMinutes: candidate.slotMinutes,
    bufferMinutes: typeof candidate.bufferMinutes === "number" ? candidate.bufferMinutes : 0,
    weekly: candidate.weekly,
  };
}

function timeStringToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function buildDaySlots(date: string, hours: BusinessHoursConfig) {
  const dayStart = new Date(`${date}T00:00:00`);
  const weekday = String(dayStart.getDay());
  const ranges = hours.weekly[weekday] ?? [];
  const step = hours.slotMinutes + hours.bufferMinutes;
  const slots: Array<{ start: Date; end: Date }> = [];

  for (const range of ranges) {
    const startMinutes = timeStringToMinutes(range.start);
    const endMinutes = timeStringToMinutes(range.end);
    for (let cursor = startMinutes; cursor + hours.slotMinutes <= endMinutes; cursor += step) {
      const start = new Date(dayStart.getTime() + cursor * 60_000);
      const end = new Date(start.getTime() + hours.slotMinutes * 60_000);
      slots.push({ start, end });
    }
  }

  return slots;
}

type BusyEntry = { startTime: string; endTime: string };

export function getFreeSlotsForDay(params: {
  date: string;
  departmentHours: unknown;
  professionalHours?: unknown;
  busy: BusyEntry[];
  allowPast?: boolean;
}) {
  const hours = params.professionalHours
    ? parseBusinessHours(params.professionalHours)
    : parseBusinessHours(params.departmentHours);

  const now = Date.now();
  return buildDaySlots(params.date, hours).filter((slot) => {
    if (!params.allowPast && slot.start.getTime() <= now) return false;
    return params.busy.every(
      (entry) =>
        slot.end.getTime() <= new Date(entry.startTime).getTime() ||
        slot.start.getTime() >= new Date(entry.endTime).getTime(),
    );
  });
}
