import { getPrismaClient } from "@/lib/server/crm/prisma-store";
import { createLogger } from "@/lib/server/logger";
import { scheduleFollowUp } from "@/lib/server/reengagement";
import { findConflict, getAvailableSlots } from "@/lib/server/agenda/availability";

const APPOINTMENT_REMINDER_HOURS_BEFORE = 2;

/**
 * AI Tools para Agendamento Inteligente.
 * Agenda própria (não depende de Cal.com/provedor externo): a disponibilidade
 * vem de Department.businessHours (com override por profissional) e os
 * agendamentos ficam na tabela Appointment. Lógica de slots/conflito em
 * lib/server/agenda/availability.ts, compartilhada com a página de Agenda.
 */

const logger = createLogger("ai/calendar");

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
      required: ["leadId", "startTime", "endTime"],
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

  return getAvailableSlots({
    departmentId: lead.departmentId,
    dateStart: params.dateStart,
    dateEnd: params.dateEnd,
  });
}

export async function executeBookAppointment(params: {
  leadId: string;
  startTime: string;
  endTime: string;
  anamnesis?: string;
  professionalId?: string | null;
}) {
  const prisma = getPrismaClient();
  const startTime = new Date(params.startTime);
  const endTime = new Date(params.endTime);

  const lead = await prisma.lead.findUnique({ where: { id: params.leadId }, select: { departmentId: true } });
  if (!lead?.departmentId) {
    return { success: false, error: "Lead sem setor responsável definido." };
  }

  const conflict = await findConflict({
    departmentId: lead.departmentId,
    professionalId: params.professionalId,
    startTime,
    endTime,
  });

  if (conflict) {
    return { success: false, error: "Esse horário já está ocupado. Escolha outro horário." };
  }

  const anamnesis = params.anamnesis?.trim() || null;

  const appointment = await prisma.appointment.create({
    data: {
      leadId: params.leadId,
      departmentId: lead.departmentId,
      professionalId: params.professionalId ?? null,
      startTime,
      endTime,
      status: "CONFIRMED",
      notes: anamnesis,
    },
  });

  // LGPD: o motivo da consulta (anamnese) fica só no histórico interno do lead
  // e no próprio appointment, nunca é enviado a um provedor de agenda externo.
  if (anamnesis) {
    await prisma.leadHistory.create({
      data: {
        leadId: params.leadId,
        action: "Consulta agendada",
        note: anamnesis,
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
