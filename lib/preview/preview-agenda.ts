"use client";

/**
 * Estado fictício da Agenda para o modo preview (vitrine pública).
 * Datas geradas relativas a `new Date()` para a semana atual ±1.
 */

export type PreviewProfessional = {
  id: string;
  name: string;
  departmentId: string;
  businessHours: unknown;
  active: boolean;
};

export type PreviewDepartment = {
  id: string;
  name: string;
  businessHours: unknown;
  professionals: PreviewProfessional[];
};

export type PreviewAppointment = {
  id: string;
  startTime: string;
  endTime: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  notes: string | null;
  leadId: string;
  leadName: string;
  leadPhone: string;
  departmentId: string;
  departmentName: string;
  professionalId: string | null;
  professionalName: string | null;
};

export type PreviewTimeBlock = {
  id: string;
  departmentId: string;
  departmentName: string;
  professionalId: string | null;
  professionalName: string | null;
  startTime: string;
  endTime: string;
  reason: string;
};

const DEFAULT_HOURS = {
  slotMinutes: 30,
  bufferMinutes: 10,
  weekly: {
    "1": [{ start: "09:00", end: "18:00" }],
    "2": [{ start: "09:00", end: "18:00" }],
    "3": [{ start: "09:00", end: "18:00" }],
    "4": [{ start: "09:00", end: "18:00" }],
    "5": [{ start: "09:00", end: "18:00" }],
    "6": [{ start: "09:00", end: "13:00" }],
  },
};

export const previewDepartments: PreviewDepartment[] = [
  {
    id: "dep-estetica",
    name: "Estética Facial",
    businessHours: DEFAULT_HOURS,
    professionals: [
      { id: "prof-ana", name: "Ana Paula", departmentId: "dep-estetica", businessHours: null, active: true },
      { id: "prof-bruna", name: "Bruna Martins", departmentId: "dep-estetica", businessHours: null, active: true },
    ],
  },
  {
    id: "dep-cilios",
    name: "Extensão de Cílios",
    businessHours: DEFAULT_HOURS,
    professionals: [
      { id: "prof-carla", name: "Carla Souza", departmentId: "dep-cilios", businessHours: null, active: true },
    ],
  },
];

function dayAt(dayOffset: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function iso(date: Date) {
  return date.toISOString();
}

let appointmentSeq = 0;

function makeAppointment(
  dayOffset: number,
  hour: number,
  minute: number,
  durationMinutes: number,
  leadName: string,
  departmentIndex: 0 | 1,
  professionalIndex: number | null,
  status: "PENDING" | "CONFIRMED",
  notes: string | null,
): PreviewAppointment {
  const department = previewDepartments[departmentIndex];
  const professional = professionalIndex === null ? null : department.professionals[professionalIndex];
  const start = dayAt(dayOffset, hour, minute);
  appointmentSeq += 1;
  return {
    id: `preview-agenda-${appointmentSeq}`,
    startTime: iso(start),
    endTime: iso(new Date(start.getTime() + durationMinutes * 60_000)),
    status,
    notes,
    leadId: `preview-lead-${appointmentSeq}`,
    leadName,
    leadPhone: `(11) 9000${String(appointmentSeq).padStart(2, "0")}-000${appointmentSeq % 10}`,
    departmentId: department.id,
    departmentName: department.name,
    professionalId: professional?.id ?? null,
    professionalName: professional?.name ?? null,
  };
}

export const previewAgendaState: { appointments: PreviewAppointment[]; timeBlocks: PreviewTimeBlock[] } = {
  appointments: [
    makeAppointment(-3, 10, 0, 45, "Juliana Prado", 0, 0, "CONFIRMED", "Limpeza de pele profunda"),
    makeAppointment(-1, 14, 0, 30, "Fernanda Lopes", 1, 0, "CONFIRMED", "Manutenção de cílios volume russo"),
    makeAppointment(0, 9, 30, 45, "Mariana Alves", 0, 0, "CONFIRMED", "Avaliação de sobrancelhas + design"),
    makeAppointment(0, 11, 0, 30, "Camila Rocha", 0, 1, "PENDING", "Primeira consulta — quer conhecer os cursos"),
    makeAppointment(0, 15, 30, 30, "Renata Lima", 1, 0, "PENDING", "Aplicação de cílios clássicos"),
    makeAppointment(1, 10, 0, 45, "Beatriz Nunes", 0, 0, "CONFIRMED", "Retorno pós-procedimento"),
    makeAppointment(1, 16, 0, 30, "Aline Castro", 0, 1, "CONFIRMED", null),
    makeAppointment(2, 9, 0, 30, "Patrícia Gomes", 1, 0, "CONFIRMED", "Remoção e nova aplicação"),
    makeAppointment(2, 14, 30, 45, "Daniela Moura", 0, 0, "PENDING", "Avaliação para harmonização facial"),
    makeAppointment(3, 11, 30, 30, "Isabela Teixeira", 0, 1, "CONFIRMED", "Design de sobrancelhas com henna"),
    makeAppointment(4, 10, 30, 45, "Helena Duarte", 1, 0, "PENDING", "Interessada no curso de extensão"),
    makeAppointment(7, 9, 0, 45, "Larissa Melo", 0, 0, "CONFIRMED", "Consulta de reavaliação"),
  ],
  timeBlocks: [
    {
      id: "preview-block-1",
      departmentId: "dep-estetica",
      departmentName: "Estética Facial",
      professionalId: null,
      professionalName: null,
      startTime: iso(dayAt(0, 12, 0)),
      endTime: iso(dayAt(0, 13, 0)),
      reason: "Almoço",
    },
    {
      id: "preview-block-2",
      departmentId: "dep-cilios",
      departmentName: "Extensão de Cílios",
      professionalId: "prof-carla",
      professionalName: "Carla Souza",
      startTime: iso(dayAt(2, 8, 0)),
      endTime: iso(dayAt(2, 12, 0)),
      reason: "Folga",
    },
  ],
};

function overlapsRange(startTime: string, endTime: string, rangeStart: Date, rangeEnd: Date) {
  return new Date(startTime).getTime() < rangeEnd.getTime() && new Date(endTime).getTime() > rangeStart.getTime();
}

export function handleAgendaPreviewRequest(url: string, method: string, body: string): Response | null {
  const parsed = new URL(url, "http://localhost");
  const pathname = parsed.pathname;

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

  if (pathname === "/api/crm/agenda/bootstrap" && method === "GET") {
    return json({ departments: previewDepartments });
  }

  if (pathname === "/api/crm/agenda/appointments" && method === "GET") {
    const start = parsed.searchParams.get("start");
    const end = parsed.searchParams.get("end");
    const departmentId = parsed.searchParams.get("departmentId");
    const professionalId = parsed.searchParams.get("professionalId");
    if (!start || !end) return json({ error: "Parâmetros start e end são obrigatórios." }, 400);

    const rangeStart = new Date(start);
    const rangeEnd = new Date(end);

    const appointments = previewAgendaState.appointments.filter((appointment) => {
      if (!overlapsRange(appointment.startTime, appointment.endTime, rangeStart, rangeEnd)) return false;
      if (departmentId && appointment.departmentId !== departmentId) return false;
      if (professionalId && appointment.professionalId !== professionalId) return false;
      return true;
    });

    const timeBlocks = previewAgendaState.timeBlocks.filter((block) => {
      if (!overlapsRange(block.startTime, block.endTime, rangeStart, rangeEnd)) return false;
      if (departmentId && block.departmentId !== departmentId) return false;
      if (professionalId && block.professionalId !== null && block.professionalId !== professionalId) return false;
      return true;
    });

    return json({ appointments, timeBlocks });
  }

  if (pathname === "/api/crm/agenda/appointments" && method === "POST") {
    try {
      const payload = JSON.parse(body) as {
        leadId: string;
        professionalId?: string | null;
        startTime: string;
        endTime: string;
        anamnesis?: string;
        leadName?: string;
      };

      const department = previewDepartments[0];
      const professional = payload.professionalId
        ? previewDepartments.flatMap((d) => d.professionals).find((p) => p.id === payload.professionalId) ?? null
        : null;

      const conflict = previewAgendaState.appointments.some(
        (appointment) =>
          appointment.status !== "CANCELLED" &&
          (appointment.professionalId === (payload.professionalId ?? null) || appointment.professionalId === null || !payload.professionalId) &&
          overlapsRange(appointment.startTime, appointment.endTime, new Date(payload.startTime), new Date(payload.endTime)),
      );
      if (conflict) return json({ error: "Esse horário já está ocupado. Escolha outro horário." }, 409);

      appointmentSeq += 1;
      const appointment: PreviewAppointment = {
        id: `preview-agenda-${appointmentSeq}`,
        startTime: payload.startTime,
        endTime: payload.endTime,
        status: "CONFIRMED",
        notes: payload.anamnesis?.trim() || null,
        leadId: payload.leadId,
        leadName: payload.leadName || "Novo agendamento",
        leadPhone: "(11) 90000-0000",
        departmentId: professional ? professional.departmentId : department.id,
        departmentName: professional
          ? previewDepartments.find((d) => d.id === professional.departmentId)?.name ?? department.name
          : department.name,
        professionalId: professional?.id ?? null,
        professionalName: professional?.name ?? null,
      };
      previewAgendaState.appointments.push(appointment);
      return json({ appointment });
    } catch {
      return json({ error: "Não foi possível criar o agendamento." }, 400);
    }
  }

  if (pathname === "/api/crm/agenda/appointments" && method === "PATCH") {
    try {
      const payload = JSON.parse(body) as {
        action: "reschedule" | "cancel" | "confirm";
        id: string;
        startTime?: string;
        endTime?: string;
        professionalId?: string | null;
      };
      const appointment = previewAgendaState.appointments.find((item) => item.id === payload.id);
      if (!appointment) return json({ error: "Agendamento não encontrado." }, 404);

      if (payload.action === "cancel") {
        appointment.status = "CANCELLED";
      } else if (payload.action === "confirm") {
        appointment.status = "CONFIRMED";
      } else if (payload.action === "reschedule" && payload.startTime && payload.endTime) {
        appointment.startTime = payload.startTime;
        appointment.endTime = payload.endTime;
        if (payload.professionalId !== undefined) {
          const professional = payload.professionalId
            ? previewDepartments.flatMap((d) => d.professionals).find((p) => p.id === payload.professionalId) ?? null
            : null;
          appointment.professionalId = professional?.id ?? null;
          appointment.professionalName = professional?.name ?? null;
        }
        if (appointment.status === "CANCELLED") appointment.status = "CONFIRMED";
      }

      return json({ appointment });
    } catch {
      return json({ error: "Não foi possível atualizar o agendamento." }, 400);
    }
  }

  if (pathname === "/api/crm/agenda/time-blocks" && method === "POST") {
    try {
      const payload = JSON.parse(body) as {
        departmentId: string;
        professionalId?: string | null;
        startTime: string;
        endTime: string;
        reason: string;
      };
      const department = previewDepartments.find((d) => d.id === payload.departmentId);
      const professional = payload.professionalId
        ? department?.professionals.find((p) => p.id === payload.professionalId) ?? null
        : null;
      const timeBlock: PreviewTimeBlock = {
        id: `preview-block-${Date.now()}`,
        departmentId: payload.departmentId,
        departmentName: department?.name ?? "Setor",
        professionalId: professional?.id ?? null,
        professionalName: professional?.name ?? null,
        startTime: payload.startTime,
        endTime: payload.endTime,
        reason: payload.reason,
      };
      previewAgendaState.timeBlocks.push(timeBlock);
      return json({ timeBlock });
    } catch {
      return json({ error: "Não foi possível criar o bloqueio." }, 400);
    }
  }

  if (pathname === "/api/crm/agenda/time-blocks" && method === "DELETE") {
    try {
      const payload = JSON.parse(body) as { id: string };
      previewAgendaState.timeBlocks = previewAgendaState.timeBlocks.filter((block) => block.id !== payload.id);
      return json({ ok: true });
    } catch {
      return json({ error: "Não foi possível remover o bloqueio." }, 400);
    }
  }

  if (pathname === "/api/crm/agenda/professionals" && (method === "POST" || method === "PATCH")) {
    try {
      const payload = JSON.parse(body) as {
        id?: string;
        departmentId?: string;
        name?: string;
        active?: boolean;
        businessHours?: unknown;
      };

      if (method === "POST" && payload.departmentId && payload.name) {
        const department = previewDepartments.find((d) => d.id === payload.departmentId);
        if (!department) return json({ error: "Setor não encontrado." }, 404);
        const professional: PreviewProfessional = {
          id: `prof-${Date.now()}`,
          name: payload.name,
          departmentId: department.id,
          businessHours: null,
          active: true,
        };
        department.professionals.push(professional);
        return json({ professional });
      }

      const professional = previewDepartments.flatMap((d) => d.professionals).find((p) => p.id === payload.id);
      if (!professional) return json({ error: "Profissional não encontrado." }, 404);
      if (payload.name !== undefined) professional.name = payload.name;
      if (payload.active !== undefined) professional.active = payload.active;
      if (payload.businessHours !== undefined) professional.businessHours = payload.businessHours;
      return json({ professional });
    } catch {
      return json({ error: "Não foi possível salvar o profissional." }, 400);
    }
  }

  if (pathname === "/api/crm/agenda/business-hours" && method === "PUT") {
    try {
      const payload = JSON.parse(body) as { departmentId: string; businessHours: unknown };
      const department = previewDepartments.find((d) => d.id === payload.departmentId);
      if (!department) return json({ error: "Setor não encontrado." }, 404);
      department.businessHours = payload.businessHours;
      return json({ department: { id: department.id, name: department.name, businessHours: department.businessHours } });
    } catch {
      return json({ error: "Não foi possível salvar os horários." }, 400);
    }
  }

  return null;
}
