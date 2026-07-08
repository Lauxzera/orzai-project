import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";
import { createLogger } from "@/lib/server/logger";

const logger = createLogger("crm/handoff");

const requestSchema = z.object({
  leadId: z.string().min(1),
  targetDepartmentId: z.string().min(1).nullable(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body = requestSchema.parse(await request.json());
    const prisma = getPrismaClient();

    const lead = await prisma.lead.findUnique({ where: { id: body.leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
    }

    // Também precisamos atualizar o departmentId da Conversation para que o histórico de mensagens seja visto pelo novo setor
    const phone = lead.whatsapp || lead.telefone;
    if (phone) {
      const normalized = phone.replace(/\D/g, "");
      if (normalized) {
        const conversation = await prisma.messageConversation.findFirst({
          where: {
            OR: [{ contactPhone: normalized }, { contactPhone: { endsWith: normalized } }],
          },
        });
        if (conversation) {
          await prisma.messageConversation.update({
            where: { id: conversation.id },
            data: { departmentId: body.targetDepartmentId },
          });
        }
      }
    }

    let targetName = body.targetDepartmentId;
    if (body.targetDepartmentId) {
      const dep = await prisma.department.findUnique({ where: { id: body.targetDepartmentId } });
      if (dep) targetName = dep.name;
    }

    await prisma.leadHistory.create({
      data: {
        leadId: lead.id,
        action: "Transferência de Setor",
        note: body.targetDepartmentId
          ? `Lead transferido para o setor ${targetName}.`
          : "Lead removido do setor específico (Atendimento Geral).",
        userId: user.id,
      },
    });

    logger.info("handoff realizado com sucesso", { leadId: lead.id, targetDepartmentId: body.targetDepartmentId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("erro na rota de handoff", error);
    return NextResponse.json({ error: "Erro interno no handoff." }, { status: 500 });
  }
}
