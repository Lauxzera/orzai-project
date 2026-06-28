import { NextRequest, NextResponse } from "next/server";
import { leadListColors, normalizeCrmState, type Lead, type LeadListColor } from "@/lib/crm";
import { getSessionUser } from "@/lib/server/auth";
import { parseCSVBuffer } from "@/lib/server/file-import";
import { applyCrmCommand, getCrmState } from "@/lib/server/crm-repository";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (user.role === "VIEWER") {
    return NextResponse.json({ error: "Você não tem permissão para importar listas." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida. Envie um arquivo via multipart/form-data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Arquivo muito grande. Limite de 5 MB." }, { status: 400 });
  }

  const listId = normalizeText(formData.get("listId"));
  const listName = String(formData.get("listName") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const colorValue = String(formData.get("color") || "blue").trim() as LeadListColor;
  const color = leadListColors.includes(colorValue) ? colorValue : "blue";

  if (!listId && !listName) {
    return NextResponse.json({ error: "Informe uma lista existente ou um nome para criar a nova lista." }, { status: 400 });
  }

  const filename = file.name.toLowerCase();
  const isStructured = filename.endsWith(".csv") || filename.endsWith(".tsv");
  const isPlain = filename.endsWith(".txt") || file.type === "text/plain";
  if (!isStructured && !isPlain) {
    return NextResponse.json({ error: "Formato nao suportado. Use CSV, TSV ou TXT." }, { status: 400 });
  }

  const state = normalizeCrmState(await getCrmState());
  const rows = await parseRows(file, isStructured);
  if (!rows.length) {
    return NextResponse.json({ error: "Nenhum identificador encontrado no arquivo." }, { status: 400 });
  }

  const match = matchRowsToLeads(rows, state.leads);
  const targetList = listId ? state.leadLists.find((item) => item.id === listId) ?? null : null;

  const nextLeadIds = targetList
    ? [...new Set([...targetList.leadIds, ...match.leadIds])]
    : match.leadIds;

  const nextState = targetList
    ? await applyCrmCommand(
        {
          type: "updateLeadList",
          listId: targetList.id,
          name: targetList.name,
          description: targetList.description,
          color: targetList.color,
          leadIds: nextLeadIds,
        },
        user
      )
    : await applyCrmCommand(
        {
          type: "createLeadList",
          name: listName,
          description,
          color,
          leadIds: nextLeadIds,
        },
        user
      );

  const resolvedListName = targetList?.name || listName;

  return NextResponse.json({
    state: nextState,
    summary: {
      listName: resolvedListName,
      matched: match.leadIds.length,
      unmatched: match.unmatched,
      duplicates: match.duplicates,
      rowsRead: rows.length,
    },
  });
}

async function parseRows(file: File, structured: boolean) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (structured) {
    return parseCSVBuffer(buffer).flatMap((row) => Object.values(row).map((value) => value.trim()).filter(Boolean));
  }

  return buffer
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function matchRowsToLeads(rows: string[], leads: Lead[]) {
  const byId = new Map(leads.map((lead) => [lead.id.toLowerCase(), lead.id]));
  const byPhone = new Map(leads.map((lead) => [normalizePhone(lead.telefone || lead.whatsapp), lead.id]));
  const byEmail = new Map(leads.map((lead) => [normalizeText(lead.email), lead.id]));
  const byName = new Map(leads.map((lead) => [normalizeText(lead.nome), lead.id]));
  const matched = new Set<string>();
  let duplicates = 0;
  let unmatched = 0;

  for (const row of rows) {
    const raw = row.trim();
    if (!raw) continue;
    const normalizedText = normalizeText(raw);
    const normalizedPhone = normalizePhone(raw);
    const leadId =
      byId.get(raw.toLowerCase()) ||
      (normalizedPhone ? byPhone.get(normalizedPhone) : undefined) ||
      (normalizedText ? byEmail.get(normalizedText) : undefined) ||
      (normalizedText ? byName.get(normalizedText) : undefined);

    if (!leadId) {
      unmatched++;
      continue;
    }
    if (matched.has(leadId)) {
      duplicates++;
      continue;
    }
    matched.add(leadId);
  }

  return {
    leadIds: [...matched],
    duplicates,
    unmatched,
  };
}

function normalizeText(value: FormDataEntryValue | string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizePhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}
