import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const prisma = getPrismaClient();
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      businessHours: true,
      professionals: {
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, businessHours: true },
      },
    },
  });

  return NextResponse.json({ departments });
}
