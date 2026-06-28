import "server-only";

import { google } from "googleapis";
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

export type GoogleSheetsImportSummary = {
  imported: number;
  skipped: number;
  errors: string[];
  rowsRead: number;
};

export type GoogleSheetsConfigStatus = {
  configured: boolean;
  missing: string[];
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

const GOOGLE_SHEETS_REQUIRED_ENV = [
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "GOOGLE_SHEETS_RANGE",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
] as const;

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
  status_matricula: ["status matricula", "status matricula", "matricula", "matricula"],
  responsavel: ["responsavel", "responsavel", "owner", "atendente", "consultora"],
  data_entrada: ["data entrada", "data de entrada", "data", "created_at"],
  proximo_contato: ["proximo contato", "proximo contato", "follow up", "follow-up", "next_contact"],
  objecao_principal: ["objecao", "objecao", "objecao principal", "motivo"],
  observacoes: ["observacoes", "observacoes", "obs", "notas"],
  ja_foi_aluno: ["ja foi aluno", "ja foi aluno", "ex aluno", "ex-aluno"],
  cidade: ["cidade", "city"],
  profissao: ["profissao", "profissao", "occupation"],
};

export function getGoogleSheetsConfigStatus(): GoogleSheetsConfigStatus {
  const missing = GOOGLE_SHEETS_REQUIRED_ENV.filter((envName) => !process.env[envName]?.trim());
  return {
    configured: missing.length === 0,
    missing,
  };
}

export function hasGoogleSheetsConfig() {
  return getGoogleSheetsConfigStatus().configured;
}

export async function importLeadsFromGoogleSheets(existingLeads: Lead[]) {
  const configStatus = getGoogleSheetsConfigStatus();
  if (!configStatus.configured) {
    throw new Error(
      `Integracao com Google Sheets nao configurada. Variaveis pendentes: ${configStatus.missing.join(", ")}.`
    );
  }

  const rows = await readGoogleSheetRows();
  const summary: GoogleSheetsImportSummary = {
    imported: 0,
    skipped: 0,
    errors: [],
    rowsRead: rows.length,
  };

  const pendingLeads: ImportedLeadInput[] = [];
  const knownPhones = new Set(existingLeads.map((lead) => normalizePhone(lead.telefone || lead.whatsapp)));
  const knownEmails = new Set(existingLeads.map((lead) => normalizeText(lead.email)));

  rows.forEach((row, index) => {
    try {
      const mapped = mapSheetRowToLead(row);
      if (!mapped.nome || !mapped.telefone || !mapped.curso_de_interesse) {
        summary.skipped += 1;
        summary.errors.push(`Linha ${index + 2}: faltam nome, telefone ou curso.`);
        return;
      }

      const phoneKey = normalizePhone(mapped.telefone || mapped.whatsapp);
      const emailKey = normalizeText(mapped.email);
      const isDuplicate =
        (phoneKey && knownPhones.has(phoneKey)) ||
        (emailKey && knownEmails.has(emailKey)) ||
        pendingLeads.some((lead) => {
          const pendingPhone = normalizePhone(lead.telefone || lead.whatsapp);
          const pendingEmail = normalizeText(lead.email);
          return (phoneKey && pendingPhone === phoneKey) || (emailKey && pendingEmail === emailKey);
        });

      if (isDuplicate) {
        summary.skipped += 1;
        return;
      }

      if (phoneKey) knownPhones.add(phoneKey);
      if (emailKey) knownEmails.add(emailKey);
      pendingLeads.push(mapped);
      summary.imported += 1;
    } catch (error) {
      summary.skipped += 1;
      summary.errors.push(`Linha ${index + 2}: ${error instanceof Error ? error.message : "erro ao processar"}`);
    }
  });

  return { summary, leads: pendingLeads };
}

async function readGoogleSheetRows() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    range: process.env.GOOGLE_SHEETS_RANGE,
  });

  const values = response.data.values ?? [];
  if (!values.length) return [];

  const [headerRow, ...dataRows] = values;
  const headers = headerRow.map((cell) => normalizeText(String(cell)));

  return dataRows
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) =>
      headers.reduce<SheetRecord>((acc, header, columnIndex) => {
        if (!header) return acc;
        acc[header] = String(row[columnIndex] ?? "").trim();
        return acc;
      }, {})
    );
}

function mapSheetRowToLead(row: SheetRecord): ImportedLeadInput {
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
    origem_detalhe: pick("origem_detalhe") || "Importado automaticamente do Google Sheets.",
    captado_via: pick("captado_via") || "Google Sheets",
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
    observacoes: joinNotes([pick("observacoes"), "Importado automaticamente do Google Sheets."]),
    ja_foi_aluno: jaFoiAluno,
    cidade: pick("cidade"),
    profissao: pick("profissao"),
  };
}

function matchOption<T extends readonly string[]>(value: string, options: T) {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return "";
  return options.find((option) => normalizeText(option) === normalizedValue) ?? "";
}

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return "";
}

function normalizeBooleanLike(value: string) {
  const normalized = normalizeText(value);
  return ["sim", "yes", "true", "1"].includes(normalized);
}

function joinNotes(parts: string[]) {
  return parts.filter(Boolean).join(" ");
}
