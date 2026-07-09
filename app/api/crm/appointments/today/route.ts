import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const prisma = getPrismaClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      startTime: { gte: startOfDay, lt: endOfDay },
      status: { not: "CANCELLED" },
    },
    orderBy: { startTime: "asc" },
    include: {
      lead: { select: { nome: true, telefone: true, whatsapp: true } },
      department: { select: { name: true } },
    },
  });

  return NextResponse.json({
    appointments: appointments.map((appointment) => ({
      id: appointment.id,
      startTime: appointment.startTime.toISOString(),
      endTime: appointment.endTime.toISOString(),
      status: appointment.status,
      leadName: appointment.lead.nome,
      leadPhone: appointment.lead.whatsapp || appointment.lead.telefone,
      departmentName: appointment.department.name,
    })),
  });
}
