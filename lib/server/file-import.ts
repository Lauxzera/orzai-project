import "server-only";

import {
  blankLead,
  courses,
  currentDate,
  enrollmentStatuses,
  funnelStatuses,
  origins,
  owners,
  type EnrollmentStatus,
  type FunnelStatus,
  type Lead,
} from "@/lib/crm";

export type FileImportSummary = {
  imported: number;
  skipped: number;
  errors: string[];
  rowsRead: number;
};

type ImportedLeadInput = Omit<
  Lead,
  | "id"
  | "history"
  | "predictive_score"
  | "predictive_score_confidence"
  | "predictive_score_reasons"
  | "predictive_score_risks"
  | "predictive_score_source"
  | "predictive_score_updated_at"
>;
type SheetRecord = Record<string, string>;

const HEADER_ALIASES: Record<keyof ImportedLeadInput, string[]> = {
  nome: ["nome", "nome completo", "lead", "name"],
  telefone: ["telefone", "telefone principal", "phone", "celular", "telefone/whatsapp"],
  whatsapp: ["whatsapp", "telefone whatsapp", "zap"],
  email: ["email", "e-mail", "mail"],
  curso_de_interesse: ["curso", "curso de interesse", "curso_interesse", "interesse"],
  origem: ["origem", "source", "canal", "canal de origem", "midia", "media"],
  origem_detalhe: ["origem detalhe", "origem_detalhe", "detalhe da origem", "campaign detail"],
  captado_via: ["captado via", "captado_via", "metodo de captura", "capture method"],
  utm_source: ["utm_source", "utm source"],
  utm_medium: ["utm_medium", "utm medium"],
  utm_campaign: ["utm_campaign", "utm campaign"],
  utm_term: ["utm_term", "utm term"],
  utm_content: ["utm_content", "utm content"],
  tracking_referrer: ["tracking_referrer", "referrer", "origem do clique"],
  tracking_landing_page: ["tracking_landing_page", "landing page", "pagina de entrada"],
  tracking_id: ["tracking_id", "tracking id", "click id"],
  status_funil: ["status", "status funil", "funil", "etapa", "pipeline"],
  status_matricula: ["status matricula", "matricula"],
  responsavel: ["responsavel", "owner", "atendente", "consultora"],
  data_entrada: ["data entrada", "data de entrada", "data", "created_at"],
  proximo_contato: ["proximo contato", "follow up", "follow-up", "next_contact"],
  objecao_principal: ["objecao", "objecao principal", "motivo"],
  observacoes: ["observacoes", "obs", "notas"],
  ja_foi_aluno: ["ja foi aluno", "ex aluno", "ex-aluno"],
  cidade: ["cidade", "city"],
  profissao: ["profissao", "occupation"],
};

// ─── CSV ────────────────────────────────────────────────────────────────────

function splitCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && line.slice(i, i + sep.length) === sep) {
      result.push(current.trim());
      current = "";
      i += sep.length - 1;
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function detectSeparator(headerLine: string): string {
  const candidates = [";", "\t", ",", "|"];
  let best = ",";
  let bestCount = 0;
  for (const sep of candidates) {
    const count = headerLine.split(sep).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = sep;
    }
  }
  return best;
}

export function parseCSVBuffer(buffer: Buffer): SheetRecord[] {
  const text = buffer.toString("utf-8").replace(/^﻿/, ""); // strip BOM
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const sep = detectSeparator(lines[0]);
  const headers = splitCSVLine(lines[0], sep).map(normalizeText);

  return lines
    .slice(1)
    .map((line) => splitCSVLine(line, sep))
    .filter((cells) => cells.some((c) => c.trim()))
    .map((cells) =>
      headers.reduce<SheetRecord>((acc, header, i) => {
        if (header) acc[header] = cells[i]?.trim() ?? "";
        return acc;
      }, {})
    );
}

// ─── PDF ────────────────────────────────────────────────────────────────────

function splitPDFLine(line: string): string[] {
  // Try tab first, then 2+ spaces, then semicolon, then comma
  if (line.includes("\t")) return line.split("\t").map((s) => s.trim());
  if (/\s{2,}/.test(line)) return line.split(/\s{2,}/).map((s) => s.trim());
  if (line.includes(";")) return line.split(";").map((s) => s.trim());
  if (line.includes(",")) return line.split(",").map((s) => s.trim());
  return [line.trim()];
}

function isLikelyHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const allAliases = Object.values(HEADER_ALIASES).flat();
  const matches = cells.filter((c) => {
    const norm = normalizeText(c);
    return allAliases.some((alias) => normalizeText(alias) === norm || norm.includes(normalizeText(alias)));
  });
  return matches.length >= 2;
}

export async function parsePDFBuffer(buffer: Buffer): Promise<SheetRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
  const data = await pdfParse(buffer);
  const rawText = data.text;

  const lines = rawText
    .split(/\r?\n/)
    .map((l: string) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  // Find header row
  let headerLineIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cells = splitPDFLine(lines[i]);
    if (isLikelyHeaderRow(cells)) {
      headerLineIndex = i;
      break;
    }
  }

  // No header found — try treating first line as header anyway
  if (headerLineIndex === -1) headerLineIndex = 0;

  const headers = splitPDFLine(lines[headerLineIndex]).map(normalizeText);

  return lines
    .slice(headerLineIndex + 1)
    .map(splitPDFLine)
    .filter((cells: string[]) => cells.some((c: string) => c.trim()))
    .map((cells: string[]) =>
      headers.reduce<SheetRecord>((acc, header, i) => {
        if (header) acc[header] = cells[i]?.trim() ?? "";
        return acc;
      }, {})
    );
}

// ─── Lead mapping ────────────────────────────────────────────────────────────

function mapRowToLead(row: SheetRecord, source: string): ImportedLeadInput {
  const pick = (field: keyof ImportedLeadInput) => {
    for (const alias of HEADER_ALIASES[field]) {
      const value = row[normalizeText(alias)];
      if (value) return value.trim();
    }
    return "";
  };

  const telefone = pick("telefone");
  const whatsapp = pick("whatsapp") || telefone;
  const curso = matchOption(pick("curso_de_interesse"), courses) || pick("curso_de_interesse");
  const origem = matchOption(pick("origem"), origins) || blankLead.origem;
  const responsavel = matchOption(pick("responsavel"), owners) || "Equipe Comercial";
  const statusFunil = (matchOption(pick("status_funil"), funnelStatuses) as FunnelStatus | "") || "Novo Lead";
  const statusMatricula =
    (matchOption(pick("status_matricula"), enrollmentStatuses) as EnrollmentStatus | "") || blankLead.status_matricula;
  const dataEntrada = normalizeDateInput(pick("data_entrada")) || currentDate(0);
  const proximoContato = normalizeDateInput(pick("proximo_contato")) || currentDate(1);
  const jaFoiAluno = normalizeBooleanLike(pick("ja_foi_aluno")) ? "Sim" : blankLead.ja_foi_aluno;

  return {
    ...blankLead,
    nome: pick("nome"),
    telefone,
    whatsapp,
    email: pick("email"),
    curso_de_interesse: curso || blankLead.curso_de_interesse,
    origem,
    origem_detalhe: pick("origem_detalhe") || `Importado via ${source}.`,
    captado_via: pick("captado_via") || `Importação ${source}`,
    utm_source: pick("utm_source"),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
    utm_term: pick("utm_term"),
    utm_content: pick("utm_content"),
    tracking_referrer: pick("tracking_referrer"),
    tracking_landing_page: pick("tracking_landing_page"),
    tracking_id: pick("tracking_id"),
    status_funil: statusFunil,
    status_matricula: statusMatricula,
    responsavel,
    data_entrada: dataEntrada,
    proximo_contato: proximoContato,
    objecao_principal: pick("objecao_principal"),
    observacoes: joinNotes([pick("observacoes"), `Importado via ${source}.`]),
    ja_foi_aluno: jaFoiAluno,
    cidade: pick("cidade"),
    profissao: pick("profissao"),
  };
}

export function processLeadRows(
  rows: SheetRecord[],
  existingLeads: Lead[],
  source: string
): { summary: FileImportSummary; leads: ImportedLeadInput[] } {
  const summary: FileImportSummary = { imported: 0, skipped: 0, errors: [], rowsRead: rows.length };
  const pendingLeads: ImportedLeadInput[] = [];

  const knownPhones = new Set(existingLeads.map((l) => normalizePhone(l.telefone || l.whatsapp)));
  const knownEmails = new Set(existingLeads.map((l) => normalizeText(l.email)));

  rows.forEach((row, index) => {
    try {
      const mapped = mapRowToLead(row, source);

      if (!mapped.nome || !mapped.telefone) {
        summary.skipped++;
        summary.errors.push(`Linha ${index + 2}: faltam nome ou telefone.`);
        return;
      }

      const phoneKey = normalizePhone(mapped.telefone || mapped.whatsapp);
      const emailKey = normalizeText(mapped.email);
      const isDuplicate =
        (phoneKey && knownPhones.has(phoneKey)) ||
        (emailKey && knownEmails.has(emailKey)) ||
        pendingLeads.some((l) => {
          const pp = normalizePhone(l.telefone || l.whatsapp);
          const pe = normalizeText(l.email);
          return (phoneKey && pp === phoneKey) || (emailKey && pe === emailKey);
        });

      if (isDuplicate) {
        summary.skipped++;
        return;
      }

      if (phoneKey) knownPhones.add(phoneKey);
      if (emailKey) knownEmails.add(emailKey);
      pendingLeads.push(mapped);
      summary.imported++;
    } catch (error) {
      summary.skipped++;
      summary.errors.push(`Linha ${index + 2}: ${error instanceof Error ? error.message : "erro ao processar"}`);
    }
  });

  return { summary, leads: pendingLeads };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function matchOption<T extends readonly string[]>(value: string, options: T) {
  const norm = normalizeText(value);
  if (!norm) return "";
  return options.find((o) => normalizeText(o) === norm) ?? "";
}

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizePhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeDateInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return "";
}

function normalizeBooleanLike(value: string) {
  return ["sim", "yes", "true", "1"].includes(normalizeText(value));
}

function joinNotes(parts: string[]) {
  return parts.filter(Boolean).join(" ");
}
