import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/server/auth";
import { authenticateUser } from "@/lib/server/crm-repository";

const requestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const user = await authenticateUser(body.username, body.password);

    if (!user) {
      return NextResponse.json({ error: "Usuario ou senha invalidos." }, { status: 401 });
    }

    await createSession(user);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Nao foi possivel concluir o login." }, { status: 400 });
  }
}
