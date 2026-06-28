import {
  extractCallbackParamsFromUrl,
  handleMetaOAuthCallback,
} from "@/lib/server/whatsapp-callback-handler";

export async function GET(request: Request) {
  const params = extractCallbackParamsFromUrl(new URL(request.url));
  return handleMetaOAuthCallback(params);
}
