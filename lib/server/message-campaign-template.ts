import type { Lead } from "@/lib/crm";
import {
  MESSAGE_CAMPAIGN_TEMPLATE_VARIABLES,
  type MessageCampaign,
  type MessageCampaignTemplateConfig,
  type MessageCampaignTemplateVariableKey,
} from "@/lib/messages";

const SUPPORTED_VARIABLE_KEYS = new Set(MESSAGE_CAMPAIGN_TEMPLATE_VARIABLES.map((variable) => variable.key));

export function sanitizeTemplateVariableKeys(input: unknown): MessageCampaignTemplateVariableKey[] {
  if (!Array.isArray(input)) return [];
  const unique: MessageCampaignTemplateVariableKey[] = [];
  for (const value of input) {
    if (typeof value !== "string") continue;
    if (!SUPPORTED_VARIABLE_KEYS.has(value as MessageCampaignTemplateVariableKey)) continue;
    if (unique.includes(value as MessageCampaignTemplateVariableKey)) continue;
    unique.push(value as MessageCampaignTemplateVariableKey);
  }
  return unique;
}

export function getCampaignTemplateConfig(campaign: MessageCampaign): MessageCampaignTemplateConfig {
  return (
    campaign.templateConfig ||
    campaign.recipients.find((recipient) => recipient.templateConfig)?.templateConfig || {
      mode: "hybrid",
    }
  );
}

export function buildTemplateParams(
  lead: Lead,
  variableKeys: MessageCampaignTemplateVariableKey[] = [],
  options: { fallbackName: string; phone: string },
) {
  const values: Record<MessageCampaignTemplateVariableKey, string> = {
    nome: lead.nome || options.fallbackName || "aluno(a)",
    curso: lead.curso_de_interesse || "curso de interesse",
    profissao: lead.profissao || "seu perfil",
    telefone: options.phone || lead.whatsapp || lead.telefone || "",
    responsavel: lead.responsavel || "Equipe Base",
    cidade: lead.cidade || "",
    origem: lead.origem || "",
  };

  const params = variableKeys.map((key) => values[key] ?? "");
  const snapshot = Object.fromEntries(variableKeys.map((key, index) => [`{{${index + 1}}}:${key}`, values[key] ?? ""]));

  return { params, snapshot };
}

export function renderCampaignFreeText(template: string, lead: Lead, fallbackName: string, phone: string) {
  const replacements: Record<string, string> = {
    nome: lead.nome || fallbackName,
    curso: lead.curso_de_interesse || "",
    origem: lead.origem || "",
    cidade: lead.cidade || "",
    responsavel: lead.responsavel || "",
    profissao: lead.profissao || "",
    telefone: phone || lead.whatsapp || lead.telefone || "",
  };

  return template.replace(
    /\{(nome|curso|origem|cidade|responsavel|profissao|telefone)\}/gi,
    (_, key: string) => replacements[key.toLowerCase()] || "",
  );
}
