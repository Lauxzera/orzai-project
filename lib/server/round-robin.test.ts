import { describe, expect, it } from "vitest";
import { pickNextAgentWithClient } from "@/lib/server/round-robin";
import { UNASSIGNED_OWNER } from "@/lib/crm";

type Agent = { id: string; name: string };

function createMockPrisma(agents: Agent[], initialNextIndex = 0) {
  let nextIndex = initialNextIndex;

  return {
    $executeRaw: async () => undefined,
    user: {
      findMany: async () => [...agents].sort((a, b) => a.name.localeCompare(b.name)),
    },
    roundRobinState: {
      findUnique: async () => ({ nextIndex }),
      upsert: async ({ update }: { update: { nextIndex: number } }) => {
        nextIndex = update.nextIndex;
        return { id: "global", nextIndex };
      },
    },
  };
}

describe("pickNextAgentWithClient", () => {
  it("retorna UNASSIGNED_OWNER quando nao ha agentes elegiveis", async () => {
    const prisma = createMockPrisma([]);
    const result = await pickNextAgentWithClient(prisma as never);
    expect(result).toEqual({ name: UNASSIGNED_OWNER, id: null });
  });

  it("gira entre os agentes em ordem alfabetica, ciclicamente", async () => {
    const agents: Agent[] = [
      { id: "1", name: "Bruna" },
      { id: "2", name: "Ana" },
      { id: "3", name: "Carla" },
    ];
    const prisma = createMockPrisma(agents);

    const picks = [
      await pickNextAgentWithClient(prisma as never),
      await pickNextAgentWithClient(prisma as never),
      await pickNextAgentWithClient(prisma as never),
      await pickNextAgentWithClient(prisma as never),
    ];

    expect(picks.map((p) => p.name)).toEqual(["Ana", "Bruna", "Carla", "Ana"]);
  });

  it("continua a partir do nextIndex persistido", async () => {
    const agents: Agent[] = [
      { id: "1", name: "Ana" },
      { id: "2", name: "Bruna" },
    ];
    const prisma = createMockPrisma(agents, 1);

    const result = await pickNextAgentWithClient(prisma as never);
    expect(result.name).toBe("Bruna");
  });
});
