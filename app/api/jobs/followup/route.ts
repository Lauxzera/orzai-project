import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { createLogger } from "@/lib/server/logger";
import { runFollowUpEngine } from "@/features/follow-up/lib/follow-up-engine";

const logger = createLogger("jobs/followup");

function isValidFollowUpToken(token: string | null): boolean {
  const expected = (process.env.FOLLOWUP_TOKEN ?? "").trim();
  if (!expected) return false;
  if (!token) return false;
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(token, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// GET /api/jobs/followup?token=XXX - disparo por cron externo
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");

  if (!isValidFollowUpToken(token)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const report = await runFollowUpEngine();
    logger.info("follow-up concluído (cron)", { report });
    return NextResponse.json(report);
  } catch (error) {
    logger.error("falha ao executar follow-up (cron)", error);
    return NextResponse.json({ error: "Erro ao executar follow-up." }, { status: 500 });
  }
}

// POST /api/jobs/followup - disparo manual pelo admin/manager na UI
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Sem permissão para executar o follow-up." }, { status: 403 });
  }

  try {
    const report = await runFollowUpEngine();
    logger.info("follow-up concluído (manual)", { report, userId: user.id });
    return NextResponse.json(report);
  } catch (error) {
    logger.error("falha ao executar follow-up (manual)", error, { userId: user.id });
    return NextResponse.json({ error: "Erro ao executar follow-up." }, { status: 500 });
  }
}
