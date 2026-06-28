import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { createLogger } from "@/lib/server/logger";
import { runSlaCheck } from "@/lib/server/sla";

const logger = createLogger("jobs/check-sla");

function isValidCronSecret(authHeader: string | null): boolean {
  const expected = (process.env.CRON_SECRET ?? "").trim();
  if (!expected || !authHeader) return false;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(token, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// GET /api/jobs/check-sla — disparo por Vercel Cron (Authorization: Bearer <CRON_SECRET>)
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!isValidCronSecret(authHeader)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const report = await runSlaCheck();
    logger.info("verificação de SLA concluída (cron)", { report });
    return NextResponse.json(report);
  } catch (error) {
    logger.error("falha ao executar verificação de SLA (cron)", error);
    return NextResponse.json({ error: "Erro ao executar verificação de SLA." }, { status: 500 });
  }
}

// POST /api/jobs/check-sla — disparo manual pelo admin
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  try {
    const report = await runSlaCheck();
    logger.info("verificação de SLA concluída (manual)", { report, userId: user.id });
    return NextResponse.json(report);
  } catch (error) {
    logger.error("falha ao executar verificação de SLA (manual)", error, { userId: user.id });
    return NextResponse.json({ error: "Erro ao executar verificação de SLA." }, { status: 500 });
  }
}
