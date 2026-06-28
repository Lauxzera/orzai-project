import "server-only";

import { UNASSIGNED_OWNER } from "@/lib/crm";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";

type RoundRobinClient = PrismaClient | Prisma.TransactionClient;

export async function pickNextAgentWithClient(
  prisma: RoundRobinClient,
): Promise<{ name: string; id: string | null }> {
  await prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('belart-round-robin'))`;

  const agents = await prisma.user.findMany({
    where: { active: true, isAgent: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (!agents.length) return { name: UNASSIGNED_OWNER, id: null };

  const state = await prisma.roundRobinState.findUnique({
    where: { id: "global" },
    select: { nextIndex: true },
  });

  const currentIndex = state?.nextIndex ?? 0;
  const agent = agents[currentIndex % agents.length];
  const nextIndex = (currentIndex + 1) % agents.length;

  await prisma.roundRobinState.upsert({
    where: { id: "global" },
    create: { id: "global", nextIndex },
    update: { nextIndex },
  });

  return { name: agent.name, id: agent.id };
}

export async function pickNextAgent(): Promise<{ name: string; id: string | null }> {
  if (!process.env.DATABASE_URL) return { name: UNASSIGNED_OWNER, id: null };

  const prisma = getPrismaClient();
  return pickNextAgentWithClient(prisma);
}

export type RoundRobinAgentStatus = {
  id: string;
  name: string;
  isNext: boolean;
  activeLeadCount: number;
};

export type RoundRobinStatus = {
  enabled: boolean;
  agents: RoundRobinAgentStatus[];
  unassignedLeadCount: number;
};

/**
 * Visibilidade da fila para a UI de administracao: ordem de rotacao, quem e o proximo
 * a receber um lead, e quantos leads cada atendente tem em aberto hoje.
 */
export async function getRoundRobinStatus(): Promise<RoundRobinStatus> {
  if (!process.env.DATABASE_URL) {
    return { enabled: false, agents: [], unassignedLeadCount: 0 };
  }

  const prisma = getPrismaClient();

  const agents = await prisma.user.findMany({
    where: { active: true, isAgent: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [state, leadCounts, unassignedLeadCount] = await Promise.all([
    prisma.roundRobinState.findUnique({ where: { id: "global" }, select: { nextIndex: true } }),
    prisma.lead.groupBy({
      by: ["responsavelId"],
      where: { archivedAt: null, responsavelId: { in: agents.map((agent) => agent.id) } },
      _count: { _all: true },
    }),
    prisma.lead.count({ where: { archivedAt: null, responsavelNome: UNASSIGNED_OWNER } }),
  ]);

  const countByAgentId = new Map(leadCounts.map((row) => [row.responsavelId, row._count._all]));
  const nextIndex = agents.length ? (state?.nextIndex ?? 0) % agents.length : 0;

  return {
    enabled: agents.length > 0,
    agents: agents.map((agent, index) => ({
      id: agent.id,
      name: agent.name,
      isNext: index === nextIndex,
      activeLeadCount: countByAgentId.get(agent.id) ?? 0,
    })),
    unassignedLeadCount,
  };
}
