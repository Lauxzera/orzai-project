import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { getResolvedWhatsAppConfig, getWhatsAppConfigDiagnostics } from "@/lib/server/messages-client";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const config = await getResolvedWhatsAppConfig();
  const diagnostics = await getWhatsAppConfigDiagnostics(config);

  return NextResponse.json(
    {
      ...diagnostics,
    },
    { status: 200 },
  );
}
