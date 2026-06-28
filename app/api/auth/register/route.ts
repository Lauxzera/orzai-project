import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/server/auth";
import { createUser } from "@/lib/server/crm-repository";

const requestSchema = z.object({
  name: z.string().min(1, "Nome completo é obrigatório"),
  username: z.string().min(1, "Usuário é obrigatório"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    
    // Na versão portátil/local, permitimos o registro público de novos usuários
    const user = await createUser({
      name: body.name,
      username: body.username,
      password: body.password,
    });

    await createSession(user);
    return NextResponse.json({ user });
  } catch (error: any) {
    if (error?.message?.includes("já está em uso")) {
      return NextResponse.json({ error: "Este nome de usuário já está em uso." }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível concluir o registro." }, { status: 400 });
  }
}
