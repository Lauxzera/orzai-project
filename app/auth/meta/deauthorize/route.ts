export async function POST(request: Request) {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    // ignore parse errors
  }
  console.log("[meta/deauthorize] payload recebido:", JSON.stringify(payload));
  // TODO: marcar integração como desconectada no banco
  return Response.json({ success: true, message: "Meta deauthorize callback recebido." });
}
