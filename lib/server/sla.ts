import "server-only";

import { LEAD_SLA_HOURS, UNASSIGNED_OWNER } from "@/lib/crm";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { FunnelStatus } from "@/lib/generated/prisma/client";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";

type SlaClient = PrismaClient | Prisma.TransactionClient;

export type SlaCheckReport = {
  released: number;
  leads: Array<{ id: string; nome: string; era: string }>;
};

export async function runSlaCheckWithClient(prisma: SlaClient): Promise<SlaCheckReport> {
  const slaMs = parseInt(process.env.LEAD_SLA_HOURS ?? String(LEAD_SLA_HOURS), 10) * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - slaMs);

  const expired = await prisma.lead.findMany({
    where: {
      statusFunil: FunnelStatus.NOVO_LEAD,
      responsavelNome: { not: UNASSIGNED_OWNER },
      archivedAt: null,
      dataEntrada: { lt: cutoff },
    },
    select: { id: true, nome: true, responsavelNome: true },
  });

  if (!expired.length) return { released: 0, leads: [] };

  await prisma.lead.updateMany({
    where: { id: { in: expired.map((lead) => lead.id) } },
    data: { responsavelNome: UNASSIGNED_OWNER, responsavelId: null },
  });

  await prisma.leadHistory.createMany({
    data: expired.map((lead) => ({
      leadId: lead.id,
      action: "SLA_EXPIRADO",
      note: `Lead liberado para fila após ${LEAD_SLA_HOURS}h sem atendimento (era: ${lead.responsavelNome}).`,
    })),
  });

  return {
    released: expired.length,
    leads: expired.map((lead) => ({ id: lead.id, nome: lead.nome, era: lead.responsavelNome })),
  };
}

export async function runSlaCheck(): Promise<SlaCheckReport | { skipped: true; reason: "no-database" }> {
  if (!process.env.DATABASE_URL) return { skipped: true, reason: "no-database" };

  const prisma = getPrismaClient();
  return runSlaCheckWithClient(prisma);
}
