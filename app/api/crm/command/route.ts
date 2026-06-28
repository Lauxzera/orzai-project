import { NextResponse } from "next/server";
import { z } from "zod";
import { enrollmentStatuses, funnelStatuses, leadListColors } from "@/lib/crm";
import { getSessionUser } from "@/lib/server/auth";
import { applyCrmCommand, type CrmCommand } from "@/lib/server/crm-repository";

const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("restoreDemoData"),
    confirmationPhrase: z.literal("RESTAURAR"),
  }),
  z.object({
    type: z.literal("toggleTask"),
    taskId: z.string().min(1),
  }),
  z.object({
    type: z.literal("changeLeadStatus"),
    leadId: z.string().min(1),
    status: z.enum(funnelStatuses),
  }),
  z.object({
    type: z.literal("addHistory"),
    leadId: z.string().min(1),
    note: z.string().max(2000),
  }),
  z.object({
    type: z.literal("addTask"),
    leadId: z.string().min(1),
    title: z.string().min(1).max(200),
    owner: z.string().min(1),
    dueDate: z.string().min(1),
  }),
  z.object({
    type: z.literal("upsertLead"),
    leadId: z.string().nullable().optional(),
    source: z.enum(["manual", "automatic_whatsapp_inbox", "import"]).optional(),
    lead: z.object({
      nome: z.string().min(1, "Nome é obrigatório"),
      telefone: z.string().min(1, "Telefone é obrigatório"),
      whatsapp: z.string(),
      email: z.string(),
      curso_de_interesse: z.string(),
      origem: z.string(),
      origem_detalhe: z.string(),
      captado_via: z.string(),
      utm_source: z.string(),
      utm_medium: z.string(),
      utm_campaign: z.string(),
      utm_term: z.string(),
      utm_content: z.string(),
      tracking_referrer: z.string(),
      tracking_landing_page: z.string(),
      tracking_id: z.string(),
      status_funil: z.enum(funnelStatuses),
      status_matricula: z.enum(enrollmentStatuses),
      responsavel: z.string(),
      data_entrada: z.string(),
      proximo_contato: z.string(),
      objecao_principal: z.string(),
      observacoes: z.string(),
      ja_foi_aluno: z.enum(["Sim", "Não"]),
      cidade: z.string(),
      profissao: z.string(),
    }),
  }),
  z.object({
    type: z.literal("deleteLead"),
    leadId: z.string().min(1),
  }),
  z.object({
    type: z.literal("createLeadList"),
    name: z.string().min(1).max(120),
    description: z.string().max(400),
    color: z.enum(leadListColors),
    leadIds: z.array(z.string()).max(500),
  }),
  z.object({
    type: z.literal("updateLeadList"),
    listId: z.string().min(1),
    name: z.string().min(1).max(120),
    description: z.string().max(400),
    color: z.enum(leadListColors),
    leadIds: z.array(z.string()).max(500),
  }),
  z.object({
    type: z.literal("deleteLeadList"),
    listId: z.string().min(1),
  }),
]);

type UserRole = "ADMIN" | "MANAGER" | "SALES" | "VIEWER";

function checkAuthorization(commandType: string, role: UserRole): string | null {
  if (role === "VIEWER") {
    return "Você não tem permissão para realizar alterações.";
  }
  if (commandType === "restoreDemoData" && role !== "ADMIN") {
    return "Apenas administradores podem restaurar os dados de demonstração.";
  }
  return null;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const command = commandSchema.parse(await request.json()) as CrmCommand;

    const authError = checkAuthorization(command.type, user.role as UserRole);
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 403 });
    }

    const state = await applyCrmCommand(command, user);
    return NextResponse.json({ state });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível aplicar a operação." },
      { status: 400 },
    );
  }
}
