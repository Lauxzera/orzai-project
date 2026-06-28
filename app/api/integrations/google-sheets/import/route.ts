import { NextResponse } from "next/server";
import { applyCrmCommand, getCrmState } from "@/lib/server/crm-repository";
import { getSessionUser } from "@/lib/server/auth";
import { getGoogleSheetsConfigStatus, importLeadsFromGoogleSheets } from "@/lib/server/google-sheets";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (user.role === "VIEWER") {
    return NextResponse.json({ error: "Você não tem permissão para importar leads." }, { status: 403 });
  }

  try {
    const googleSheetsConfig = getGoogleSheetsConfigStatus();
    if (!googleSheetsConfig.configured) {
      return NextResponse.json(
        {
          error: `Integracao com Google Sheets nao configurada. Variaveis pendentes: ${googleSheetsConfig.missing.join(", ")}.`,
          config: googleSheetsConfig,
        },
        { status: 400 }
      );
    }

    const currentState = await getCrmState();
    const { summary, leads } = await importLeadsFromGoogleSheets(currentState.leads);

    for (const lead of leads) {
      await applyCrmCommand({ type: "upsertLead", leadId: null, lead, source: "import" }, user);
    }

    const state = await getCrmState();
    return NextResponse.json({ state, summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ?error.message : "Não foi possível importar a planilha." },
      { status: 400 }
    );
  }
}
