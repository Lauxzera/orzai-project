const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function getValue(name) {
  return (process.env[name] || "").trim();
}

function isPublicHttpsUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return !["localhost", "127.0.0.1", "0.0.0.0"].includes(host);
  } catch {
    return false;
  }
}

function buildReportLine(label, ready, detail) {
  const marker = ready ? "[ok]" : "[pendente]";
  return `${marker} ${label}${detail ? ` -> ${detail}` : ""}`;
}

const appUrl = getValue("APP_URL") || getValue("NEXT_PUBLIC_APP_URL");
const webhookUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/api/webhooks/meta` : "";
const callbackUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/api/messages/embedded-signup/callback` : "";

const checks = [
  {
    label: "APP_URL publica com HTTPS",
    ready: isPublicHttpsUrl(appUrl),
    detail: appUrl || "Defina APP_URL com a URL publica do CRM.",
  },
  {
    label: "WHATSAPP_PROVIDER=meta",
    ready: getValue("WHATSAPP_PROVIDER").toLowerCase() === "meta",
    detail: getValue("WHATSAPP_PROVIDER") || "Defina WHATSAPP_PROVIDER=meta.",
  },
  {
    label: "Credenciais base da Cloud API",
    ready: ["META_PHONE_NUMBER_ID", "META_ACCESS_TOKEN", "META_WEBHOOK_VERIFY_TOKEN", "META_APP_SECRET"].every(
      (key) => Boolean(getValue(key)),
    ),
    detail: "META_PHONE_NUMBER_ID, META_ACCESS_TOKEN, META_WEBHOOK_VERIFY_TOKEN e META_APP_SECRET",
  },
  {
    label: "Flags de coexistencia",
    ready:
      getValue("META_EMBEDDED_SIGNUP_ENABLED").toLowerCase() === "true" &&
      getValue("META_COEXISTENCE_ENABLED").toLowerCase() === "true",
    detail: "META_EMBEDDED_SIGNUP_ENABLED=true e META_COEXISTENCE_ENABLED=true",
  },
  {
    label: "App ID e Config ID do Embedded Signup",
    ready: Boolean(getValue("META_EMBEDDED_SIGNUP_APP_ID") && getValue("META_EMBEDDED_SIGNUP_CONFIG_ID")),
    detail: "META_EMBEDDED_SIGNUP_APP_ID e META_EMBEDDED_SIGNUP_CONFIG_ID",
  },
  {
    label: "Redirect URI/callback",
    ready: Boolean(getValue("META_EMBEDDED_SIGNUP_REDIRECT_URI") || callbackUrl),
    detail: getValue("META_EMBEDDED_SIGNUP_REDIRECT_URI") || callbackUrl || "Sem callback resolvido.",
  },
  {
    label: "OpenRouter configurado",
    ready: Boolean(getValue("OPENROUTER_API_KEY")),
    detail: "OPENROUTER_API_KEY",
  },
  {
    label: "Banco principal configurado",
    ready: Boolean(getValue("DATABASE_URL") && getValue("DIRECT_URL")),
    detail: "DATABASE_URL e DIRECT_URL",
  },
];

const ready = checks.every((item) => item.ready);

console.log("=== Prontidao para teste de WhatsApp Coexistence ===");
console.log(`APP_URL: ${appUrl || "(nao definida)"}`);
console.log(`Webhook esperado: ${webhookUrl || "(indisponivel)"}`);
console.log(`Callback esperado: ${callbackUrl || "(indisponivel)"}`);
console.log("");

for (const check of checks) {
  console.log(buildReportLine(check.label, check.ready, check.detail));
}

console.log("");
console.log("Passos do primeiro teste real:");
console.log("1. Publicar o CRM em uma URL HTTPS.");
console.log("2. Rodar este checklist ate todos os itens ficarem ok.");
console.log("3. Abrir /api/messages/embedded-signup/readiness no ambiente publicado.");
console.log("4. Aplicar o webhook da Meta pelo CRM.");
console.log("5. Iniciar o Embedded Signup.");
console.log("6. Concluir o callback e conferir code, WABA ID e Phone Number ID.");
console.log("7. Se necessario, usar 'Concluir troca do code'.");
console.log("8. Validar envio e recebimento reais.");

process.exitCode = ready ? 0 : 1;
