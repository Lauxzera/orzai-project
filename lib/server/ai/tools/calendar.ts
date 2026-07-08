import { z } from "zod";

/**
 * AI Tools para Agendamento Inteligente (Phase 2)
 * Mocks baseados na arquitetura do Cal.com
 */

export const checkAvailabilityTool = {
  type: "function" as const,
  function: {
    name: "checkAvailability",
    description: "Verifica a disponibilidade de horários no calendário (Cal.com mock).",
    parameters: {
      type: "object",
      properties: {
        departmentId: { type: "string", description: "ID do departamento ou agenda (eventTypeId)" },
        dateStart: { type: "string", description: "Data inicial da busca no formato YYYY-MM-DD" },
        dateEnd: { type: "string", description: "Data final da busca no formato YYYY-MM-DD" },
      },
      required: ["departmentId", "dateStart", "dateEnd"],
    },
  },
};

export const bookAppointmentTool = {
  type: "function" as const,
  function: {
    name: "bookAppointment",
    description: "Realiza o agendamento de uma consulta no calendário (Cal.com mock).",
    parameters: {
      type: "object",
      properties: {
        departmentId: { type: "string", description: "ID do departamento ou agenda" },
        leadId: { type: "string", description: "ID do paciente (lead)" },
        name: { type: "string", description: "Nome do paciente" },
        phone: { type: "string", description: "Telefone do paciente para contato" },
        startTime: { type: "string", description: "Horário de início ISO 8601" },
        endTime: { type: "string", description: "Horário de término ISO 8601" },
        anamnesis: { type: "string", description: "Motivo da consulta relatado (armazenado apenas internamente)" },
      },
      required: ["departmentId", "leadId", "name", "phone", "startTime", "endTime"],
    },
  },
};

// Implementations

export async function executeCheckAvailability(params: {
  departmentId: string;
  dateStart: string;
  dateEnd: string;
}) {
  // Mock Cal.com availability response
  return {
    success: true,
    availableSlots: [
      { start: `${params.dateStart}T09:00:00Z`, end: `${params.dateStart}T09:30:00Z` },
      { start: `${params.dateStart}T14:00:00Z`, end: `${params.dateStart}T14:30:00Z` },
    ],
  };
}

export async function executeBookAppointment(params: {
  departmentId: string;
  leadId: string;
  name: string;
  phone: string;
  startTime: string;
  endTime: string;
  anamnesis?: string;
}) {
  // CRÍTICO - LGPD: Enviar apenas dados não sensíveis para o agendador de terceiros
  // O provedor Cal.com recebe apenas Nome e Telefone. O motivo (anamnese) fica restrito.
  const calComPayload = {
    eventTypeId: params.departmentId,
    start: params.startTime,
    end: params.endTime,
    title: `Consulta - ${params.name}`,
    description: `Contato: ${params.phone}`,
    // ATENÇÃO: NÃO INCLUIR params.anamnesis AQUI PARA EVITAR VAZAMENTO DE DADOS DE SAÚDE
  };

  console.log("[Cal.com API Mock] Creating booking with payload:", calComPayload);

  // Simulação de retorno da API
  const mockExternalId = `cal_${Date.now()}`;

  // Aqui entraria a lógica real do Prisma para registrar a Appointment localmente
  /*
  await prisma.appointment.create({
    data: {
      externalId: mockExternalId,
      leadId: params.leadId,
      departmentId: params.departmentId,
      startTime: new Date(params.startTime),
      endTime: new Date(params.endTime),
      status: 'CONFIRMED'
    }
  });
  
  // A anamnese seria salva de forma segura (ex: criptografada em um prontuário ou note seguro no Lead)
  if (params.anamnesis) {
    await prisma.leadHistory.create({
      data: {
        leadId: params.leadId,
        action: 'CONSULTA_AGENDADA',
        note: `Motivo/Anamnese da IA: ${params.anamnesis}` // Dependendo da regra, isso precisa ser anonimizado/criptografado
      }
    });
  }
  */

  return {
    success: true,
    appointmentId: mockExternalId,
    message: "Agendamento realizado com sucesso."
  };
}
