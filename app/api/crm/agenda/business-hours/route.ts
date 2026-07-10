import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";
import { businessHoursSchema } from "@/lib/server/agenda/business-hours-schema";

const putSchema = z.object({
  departmentId: z.string().min(1),
  businessHours: businessHoursSchema,
});

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Apenas administradores e gestores podem alterar horários." }, { status: 403 });
  }

  try {
    const body = putSchema.parse(await request.json());
    const prisma = getPrismaClient();
    const department = await prisma.department.update({
      where: { id: body.departmentId },
      data: { businessHours: body.businessHours },
      select: { id: true, name: true, businessHours: true },
    });
    return NextResponse.json({ department });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível salvar os horários." },
      { status: 400 },
    );
  }
}
