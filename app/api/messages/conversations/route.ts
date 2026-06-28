import { NextResponse } from "next/server";
import { z } from "zod";
import { canEditCrm } from "@/lib/crm";
import { getSessionUser } from "@/lib/server/auth";
import { createLogger } from "@/lib/server/logger";
import { generateMessagingQrCode, getMessagingConnection, listConversationsForUser } from "@/lib/server/messages-repository";
import { setStoredConversationUnreadCount } from "@/lib/server/messages-store";

const logger = createLogger("messages/conversations");

const bulkConversationSchema = z.object({
  action: z.enum(["mark-read", "mark-unread"]),
  conversationIds: z.array(z.string().trim().min(1)).min(1).max(250),
});

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  try {
    const searchParams = new URL(request.url).searchParams;
    const compact = searchParams.get("compact") === "1";
    const data = await listConversationsForUser(user, { includeWorkspaces: !compact });
    if (compact) {
      return NextResponse.json({
        connection: data.connection,
        conversations: data.conversations.map((conversation) => ({
          id: conversation.id,
          contactPhone: conversation.contactPhone,
          contactName: conversation.contactName,
          lastMessage: conversation.lastMessage,
          lastMessageAt: conversation.lastMessageAt,
          lastMessageDirection: conversation.lastMessageDirection ?? null,
          unreadCount: conversation.unreadCount,
          leadId: conversation.leadId,
          leadStatus: conversation.leadStatus,
          ownerName: conversation.ownerName ?? null,
        })),
      });
    }
    return NextResponse.json(data);
  } catch (error) {
    logger.error("falha ao buscar conversas", error, { userId: user.id });
    return NextResponse.json({ error: "Nao foi possivel buscar as conversas." }, { status: 500 });
  }
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  try {
    const connection = await generateMessagingQrCode();
    return NextResponse.json(connection);
  } catch (error) {
    logger.error("falha ao gerar QR code de mensageria", error, { userId: user.id });
    const current = await getMessagingConnection().catch(() => null);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "A Evolution foi removida e a integracao oficial do WhatsApp nao usa QR Code neste CRM.",
        connection: current,
      },
      { status: 410 },
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  if (!canEditCrm(user.role)) {
    return NextResponse.json({ error: "Seu perfil nao pode alterar o inbox." }, { status: 403 });
  }

  try {
    const body = bulkConversationSchema.parse(await request.json());
    const unreadCount = body.action === "mark-read" ? 0 : 1;

    await Promise.all(
      body.conversationIds.map((conversationId) => setStoredConversationUnreadCount(conversationId, unreadCount)),
    );

    return NextResponse.json({ ok: true, unreadCount });
  } catch (error) {
    logger.error("falha ao atualizar conversas em lote", error, { userId: user.id });
    return NextResponse.json({ error: "Nao foi possivel atualizar as conversas." }, { status: 500 });
  }
}
