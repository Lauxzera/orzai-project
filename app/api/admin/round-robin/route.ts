import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { getRoundRobinStatus } from "@/lib/server/round-robin";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Apenas administradores ou gestores podem ver a roleta." }, { status: 403 });
  }

  const status = await getRoundRobinStatus();
  return NextResponse.json(status);
}
