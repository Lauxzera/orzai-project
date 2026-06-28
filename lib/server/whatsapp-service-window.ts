/**
 * Janela de atendimento de 24h da WhatsApp Business Platform: so e permitido
 * enviar mensagem de texto livre dentro de 24h desde a ULTIMA mensagem
 * recebida do cliente (inbound). Fora dela, a Meta exige um Message Template
 * aprovado (rejeita texto livre com o erro 131047).
 */
export const META_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ServiceWindowConversation = {
  lastMessageAt?: string | null;
  lastMessageDirection?: "inbound" | "outbound" | null;
} | null | undefined;

export function isWithinServiceWindow(conversation: ServiceWindowConversation, now: number = Date.now()): boolean {
  if (!conversation) return false;
  if (conversation.lastMessageDirection !== "inbound") return false;
  if (!conversation.lastMessageAt) return false;

  const lastMessageAt = new Date(conversation.lastMessageAt).getTime();
  if (!Number.isFinite(lastMessageAt)) return false;

  return now - lastMessageAt < META_SERVICE_WINDOW_MS;
}

/**
 * code 131047 = "Message failed to send because more than 24 hours have
 * passed since the customer last replied to this number." Tambem aceitamos
 * o subcode 2018278, usado em algumas respostas da Graph API para o mesmo caso.
 */
export function isServiceWindowClosedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: number }).code;
  const subcode = (error as { subcode?: number }).subcode;
  return code === 131047 || subcode === 2018278;
}
