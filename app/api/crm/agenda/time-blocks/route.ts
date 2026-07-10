import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";

const createSchema = z.object({
  departmentId: z.string().min(1),
  professionalId: z.string().min(1).nullish(),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  reason: z.string().min(1).max(200),
});

const deleteSchema = z.object({ id: z.string().min(1) });

function canEdit(role: string) {
  return role !== "VIEWER";
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
    const startTime = new Date(body.startTime);
    const endTime = new Date(body.endTime);

    if (endTime.getTime() <= startTime.getTime()) {
      return NextResponse.json({ error: "O horário final deve ser depois do inicial." }, { status: 400 });
    }

    const prisma = getPrismaClient();
    const timeBlock = await prisma.timeBlock.create({
      data: {
        departmentId: body.departmentId,
        professionalId: body.professionalId ?? null,
        startTime,
        endTime,
        reason: body.reason.trim(),
      },
    });

    return NextResponse.json({
      timeBlock: {
        id: timeBlock.id,
        departmentId: timeBlock.departmentId,
        professionalId: timeBlock.professionalId,
        startTime: timeBlock.startTime.toISOString(),
        endTime: timeBlock.endTime.toISOString(),
        reason: timeBlock.reason,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar o bloqueio." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!canEdit(user.role)) {
    return NextResponse.json({ error: "Você não tem permissão para realizar alterações." }, { status: 403 });
  }

  try {
    const body = deleteSchema.parse(await request.json());
    const prisma = getPrismaClient();
    await prisma.timeBlock.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível remover o bloqueio." },
      { status: 400 },
    );
  }
}
