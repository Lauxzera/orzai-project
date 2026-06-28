import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeCrmCustomizations } from "@/lib/crm";
import { getSessionUser } from "@/lib/server/auth";
import { getCrmCustomizations, listAssignableOwners, updateCrmCustomizations } from "@/lib/server/crm-repository";

const payloadSchema = z.object({
  courses: z.array(z.string().trim().min(1).max(120)).optional(),
  courseSegments: z
    .object({
      formacao: z.array(z.string().trim().min(1).max(120)),
      especializacao: z.array(z.string().trim().min(1).max(120)),
    })
    .optional(),
  origins: z.array(z.string().trim().min(1).max(120)).min(1),
  leadCaptureMethods: z.array(z.string().trim().min(1).max(120)).min(1),
  owners: z.array(z.string().trim().min(1).max(120)).min(1),
}).superRefine((value, ctx) => {
  const totalCourses =
    value.courseSegments
      ? value.courseSegments.formacao.length + value.courseSegments.especializacao.length
      : value.courses?.length ?? 0;

  if (totalCourses < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cadastre pelo menos um curso entre Formação ou Especialização.",
      path: ["courseSegments"],
    });
  }
});

function canManageCustomizations(role: string) {
  return role === "ADMIN" || role === "MANAGER";
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const [customizations, assignableOwners] = await Promise.all([
    getCrmCustomizations(),
    listAssignableOwners(),
  ]);
  return NextResponse.json({ customizations, assignableOwners });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!canManageCustomizations(user.role)) {
    return NextResponse.json({ error: "Você não tem permissão para alterar essas configurações." }, { status: 403 });
  }

  try {
    const payload = payloadSchema.parse(await request.json());
    const customizations = await updateCrmCustomizations(normalizeCrmCustomizations(payload), user);
    const assignableOwners = await listAssignableOwners();
    return NextResponse.json({ customizations, assignableOwners });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível salvar as configurações dos leads." },
      { status: 400 },
    );
  }
}
