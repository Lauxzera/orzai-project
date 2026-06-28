import { afterEach, describe, expect, it, vi } from "vitest";
import { runSlaCheckWithClient } from "@/lib/server/sla";
import { UNASSIGNED_OWNER } from "@/lib/crm";
import { FunnelStatus } from "@/lib/generated/prisma/client";

type LeadRow = {
  id: string;
  nome: string;
  responsavelNome: string;
  statusFunil: keyof typeof FunnelStatus;
  archivedAt: Date | null;
  dataEntrada: Date;
};

function createMockPrisma(leads: LeadRow[]) {
  const updated: string[] = [];
  const historyEntries: Array<{ leadId: string; action: string; note: string }> = [];

  return {
    lead: {
      findMany: async ({ where }: { where: { dataEntrada: { lt: Date } } }) =>
        leads.filter(
          (lead) =>
            lead.statusFunil === FunnelStatus.NOVO_LEAD &&
            lead.responsavelNome !== UNASSIGNED_OWNER &&
            !lead.archivedAt &&
            lead.dataEntrada < where.dataEntrada.lt,
        ),
      updateMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        updated.push(...where.id.in);
        return { count: where.id.in.length };
      },
    },
    leadHistory: {
      createMany: async ({ data }: { data: Array<{ leadId: string; action: string; note: string }> }) => {
        historyEntries.push(...data);
        return { count: data.length };
      },
    },
    _internals: { updated, historyEntries },
  };
}

describe("runSlaCheckWithClient", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("nao libera leads dentro do prazo do SLA", async () => {
    const prisma = createMockPrisma([
      {
        id: "lead-1",
        nome: "Recente",
        responsavelNome: "Ana",
        statusFunil: FunnelStatus.NOVO_LEAD,
        archivedAt: null,
        dataEntrada: new Date(),
      },
    ]);

    const report = await runSlaCheckWithClient(prisma as never);
    expect(report.released).toBe(0);
    expect(prisma._internals.updated).toEqual([]);
  });

  it("libera leads NOVO_LEAD atribuidos ha mais de LEAD_SLA_HOURS", async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const prisma = createMockPrisma([
      {
        id: "lead-1",
        nome: "Atrasado",
        responsavelNome: "Ana",
        statusFunil: FunnelStatus.NOVO_LEAD,
        archivedAt: null,
        dataEntrada: threeHoursAgo,
      },
    ]);

    const report = await runSlaCheckWithClient(prisma as never);
    expect(report.released).toBe(1);
    expect(report.leads).toEqual([{ id: "lead-1", nome: "Atrasado", era: "Ana" }]);
    expect(prisma._internals.updated).toEqual(["lead-1"]);
    expect(prisma._internals.historyEntries[0]).toMatchObject({ leadId: "lead-1", action: "SLA_EXPIRADO" });
  });

  it("ignora leads que ja estao sem responsavel ou fora de NOVO_LEAD", async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const prisma = createMockPrisma([
      {
        id: "lead-1",
        nome: "Sem dono",
        responsavelNome: UNASSIGNED_OWNER,
        statusFunil: FunnelStatus.NOVO_LEAD,
        archivedAt: null,
        dataEntrada: threeHoursAgo,
      },
      {
        id: "lead-2",
        nome: "Ja avancou",
        responsavelNome: "Ana",
        statusFunil: FunnelStatus.NEGOCIACAO_MATRICULA,
        archivedAt: null,
        dataEntrada: threeHoursAgo,
      },
      {
        id: "lead-3",
        nome: "Arquivado",
        responsavelNome: "Ana",
        statusFunil: FunnelStatus.NOVO_LEAD,
        archivedAt: new Date(),
        dataEntrada: threeHoursAgo,
      },
    ]);

    const report = await runSlaCheckWithClient(prisma as never);
    expect(report.released).toBe(0);
  });
});
