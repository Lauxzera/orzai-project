import { getPrismaClient } from "@/lib/server/crm/prisma-store";

/**
 * Disponibilidade de agenda compartilhada entre o fluxo de IA (calendar.ts)
 * e as rotas da página de Agenda.
 *
 * Horários (businessHours) são calculados em UTC (getUTCDay/setUTCMinutes) —
 * as strings armazenadas já carregam o horário local do negócio e não devem
 * ser convertidas.
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

export function timeStringToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function buildDaySlots(date: string, hours: BusinessHoursConfig) {
  const weekday = String(new Date(`${date}T12:00:00Z`).getUTCDay());
  const ranges = hours.weekly[weekday] ?? [];
  const step = hours.slotMinutes + hours.bufferMinutes;
  const slots: Array<{ start: Date; end: Date }> = [];

  for (const range of ranges) {
    const startMinutes = timeStringToMinutes(range.start);
    const endMinutes = timeStringToMinutes(range.end);
    for (let cursor = startMinutes; cursor + hours.slotMinutes <= endMinutes; cursor += step) {
      const start = new Date(`${date}T00:00:00Z`);
      start.setUTCMinutes(cursor);
      const end = new Date(start.getTime() + hours.slotMinutes * 60_000);
      slots.push({ start, end });
    }
  }

  return slots;
}

export function listDatesBetween(dateStart: string, dateEnd: string) {
  const dates: string[] = [];
  const cursor = new Date(`${dateStart}T00:00:00Z`);
  const end = new Date(`${dateEnd}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime() && dates.length < 31) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

type HoursSource = { businessHours?: unknown } | null | undefined;

/** Herança de horário: profissional -> setor -> padrão. */
export function resolveHours(department: HoursSource, professional?: HoursSource): BusinessHoursConfig {
  if (professional?.businessHours) return parseBusinessHours(professional.businessHours);
  return parseBusinessHours(department?.businessHours);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

/**
 * Escopo de conflito multi-profissional:
 * - appointment COM professionalId conflita com o mesmo profissional e com
 *   appointments sem profissional (nível de setor, comportamento legado);
 * - appointment SEM professionalId conflita com qualquer horário do setor;
 * - TimeBlock sem professionalId bloqueia o setor inteiro.
 */
function buildProfessionalScope(professionalId: string | null | undefined) {
  return professionalId ? { OR: [{ professionalId }, { professionalId: null }] } : {};
}

export async function findConflict(params: {
  departmentId: string;
  professionalId?: string | null;
  startTime: Date;
  endTime: Date;
  excludeAppointmentId?: string;
}) {
  const prisma = getPrismaClient();

  const appointment = await prisma.appointment.findFirst({
    where: {
      departmentId: params.departmentId,
      status: { not: "CANCELLED" },
      startTime: { lt: params.endTime },
      endTime: { gt: params.startTime },
      ...(params.excludeAppointmentId ? { id: { not: params.excludeAppointmentId } } : {}),
      ...buildProfessionalScope(params.professionalId),
    },
    select: { id: true, startTime: true, endTime: true },
  });

  if (appointment) return { type: "appointment" as const, ...appointment };

  const timeBlock = await prisma.timeBlock.findFirst({
    where: {
      departmentId: params.departmentId,
      startTime: { lt: params.endTime },
      endTime: { gt: params.startTime },
      ...buildProfessionalScope(params.professionalId),
    },
    select: { id: true, startTime: true, endTime: true, reason: true },
  });

  if (timeBlock) return { type: "timeBlock" as const, ...timeBlock };

  return null;
}

export async function getAvailableSlots(params: {
  departmentId: string;
  professionalId?: string | null;
  dateStart: string;
  dateEnd: string;
  limit?: number;
}) {
  const prisma = getPrismaClient();

  const department = await prisma.department.findUnique({ where: { id: params.departmentId } });
  if (!department) return { success: false as const, error: "Setor não encontrado.", availableSlots: [] };

  const professional = params.professionalId
    ? await prisma.professional.findUnique({ where: { id: params.professionalId } })
    : null;

  const businessHours = resolveHours(department, professional);
  const rangeStart = new Date(`${params.dateStart}T00:00:00Z`);
  const rangeEnd = new Date(`${params.dateEnd}T23:59:59Z`);

  const [existingAppointments, timeBlocks] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        departmentId: params.departmentId,
        status: { not: "CANCELLED" },
        startTime: { gte: rangeStart, lte: rangeEnd },
        ...buildProfessionalScope(params.professionalId),
      },
      select: { startTime: true, endTime: true },
    }),
    prisma.timeBlock.findMany({
      where: {
        departmentId: params.departmentId,
        startTime: { lt: rangeEnd },
        endTime: { gt: rangeStart },
        ...buildProfessionalScope(params.professionalId),
      },
      select: { startTime: true, endTime: true },
    }),
  ]);

  const candidateSlots = listDatesBetween(params.dateStart, params.dateEnd).flatMap((date) =>
    buildDaySlots(date, businessHours),
  );

  const now = new Date();
  const busy = [...existingAppointments, ...timeBlocks];
  const availableSlots = candidateSlots
    .filter((slot) => slot.start.getTime() > now.getTime())
    .filter((slot) => busy.every((entry) => !overlaps(slot.start, slot.end, entry.startTime, entry.endTime)))
    .slice(0, params.limit ?? 20)
    .map((slot) => ({ start: slot.start.toISOString(), end: slot.end.toISOString() }));

  return { success: true as const, availableSlots };
}
