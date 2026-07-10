import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";
import { findConflict } from "@/lib/server/agenda/availability";
import { executeBookAppointment } from "@/lib/server/ai/tools/calendar";
import { scheduleFollowUp } from "@/lib/server/reengagement";

const APPOINTMENT_REMINDER_HOURS_BEFORE = 2;

const createSchema = z.object({
  leadId: z.string().min(1),
  professionalId: z.string().min(1).nullish(),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  anamnesis: z.string().max(2000).optional(),
});

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reschedule"),
    id: z.string().min(1),
    startTime: z.string().datetime({ offset: true }),
    endTime: z.string().datetime({ offset: true }),
    professionalId: z.string().min(1).nullish(),
  }),
  z.object({ action: z.literal("cancel"), id: z.string().min(1) }),
  z.object({ action: z.literal("confirm"), id: z.string().min(1) }),
]);

function canEdit(role: string) {
  return role !== "VIEWER";
}

const appointmentInclude = {
  lead: { select: { nome: true, telefone: true, whatsapp: true } },
  department: { select: { name: true } },
  professional: { select: { id: true, name: true } },
} as const;

type AppointmentWithRelations = {
  id: string;
  startTime: Date;
  endTime: Date;
  status: string;
  notes: string | null;
  leadId: string;
  departmentId: string;
  professionalId: string | null;
  lead: { nome: string; telefone: string; whatsapp: string | null };
  department: { name: string };
  professional: { id: string; name: string } | null;
};

function serializeAppointment(appointment: AppointmentWithRelations) {
  return {
    id: appointment.id,
    startTime: appointment.startTime.toISOString(),
    endTime: appointment.endTime.toISOString(),
    status: appointment.status,
    notes: appointment.notes,
    leadId: appointment.leadId,
    leadName: appointment.lead.nome,
    leadPhone: appointment.lead.whatsapp || appointment.lead.telefone,
    departmentId: appointment.departmentId,
    departmentName: appointment.department.name,
    professionalId: appointment.professionalId,
    professionalName: appointment.professional?.name ?? null,
  };
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const departmentId = url.searchParams.get("departmentId");
  const professionalId = url.searchParams.get("professionalId");

  if (!start || !end) {
    return NextResponse.json({ error: "Parâmetros start e end são obrigatórios." }, { status: 400 });
  }

  const rangeStart = new Date(start);
  const rangeEnd = new Date(end);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return NextResponse.json({ error: "Datas inválidas." }, { status: 400 });
  }

  const prisma = getPrismaClient();
  const scopeFilter = {
    ...(departmentId ? { departmentId } : {}),
    ...(professionalId ? { professionalId } : {}),
  };

  const [appointments, timeBlocks] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        startTime: { lt: rangeEnd },
        endTime: { gt: rangeStart },
        ...scopeFilter,
      },
      orderBy: { startTime: "asc" },
      include: appointmentInclude,
    }),
    prisma.timeBlock.findMany({
      where: {
        startTime: { lt: rangeEnd },
        endTime: { gt: rangeStart },
        ...(departmentId ? { departmentId } : {}),
        ...(professionalId ? { OR: [{ professionalId }, { professionalId: null }] } : {}),
      },
      orderBy: { startTime: "asc" },
      include: { professional: { select: { name: true } }, department: { select: { name: true } } },
    }),
  ]);

  return NextResponse.json({
    appointments: appointments.map(serializeAppointment),
    timeBlocks: timeBlocks.map((block) => ({
      id: block.id,
      departmentId: block.departmentId,
      departmentName: block.department.name,
      professionalId: block.professionalId,
      professionalName: block.professional?.name ?? null,
      startTime: block.startTime.toISOString(),
      endTime: block.endTime.toISOString(),
      reason: block.reason,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!canEdit(user.role)) {
    return NextResponse.json({ error: "Você não tem permissão para realizar alterações." }, { status: 403 });
  }

  try {
    const body = createSchema.parse(await request.json());

    const result = await executeBookAppointment({
      leadId: body.leadId,
      startTime: body.startTime,
      endTime: body.endTime,
      anamnesis: body.anamnesis,
      professionalId: body.professionalId ?? null,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    const prisma = getPrismaClient();
    const appointment = await prisma.appointment.findUnique({
      where: { id: result.appointmentId },
      include: appointmentInclude,
    });

    return NextResponse.json({ appointment: appointment ? serializeAppointment(appointment) : null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar o agendamento." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!canEdit(user.role)) {
    return NextResponse.json({ error: "Você não tem permissão para realizar alterações." }, { status: 403 });
  }

  try {
    const body = patchSchema.parse(await request.json());
    const prisma = getPrismaClient();

    const existing = await prisma.appointment.findUnique({ where: { id: body.id } });
    if (!existing) {
      return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }

    if (body.action === "cancel") {
      const appointment = await prisma.appointment.update({
        where: { id: body.id },
        data: { status: "CANCELLED" },
        include: appointmentInclude,
      });
      await cancelReminderBestEffort(existing.leadId, existing.startTime);
      return NextResponse.json({ appointment: serializeAppointment(appointment) });
    }

    if (body.action === "confirm") {
      const appointment = await prisma.appointment.update({
        where: { id: body.id },
        data: { status: "CONFIRMED" },
        include: appointmentInclude,
      });
      return NextResponse.json({ appointment: serializeAppointment(appointment) });
    }

    // reschedule
    const startTime = new Date(body.startTime);
    const endTime = new Date(body.endTime);
    const professionalId = body.professionalId === undefined ? existing.professionalId : body.professionalId;

    const conflict = await findConflict({
      departmentId: existing.departmentId,
      professionalId,
      startTime,
      endTime,
      excludeAppointmentId: existing.id,
    });

    if (conflict) {
      return NextResponse.json({ error: "Esse horário já está ocupado. Escolha outro horário." }, { status: 409 });
    }

    const appointment = await prisma.appointment.update({
      where: { id: body.id },
      data: { startTime, endTime, professionalId, status: existing.status === "CANCELLED" ? "CONFIRMED" : existing.status },
      include: appointmentInclude,
    });

    await cancelReminderBestEffort(existing.leadId, existing.startTime);
    const reminderTime = new Date(startTime.getTime() - APPOINTMENT_REMINDER_HOURS_BEFORE * 60 * 60 * 1000);
    if (reminderTime.getTime() > Date.now()) {
      await scheduleFollowUp(existing.leadId, existing.departmentId, reminderTime);
    }

    return NextResponse.json({ appointment: serializeAppointment(appointment) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível atualizar o agendamento." },
      { status: 400 },
    );
  }
}

/**
 * Não há FK appointment -> followup: cancela (best-effort) o lembrete PENDING
 * do lead agendado para 2h antes do horário antigo do appointment.
 */
async function cancelReminderBestEffort(leadId: string, oldStartTime: Date) {
  const prisma = getPrismaClient();
  const reminderTime = new Date(oldStartTime.getTime() - APPOINTMENT_REMINDER_HOURS_BEFORE * 60 * 60 * 1000);
  await prisma.scheduledFollowUp.updateMany({
    where: {
      leadId,
      status: "PENDING",
      scheduledFor: {
        gte: new Date(reminderTime.getTime() - 60_000),
        lte: new Date(reminderTime.getTime() + 60_000),
      },
    },
    data: { status: "CANCELLED" },
  });
}
