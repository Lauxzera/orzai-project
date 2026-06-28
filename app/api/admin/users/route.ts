import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/auth";
import { adminCreateUser, deleteUserByAdmin, listAdminAudit, listUsers, updateUserByAdmin } from "@/lib/server/crm-repository";
import { userRoles } from "@/lib/crm";

const createSchema = z.object({
  name: z.string().min(2).max(100),
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  role: z.enum(userRoles),
  active: z.boolean().optional(),
  isAgent: z.boolean().optional(),
});

const updateSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(2).max(100).optional(),
  username: z.string().min(3).max(50).optional(),
  password: z.string().min(6).max(100).optional(),
  role: z.enum(userRoles).optional(),
  active: z.boolean().optional(),
  isAgent: z.boolean().optional(),
});

const deleteSchema = z.object({
  userId: z.string().min(1),
});

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  if (user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Apenas administradores podem gerenciar usuários." }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const users = await listUsers();
  const audit = await listAdminAudit(20);
  return NextResponse.json({ users, audit });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const payload = createSchema.parse(await request.json());
    const user = await adminCreateUser(payload, auth.user);
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ?error.message : "Não foi possível criar o usuário." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const payload = updateSchema.parse(await request.json());
    const user = await updateUserByAdmin(payload.userId, payload, auth.user);
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ?error.message : "Não foi possível atualizar o usuário." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const payload = deleteSchema.parse(await request.json());
    await deleteUserByAdmin(payload.userId, auth.user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ?error.message : "Não foi possível excluir o usuário." },
      { status: 400 }
    );
  }
}
