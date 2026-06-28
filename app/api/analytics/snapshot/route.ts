import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { createLogger } from "@/lib/server/logger";
import { listConversationBundlesForUser } from "@/lib/server/messages-repository";

const logger = createLogger("analytics/snapshot");

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const data = await listConversationBundlesForUser(user);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    logger.error("falha ao carregar snapshot do analytics", error, { userId: user.id });
    return NextResponse.json({ error: "Não foi possível carregar o snapshot do analytics." }, { status: 500 });
  }
}
