import "server-only";

import { buildAssignableOwners, buildBlankLead, normalizeCrmCustomizations, UNASSIGNED_OWNER } from "@/lib/crm";
import { applyCrmCommand, findLeadConversationContextByPhone, getCrmCustomizations } from "@/lib/server/crm-repository";

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function buildAutomaticLeadName(contactName: string, contactPhone: string) {
  const normalizedContactName = contactName.trim();
  const normalizedContactPhone = contactPhone.trim();

  if (normalizedContactName && normalizePhone(normalizedContactName) !== normalizePhone(normalizedContactPhone)) {
    return normalizedContactName;
  }

  return `Contato ${normalizedContactPhone || "WhatsApp"}`.trim();
}

/**
 * Cria o lead automatico (e dispara a roleta) no instante em que a primeira mensagem
 * de um contato chega pelo webhook da Meta, em vez de esperar alguem abrir a tela de
 * mensagens (que so cria o lead via polling em ensureLeadsForInboundConversations).
 * Chamadores concorrentes (webhook + polling) podem colidir; a duplicata e rejeitada
 * dentro de applyCrmCommand e ignorada aqui.
 */
export async function ensureAutomaticLeadForWhatsappContact(contactPhone: string, contactName: string) {
  const phone = normalizePhone(contactPhone);
  if (!phone) return;

  const existing = await findLeadConversationContextByPhone(phone);
  if (existing) return;

  const customizations = normalizeCrmCustomizations(await getCrmCustomizations());
  const ownerOptions = buildAssignableOwners(customizations.owners);

  const automaticLead = {
    ...buildBlankLead(customizations, ownerOptions),
    nome: buildAutomaticLeadName(contactName, contactPhone),
    telefone: contactPhone.trim(),
    whatsapp: contactPhone.trim(),
    origem: "WhatsApp",
    origem_detalhe: `Lead criado automaticamente a partir da conversa de ${contactName.trim() || contactPhone.trim()}.`,
    captado_via: "Conversa WhatsApp",
    responsavel: UNASSIGNED_OWNER,
  };

  try {
    await applyCrmCommand(
      {
        type: "upsertLead",
        lead: automaticLead,
        source: "automatic_whatsapp_inbox",
      },
      null,
    );
  } catch (error) {
    console.error("ensureAutomaticLeadForWhatsappContact error", error);
  }
}
