export type AgendaProfessional = {
  id: string;
  name: string;
  departmentId?: string;
  businessHours: unknown;
  active?: boolean;
};

export type AgendaDepartment = {
  id: string;
  name: string;
  businessHours: unknown;
  professionals: AgendaProfessional[];
};

export type AgendaAppointment = {
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

export type AgendaTimeBlock = {
  id: string;
  departmentId: string;
  departmentName?: string;
  professionalId: string | null;
  professionalName: string | null;
  startTime: string;
  endTime: string;
  reason: string;
};

export type AgendaMode = "day" | "week" | "month";
