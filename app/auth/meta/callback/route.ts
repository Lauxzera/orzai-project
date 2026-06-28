/**
 * OAuth Redirect URI registrada no Meta Developers.
 * URL: https://crm-institutobelart.vercel.app/auth/meta/callback
 *
 * No fluxo via JavaScript SDK (popup), o authorization code vem do
 * callback do FB.login() — não desta rota. Esta rota é usada quando
 * o fluxo redireciona o browser diretamente (ex: Iniciar via backend).
 *
 * O access token é sempre criptografado antes de ser salvo no banco.
 */

import {
  extractCallbackParamsFromRequest,
  extractCallbackParamsFromUrl,
  handleMetaOAuthCallback,
} from "@/lib/server/whatsapp-callback-handler";

export async function GET(request: Request) {
  const params = extractCallbackParamsFromUrl(new URL(request.url));
  return handleMetaOAuthCallback(params);
}

export async function POST(request: Request) {
  const params = await extractCallbackParamsFromRequest(request);
  return handleMetaOAuthCallback(params);
}
