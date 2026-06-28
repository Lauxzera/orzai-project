import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { getMessagingConnection } from "@/lib/server/messages-repository";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const connection = await getMessagingConnection();
  return NextResponse.json(
    {
      ok: false,
      provider: "meta",
      connection,
      error: "A Cloud API oficial do WhatsApp nao possui fluxo de desconexao por QR code dentro do CRM.",
    },
    { status: 400 },
  );
}
