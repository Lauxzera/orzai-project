import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";
import { Prisma } from "@/lib/generated/prisma/client";
import { businessHoursSchema } from "@/lib/server/agenda/business-hours-schema";

const createSchema = z.object({
  departmentId: z.string().min(1),
  name: z.string().min(1).max(120),
});

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  active: z.boolean().optional(),
  businessHours: businessHoursSchema.nullable().optional(),
});

function canManage(role: string) {
  return role === "ADMIN" || role === "MANAGER";
}

function serialize(professional: {
  id: string;
  name: string;
  departmentId: string;
  businessHours: unknown;
  active: boolean;
}) {
  return {
    id: professional.id,
    name: professional.name,
    departmentId: professional.departmentId,
    businessHours: professional.businessHours,
    active: professional.active,
  };
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "Apenas administradores e gestores podem gerenciar profissionais." }, { status: 403 });
  }

  try {
    const body = createSchema.parse(await request.json());
    const prisma = getPrismaClient();
    const professional = await prisma.professional.create({
      data: { departmentId: body.departmentId, name: body.name.trim() },
    });
    return NextResponse.json({ professional: serialize(professional) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar o profissional." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "Apenas administradores e gestores podem gerenciar profissionais." }, { status: 403 });
  }

  try {
    const body = patchSchema.parse(await request.json());
    const prisma = getPrismaClient();
    const professional = await prisma.professional.update({
      where: { id: body.id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.businessHours !== undefined
          ? { businessHours: body.businessHours === null ? Prisma.JsonNull : body.businessHours }
          : {}),
      },
    });
    return NextResponse.json({ professional: serialize(professional) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível atualizar o profissional." },
      { status: 400 },
    );
  }
}
