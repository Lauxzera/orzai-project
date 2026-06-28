import { NextResponse } from "next/server";
import { z } from "zod";
import { canEditCrm, closingStatuses } from "@/lib/crm";
import { MESSAGE_CAMPAIGN_TEMPLATE_VARIABLES, type MessageCampaign, type MessageCampaignTemplateSettings } from "@/lib/messages";
import { getSessionUser } from "@/lib/server/auth";
import { uid } from "@/lib/server/crm/shared";
import { getCrmState } from "@/lib/server/crm-repository";
import { createMessageCampaign, listMessageCampaigns } from "@/lib/server/message-campaign-store";
import { sanitizeTemplateVariableKeys } from "@/lib/server/message-campaign-template";
import { getMetaWhatsAppBusinessAccountId, getResolvedWhatsAppConfig, listMetaMessageTemplates } from "@/lib/server/messages-client";

const MIN_CAMPAIGN_DELAY_SECONDS = 30;
const MAX_CAMPAIGN_DELAY_SECONDS = 1800;
const MAX_RECIPIENTS_PER_CAMPAIGN = 80;
const LARGE_CAMPAIGN_THRESHOLD = 20;
const FALLBACK_TEMPLATE_NAME = (process.env.WHATSAPP_FALLBACK_TEMPLATE_NAME ?? "").trim();
const FALLBACK_TEMPLATE_LANGUAGE = (process.env.WHATSAPP_FALLBACK_TEMPLATE_LANGUAGE ?? "pt_BR").trim();

const createCampaignSchema = z.object({
  title: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().max(120).optional(),
  ),
  messageTemplate: z.string().trim().min(3).max(4000),
  delaySeconds: z.number().int().min(MIN_CAMPAIGN_DELAY_SECONDS).max(MAX_CAMPAIGN_DELAY_SECONDS),
  leadIds: z.array(z.string().min(1)).min(1).max(500),
  confirmLargeCampaign: z.boolean().optional().default(false),
  dispatchMode: z.enum(["free_text", "meta_template", "hybrid"]).optional().default("free_text"),
  metaTemplateName: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]*$/, "O nome do template Meta deve usar apenas minusculas, numeros e _.")
    .max(512)
    .optional()
    .default(""),
  metaTemplateLanguage: z.string().trim().min(2).max(20).optional().default("pt_BR"),
  templateVariableKeys: z.array(z.string()).optional().default([]),
});

function buildDefaultCampaignTitle() {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `Campanha ${formatter.format(new Date()).replace(",", "")}`;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const campaigns = await listMessageCampaigns();
  const templatesSyncConfigured = Boolean(getMetaWhatsAppBusinessAccountId());
  let availableTemplates: MessageCampaignTemplateSettings["availableTemplates"] = [];
  let templatesSyncError: string | undefined;

  if (templatesSyncConfigured) {
    try {
      availableTemplates = await listMetaMessageTemplates(await getResolvedWhatsAppConfig());
    } catch (error) {
      templatesSyncError =
        error instanceof Error ? error.message : "Nao foi possivel sincronizar os templates da Meta.";
    }
  }

  const templateSettings: MessageCampaignTemplateSettings = {
    fallbackTemplateName: FALLBACK_TEMPLATE_NAME,
    fallbackTemplateLanguage: FALLBACK_TEMPLATE_LANGUAGE,
    supportedVariables: MESSAGE_CAMPAIGN_TEMPLATE_VARIABLES,
    availableTemplates,
    templatesSyncConfigured,
    templatesSyncError,
  };
  return NextResponse.json({ campaigns, templateSettings });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canEditCrm(user.role)) {
    return NextResponse.json({ error: "Seu perfil não pode criar campanhas." }, { status: 403 });
  }

  try {
    const payload = createCampaignSchema.parse(await request.json());
    const templateName = payload.dispatchMode === "free_text" ? "" : payload.metaTemplateName || FALLBACK_TEMPLATE_NAME;
    const templateLanguage = payload.metaTemplateLanguage || FALLBACK_TEMPLATE_LANGUAGE;
    const templateVariableKeys = sanitizeTemplateVariableKeys(payload.templateVariableKeys);

    if ((payload.dispatchMode === "meta_template" || payload.dispatchMode === "hybrid") && !templateName) {
      return NextResponse.json(
        { error: "Informe um template Meta aprovado ou configure WHATSAPP_FALLBACK_TEMPLATE_NAME." },
        { status: 400 },
      );
    }

    if (payload.leadIds.length > MAX_RECIPIENTS_PER_CAMPAIGN) {
      return NextResponse.json(
        { error: `Campanhas de teste aceitam no máximo ${MAX_RECIPIENTS_PER_CAMPAIGN} leads por vez.` },
        { status: 400 },
      );
    }
    if (payload.leadIds.length > LARGE_CAMPAIGN_THRESHOLD && !payload.confirmLargeCampaign) {
      return NextResponse.json(
        { error: `Campanhas acima de ${LARGE_CAMPAIGN_THRESHOLD} leads exigem confirmação manual.` },
        { status: 400 },
      );
    }

    const state = await getCrmState();
    const leadMap = new Map(state.leads.map((lead) => [lead.id, lead]));
    const seenPhones = new Set<string>();
    const templateConfig: NonNullable<MessageCampaign["templateConfig"]> = {
      mode: payload.dispatchMode,
      metaTemplateName: templateName,
      metaTemplateLanguage: templateLanguage,
      variableKeys: templateVariableKeys,
    };
    const recipients = payload.leadIds
      .map((leadId) => leadMap.get(leadId))
      .filter((lead): lead is NonNullable<typeof lead> => Boolean(lead))
      .map((lead) => {
        const phone = (lead.whatsapp || lead.telefone).replace(/\D/g, "");
        const normalizedPhone = phone.startsWith("55") ? phone : `55${phone}`;
        const closedLead = closingStatuses.includes(lead.status_funil);
        const duplicatePhone = normalizedPhone ? seenPhones.has(normalizedPhone) : false;
        if (normalizedPhone) seenPhones.add(normalizedPhone);
        return {
          leadId: lead.id,
          leadName: lead.nome,
          phone: normalizedPhone,
          templateConfig,
          status: !normalizedPhone
            ? "skipped"
            : closedLead
              ? "skipped"
              : duplicatePhone
                ? "skipped"
                : "pending",
          error: !normalizedPhone
            ? "Lead sem telefone válido."
            : closedLead
              ? "Lead em status de fechamento; removido da campanha."
              : duplicatePhone
                ? "Telefone duplicado em relação a outro lead da campanha."
                : undefined,
          eligibility: !normalizedPhone
            ? "missing_phone"
            : closedLead
              ? "closed_lead"
              : duplicatePhone
                ? "duplicate_phone"
                : undefined,
        } as MessageCampaign["recipients"][number];
      });

    if (!recipients.length) {
      return NextResponse.json({ error: "Nenhum lead válido foi selecionado." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const normalizedTitle =
      payload.title && payload.title.length >= 3 ? payload.title : buildDefaultCampaignTitle();

    const campaign: MessageCampaign = {
      id: uid("campaign"),
      title: normalizedTitle,
      messageTemplate: payload.messageTemplate,
      delaySeconds: payload.delaySeconds,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      createdByName: user.name,
      templateConfig,
      recipients,
    };

    const created = await createMessageCampaign(campaign);
    return NextResponse.json({ campaign: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map((issue) => issue.message).join(" ");
      return NextResponse.json(
        { error: message || "Revise os dados da campanha antes de continuar." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar a campanha." },
      { status: 400 },
    );
  }
}
