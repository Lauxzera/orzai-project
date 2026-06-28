import { randomUUID } from "node:crypto";

export async function POST(request: Request) {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    // ignore parse errors
  }
  console.log("[meta/data-deletion] payload recebido:", JSON.stringify(payload));

  const confirmationCode = randomUUID();
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://crm-institutobelart.vercel.app")
    .trim()
    .replace(/\/$/, "");

  // TODO: iniciar exclusão real dos dados vinculados

  return Response.json({
    url: `${base}/auth/meta/data-deletion/status/${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}
