import { getPrismaClient } from "@/lib/server/crm/prisma-store";
import { createLogger } from "@/lib/server/logger";
import { scheduleFollowUp } from "@/lib/server/reengagement";

const APPOINTMENT_REMINDER_HOURS_BEFORE = 2;

/**
 * AI Tools para Agendamento Inteligente.
 * Agenda própria (não depende de Cal.com/provedor externo): a disponibilidade
 * vem do campo Department.businessHours e os agendamentos ficam na tabela Appointment.
 */

const logger = createLogger("ai/calendar");

type BusinessHoursConfig = {
  slotMinutes: number;
  bufferMinutes: number;
  weekly: Partial<Record<string, Array<{ start: string; end: string }>>>;
};

const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
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

function parseBusinessHours(value: unknown): BusinessHoursConfig {
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

function buildDaySlots(date: string, hours: BusinessHoursConfig) {
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

function listDatesBetween(dateStart: string, dateEnd: string) {
  const dates: string[] = [];
  const cursor = new Date(`${dateStart}T00:00:00Z`);
  const end = new Date(`${dateEnd}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime() && dates.length < 31) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export const checkAvailabilityTool = {
  type: "function" as const,
  function: {
    name: "checkAvailability",
    description: "Verifica horários livres na agenda do setor do lead, considerando o horário de funcionamento e os agendamentos já existentes. Informe o ID do lead — o setor é resolvido automaticamente a partir dele.",
    parameters: {
      type: "object",
      properties: {
        leadId: { type: "string", description: "ID do lead (usado para descobrir o setor responsável)" },
        dateStart: { type: "string", description: "Data inicial da busca no formato YYYY-MM-DD" },
        dateEnd: { type: "string", description: "Data final da busca no formato YYYY-MM-DD" },
      },
      required: ["leadId", "dateStart", "dateEnd"],
    },
  },
};

export const bookAppointmentTool = {
  type: "function" as const,
  function: {
    name: "bookAppointment",
    description: "Agenda um horário para o lead no setor responsável por ele.",
    parameters: {
      type: "object",
      properties: {
        leadId: { type: "string", description: "ID do lead" },
        startTime: { type: "string", description: "Horário de início ISO 8601" },
        endTime: { type: "string", description: "Horário de término ISO 8601" },
        anamnesis: { type: "string", description: "Motivo da consulta relatado (fica restrito ao histórico interno do lead, nunca sai do CRM)" },
      },
      required: ["departmentId", "leadId", "startTime", "endTime"],
    },
  },
};

export async function executeCheckAvailability(params: {
  leadId: string;
  dateStart: string;
  dateEnd: string;
}) {
  const prisma = getPrismaClient();

  const lead = await prisma.lead.findUnique({ where: { id: params.leadId }, select: { departmentId: true } });
  if (!lead?.departmentId) {
    return { success: false, error: "Lead sem setor responsável definido.", availableSlots: [] };
  }

  const department = await prisma.department.findUnique({ where: { id: lead.departmentId } });
  if (!department) {
    return { success: false, error: "Setor não encontrado.", availableSlots: [] };
  }

  const businessHours = parseBusinessHours(department.businessHours);
  const rangeStart = new Date(`${params.dateStart}T00:00:00Z`);
  const rangeEnd = new Date(`${params.dateEnd}T23:59:59Z`);

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      departmentId: lead.departmentId,
      status: { not: "CANCELLED" },
      startTime: { gte: rangeStart, lte: rangeEnd },
    },
    select: { startTime: true, endTime: true },
  });

  const candidateSlots = listDatesBetween(params.dateStart, params.dateEnd).flatMap((date) =>
    buildDaySlots(date, businessHours)
  );

  const now = new Date();
  const availableSlots = candidateSlots
    .filter((slot) => slot.start.getTime() > now.getTime())
    .filter((slot) =>
      existingAppointments.every(
        (appointment) => slot.end.getTime() <= appointment.startTime.getTime() || slot.start.getTime() >= appointment.endTime.getTime()
      )
    )
    .slice(0, 20)
    .map((slot) => ({ start: slot.start.toISOString(), end: slot.end.toISOString() }));

  return { success: true, availableSlots };
}

export async function executeBookAppointment(params: {
  leadId: string;
  startTime: string;
  endTime: string;
  anamnesis?: string;
}) {
  const prisma = getPrismaClient();
  const startTime = new Date(params.startTime);
  const endTime = new Date(params.endTime);

  const lead = await prisma.lead.findUnique({ where: { id: params.leadId }, select: { departmentId: true } });
  if (!lead?.departmentId) {
    return { success: false, error: "Lead sem setor responsável definido." };
  }

  const conflict = await prisma.appointment.findFirst({
    where: {
      departmentId: lead.departmentId,
      status: { not: "CANCELLED" },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });

  if (conflict) {
    return { success: false, error: "Esse horário já está ocupado. Escolha outro horário." };
  }

  const appointment = await prisma.appointment.create({
    data: {
      leadId: params.leadId,
      departmentId: lead.departmentId,
      startTime,
      endTime,
      status: "CONFIRMED",
    },
  });

  // LGPD: o motivo da consulta (anamnese) fica só no histórico interno do lead,
  // nunca é enviado a um provedor de agenda externo.
  if (params.anamnesis?.trim()) {
    await prisma.leadHistory.create({
      data: {
        leadId: params.leadId,
        action: "Consulta agendada",
        note: params.anamnesis.trim(),
      },
    });
  }

  const reminderTime = new Date(startTime.getTime() - APPOINTMENT_REMINDER_HOURS_BEFORE * 60 * 60 * 1000);
  if (reminderTime.getTime() > Date.now()) {
    await scheduleFollowUp(params.leadId, lead.departmentId, reminderTime);
  }

  logger.info("agendamento criado", { appointmentId: appointment.id, leadId: params.leadId, departmentId: lead.departmentId });

  return {
    success: true,
    appointmentId: appointment.id,
    message: "Agendamento realizado com sucesso.",
  };
}
