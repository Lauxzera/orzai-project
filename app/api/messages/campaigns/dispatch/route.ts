import { NextResponse } from "next/server";
import { canEditCrm } from "@/lib/crm";
import type { MessageCampaignRecipient } from "@/lib/messages";
import { getSessionUser } from "@/lib/server/auth";
import { getCrmState } from "@/lib/server/crm-repository";
import { createLogger } from "@/lib/server/logger";
import { findMessageCampaign, listMessageCampaigns, updateMessageCampaign } from "@/lib/server/message-campaign-store";
import {
  buildTemplateParams,
  getCampaignTemplateConfig,
  renderCampaignFreeText,
} from "@/lib/server/message-campaign-template";
import { MetaApiError, getResolvedWhatsAppConfig, sendMessageViaAPI, sendTemplateMessageViaAPI } from "@/lib/server/messages-client";
import { findConversationByLeadId } from "@/lib/server/messages-repository";
import { isServiceWindowClosedError, isWithinServiceWindow } from "@/lib/server/whatsapp-service-window";

const AUTO_PAUSE_FAILURE_THRESHOLD = 3;
const logger = createLogger("messages/campaigns/dispatch");

const FALLBACK_TEMPLATE_NAME = (process.env.WHATSAPP_FALLBACK_TEMPLATE_NAME ?? "").trim();
const FALLBACK_TEMPLATE_LANGUAGE = (process.env.WHATSAPP_FALLBACK_TEMPLATE_LANGUAGE ?? "pt_BR").trim();
const SERVICE_WINDOW_CLOSED_MESSAGE =
  "Fora da janela de atendimento de 24h e nenhum template de reengajamento configurado (WHATSAPP_FALLBACK_TEMPLATE_NAME).";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  if (!canEditCrm(user.role)) {
    return NextResponse.json({ error: "Seu perfil nao pode disparar campanhas." }, { status: 403 });
  }

  const config = await getResolvedWhatsAppConfig();
  if (!config.configured) {
    return NextResponse.json(
      {
        error:
          "A Evolution foi removida do CRM. O disparo de campanhas voltara quando a integracao oficial da WhatsApp Business Platform for concluida.",
      },
      { status: 400 },
    );
  }

  const campaigns = await listMessageCampaigns();
  const now = Date.now();
  const activeCampaign = campaigns.find(
    (campaign: Awaited<ReturnType<typeof listMessageCampaigns>>[number]) =>
      campaign.status === "running" &&
      campaign.recipients.some((recipient: MessageCampaignRecipient) => recipient.status === "pending") &&
      (!campaign.nextDispatchAt || new Date(campaign.nextDispatchAt).getTime() <= now)
  );

  if (!activeCampaign) {
    return NextResponse.json({ processed: false });
  }

  const state = await getCrmState();
  const leadMap = new Map(state.leads.map((lead) => [lead.id, lead]));
  const nextRecipient = activeCampaign.recipients.find((recipient: MessageCampaignRecipient) => recipient.status === "pending");
  if (!nextRecipient) {
    await finalizeCampaign(activeCampaign.id);
    return NextResponse.json({ processed: false });
  }

  const lead = leadMap.get(nextRecipient.leadId) ?? null;

  if (!lead) {
    await updateMessageCampaign(activeCampaign.id, (campaign) => ({
      ...campaign,
      recipients: campaign.recipients.map((recipient): MessageCampaignRecipient =>
        recipient.leadId === nextRecipient.leadId
          ? { ...recipient, status: "skipped" as const, error: "Lead não encontrado — pode ter sido excluído." }
          : recipient
      ),
      updatedAt: new Date().toISOString(),
    }));
    return NextResponse.json({ processed: true, campaignId: activeCampaign.id, recipientId: nextRecipient.leadId, skipped: true });
  }

  const conversation = await findConversationByLeadId(lead.id);
  const withinWindow = isWithinServiceWindow(conversation);
  const campaignTemplateConfig = nextRecipient.templateConfig || getCampaignTemplateConfig(activeCampaign);
  const templateName = campaignTemplateConfig.metaTemplateName || FALLBACK_TEMPLATE_NAME;
  const templateLanguage = campaignTemplateConfig.metaTemplateLanguage || FALLBACK_TEMPLATE_LANGUAGE;
  const mode = campaignTemplateConfig.mode || "hybrid";
  const shouldUseTemplate = mode === "meta_template" || (mode === "hybrid" && !withinWindow);
  const selectedRoute = shouldUseTemplate ? "meta_template" : withinWindow ? "free_text" : "skip";
  const content = renderCampaignFreeText(activeCampaign.messageTemplate, lead, nextRecipient.leadName, nextRecipient.phone);
  const templateParams = buildTemplateParams(lead, campaignTemplateConfig.variableKeys, {
    fallbackName: nextRecipient.leadName,
    phone: nextRecipient.phone,
  });

  if (selectedRoute === "skip" || (shouldUseTemplate && !templateName)) {
    // Modo "free_text" fora da janela e uma escolha deliberada do usuario (texto livre
    // so funciona dentro da janela); ja modo template/hibrido sem nome configurado e
    // pendencia de configuracao. A mensagem exibida diferencia os dois casos.
    const skipReason =
      mode === "free_text"
        ? "Fora da janela de atendimento de 24h. Este disparo usa o modo \"Somente texto\", que nao tenta template — escolha o modo Hibrido ou Somente template para alcancar este lead."
        : SERVICE_WINDOW_CLOSED_MESSAGE;
    const updated = await updateMessageCampaign(activeCampaign.id, (campaign) => ({
      ...campaign,
      recipients: campaign.recipients.map((recipient): MessageCampaignRecipient =>
        recipient.leadId === nextRecipient.leadId
          ? {
              ...recipient,
              status: "skipped" as const,
              eligibility: "outside_service_window_without_template",
              selectedRoute: "skip",
              processedAt: new Date().toISOString(),
              error: skipReason,
            }
          : recipient
      ),
      updatedAt: new Date().toISOString(),
      nextDispatchAt: new Date(Date.now() + campaign.delaySeconds * 1000).toISOString(),
    }));
    logger.warn("destinatario pulado: fora da janela de 24h sem rota de envio disponivel", {
      campaignId: activeCampaign.id,
      leadId: lead.id,
      mode,
    });
    return NextResponse.json({
      processed: true,
      campaignId: activeCampaign.id,
      recipientId: nextRecipient.leadId,
      skipped: true,
      reason: skipReason,
      status: updated?.status ?? activeCampaign.status,
    });
  }

  try {
    const sentMessage = selectedRoute === "free_text"
      ? await sendMessageViaAPI(config, nextRecipient.phone, content)
      : await sendTemplateMessageViaAPI(config, {
          phone: nextRecipient.phone,
          templateName,
          languageCode: templateLanguage,
          bodyParams: templateParams.params,
        });
    const updated = await updateMessageCampaign(activeCampaign.id, (campaign) => {
      const recipients: MessageCampaignRecipient[] = campaign.recipients.map((recipient) =>
        recipient.leadId === nextRecipient.leadId
          ? {
              ...recipient,
              status: "sent" as const,
              eligibility: withinWindow ? "within_service_window" : "outside_service_window_with_template",
              selectedRoute,
              templateParams: selectedRoute === "meta_template" ? templateParams.snapshot : undefined,
              processedAt: new Date().toISOString(),
              sentAt: new Date().toISOString(),
              error: undefined,
              lastMessageId: sentMessage.id,
            }
          : recipient
      );
      const pendingLeft = recipients.some((recipient) => recipient.status === "pending");
      return {
        ...campaign,
        recipients,
        updatedAt: new Date().toISOString(),
        nextDispatchAt: pendingLeft ? new Date(Date.now() + campaign.delaySeconds * 1000).toISOString() : undefined,
        status: pendingLeft ? campaign.status : "completed",
        completedAt: pendingLeft ? undefined : new Date().toISOString(),
      };
    });

    return NextResponse.json({
      processed: true,
      campaignId: activeCampaign.id,
      recipientId: nextRecipient.leadId,
      messageId: sentMessage.id,
      status: updated?.status ?? activeCampaign.status,
    });
  } catch (error) {
    const windowClosed = error instanceof MetaApiError && isServiceWindowClosedError(error);
    logger.error("falha ao enviar mensagem de campanha", error, {
      campaignId: activeCampaign.id,
      leadId: nextRecipient.leadId,
      windowClosed,
    });

    const updated = await updateMessageCampaign(activeCampaign.id, (campaign) => {
      const recipients = campaign.recipients.map((recipient): MessageCampaignRecipient =>
        recipient.leadId === nextRecipient.leadId
          ? windowClosed
            ? {
                ...recipient,
                status: "skipped" as const,
                eligibility: "outside_service_window_without_template",
                selectedRoute: "skip",
                processedAt: new Date().toISOString(),
                error: SERVICE_WINDOW_CLOSED_MESSAGE,
              }
            : {
                ...recipient,
                status: "failed" as const,
                eligibility: withinWindow ? "within_service_window" : "outside_service_window_with_template",
                selectedRoute,
                templateParams: selectedRoute === "meta_template" ? templateParams.snapshot : undefined,
                processedAt: new Date().toISOString(),
                failedAt: new Date().toISOString(),
                error: error instanceof Error ? error.message : "Falha no envio.",
              }
          : recipient
      );
      const consecutiveFailures = countTrailingFailedRecipients(recipients);
      const shouldPause = !windowClosed && consecutiveFailures >= AUTO_PAUSE_FAILURE_THRESHOLD;
      return {
        ...campaign,
        recipients,
        updatedAt: new Date().toISOString(),
        nextDispatchAt: shouldPause ? undefined : new Date(Date.now() + campaign.delaySeconds * 1000).toISOString(),
        status: shouldPause ? "paused" : campaign.status,
      };
    });

    return NextResponse.json({
      processed: true,
      campaignId: activeCampaign.id,
      recipientId: nextRecipient.leadId,
      error: error instanceof Error ? error.message : "Falha no envio.",
      status: updated?.status ?? activeCampaign.status,
    });
  }
}

async function finalizeCampaign(campaignId: string) {
  const campaign = await findMessageCampaign(campaignId);
  if (!campaign) return;
  await updateMessageCampaign(campaignId, (current) => ({
    ...current,
    status: "completed",
    nextDispatchAt: undefined,
    updatedAt: new Date().toISOString(),
    completedAt: current.completedAt ?? new Date().toISOString(),
  }));
}

function countTrailingFailedRecipients(recipients: MessageCampaignRecipient[]) {
  let count = 0;
  for (let index = recipients.length - 1; index >= 0; index -= 1) {
    const recipient = recipients[index];
    if (recipient.status === "failed") {
      count += 1;
      continue;
    }
    if (recipient.status === "pending" || recipient.status === "skipped") {
      continue;
    }
    break;
  }
  return count;
}
