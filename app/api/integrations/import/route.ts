import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { batchInsertLeads, getCrmState } from "@/lib/server/crm-repository";
import { parseCSVBuffer, parsePDFBuffer, processLeadRows } from "@/lib/server/file-import";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (user.role === "VIEWER")
    return NextResponse.json({ error: "Você não tem permissão para importar leads." }, { status: 403 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida. Envie um arquivo via multipart/form-data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado. Use o campo 'file'." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Arquivo muito grande. Limite: 5 MB." }, { status: 400 });
  }

  const filename = file.name.toLowerCase();
  const isPDF = filename.endsWith(".pdf") || file.type === "application/pdf";
  const isCSV =
    filename.endsWith(".csv") ||
    filename.endsWith(".tsv") ||
    file.type === "text/csv" ||
    file.type === "text/plain";

  if (!isPDF && !isCSV) {
    return NextResponse.json(
      { error: "Formato não suportado. Envie um arquivo CSV ou PDF." },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = isPDF ? await parsePDFBuffer(buffer) : parseCSVBuffer(buffer);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma linha encontrada no arquivo. Verifique o formato e tente novamente." },
        { status: 400 }
      );
    }

    const currentState = await getCrmState();
    const source = isPDF ? "PDF" : "CSV";
    const { summary, leads } = processLeadRows(rows, currentState.leads, source);

    await batchInsertLeads(leads, user);

    const state = await getCrmState();
    return NextResponse.json({ state, summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível processar o arquivo." },
      { status: 400 }
    );
  }
}
