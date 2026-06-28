# WhatsApp Meta Embedded Signup — Setup Guide

## URLs a cadastrar no Meta Developers

| Campo                        | URL                                                                                    |
|-----------------------------|----------------------------------------------------------------------------------------|
| OAuth Redirect URI          | `https://crm-institutobelart.vercel.app/auth/meta/callback`                            |
| Deauthorize Callback URL    | `https://crm-institutobelart.vercel.app/auth/meta/deauthorize`                         |
| Data Deletion Request URL   | `https://crm-institutobelart.vercel.app/auth/meta/data-deletion`                       |
| Webhook (WhatsApp)          | `https://crm-institutobelart.vercel.app/api/webhooks/whatsapp`                         |
| Domínio SDK JS              | `crm-institutobelart.vercel.app`                                                        |

> **Nota sobre Coexistence:** O parâmetro `featureType: 'whatsapp_business_app_onboarding'` é o que ativa o fluxo de Coexistência (Embedded Signup com número já usado em outro BSP). Sem esse parâmetro o fluxo seria de migração completa.

> **Diretriz obrigatória do projeto:** a API WhatsApp da Belart opera em **modo coexistencial**. Não devemos implementar, configurar ou orientar nenhum fluxo que migre o número para outro formato, remova a coexistência, desconecte o app WhatsApp Business do celular, derrube o WhatsApp Web da equipe ou substitua o modelo atual da API sem aprovação explícita.

---

## Variáveis de ambiente necessárias

```env
# App público (frontend)
NEXT_PUBLIC_META_APP_ID=          # App ID do seu app no Meta Developers
NEXT_PUBLIC_META_CONFIG_ID=2041214766787970  # Configuration ID do Embedded Signup

# Backend (servidor)
META_APP_SECRET=                  # App Secret do Meta Developers
META_GRAPH_API_VERSION=v23.0      # Versão da Graph API
WHATSAPP_VERIFY_TOKEN=            # Token livre que você define para verificar o webhook
ENCRYPTION_SECRET=                # String secreta ≥32 chars para criptografar access tokens no banco

# Já existentes (manter)
META_PHONE_NUMBER_ID=
META_WABA_ID=
META_ACCESS_TOKEN=
META_WEBHOOK_VERIFY_TOKEN=
META_APP_SECRET=
META_EMBEDDED_SIGNUP_ENABLED=true
META_COEXISTENCE_ENABLED=true
META_EMBEDDED_SIGNUP_APP_ID=      # mesmo valor de NEXT_PUBLIC_META_APP_ID
META_EMBEDDED_SIGNUP_CONFIG_ID=2041214766787970
APP_URL=https://crm-institutobelart.vercel.app
```

---

## Como obter WABA ID e token sem quebrar a coexistência

### Caminho recomendado: Embedded Signup coexistencial

1. Mantenha `META_EMBEDDED_SIGNUP_ENABLED=true` e `META_COEXISTENCE_ENABLED=true`.
2. Inicie a conexão pelo CRM em **Mensagens / Configuração de Canal**.
3. No popup da Meta, use o fluxo de coexistência, não migração completa.
4. Ao concluir, a Meta retorna `waba_id`, `phone_number_id` e `code`.
5. O CRM troca o `code` por token no backend e salva as informações de canal.
6. Use o `waba_id` retornado para configurar `META_WABA_ID` na Vercel quando precisarmos listar templates da Meta.

### Caminho manual pelo Meta Business Manager

1. Acesse **Meta Business Suite / Business Manager**.
2. Entre na conta empresarial correta.
3. Abra **WhatsApp Accounts** e selecione a conta WhatsApp Business usada pela Belart.
4. Copie o ID da conta WhatsApp Business. Esse é o valor de `META_WABA_ID`.
5. Para token permanente, use um **System User** com permissões compatíveis com WhatsApp Business Platform e gere um token com acesso ao WABA correto.

### Permissões esperadas

- `whatsapp_business_messaging` para envio/recebimento de mensagens.
- `whatsapp_business_management` para operações de gestão, como listar templates.

### O que não fazer

- Não iniciar fluxo de migração completa do número.
- Não remover a configuração de coexistência.
- Não trocar o provedor/forma de API sem plano de reversão.
- Não revogar tokens ativos antes de confirmar que o CRM recebeu e validou o novo token.
- Não alterar configurações que façam a equipe perder acesso ao WhatsApp Business no celular ou WhatsApp Web.

---

## Passo a passo de teste

### 1. Configurar o app no Meta Developers

1. Acesse [developers.facebook.com](https://developers.facebook.com) → seu app.
2. Em **WhatsApp > Configuração**, adicione a **OAuth Redirect URI** acima.
3. Em **Configurações do App > Avançado**, cadastre as URLs de Deauthorize e Data Deletion.
4. Em **WhatsApp > Configuração de webhook**, adicione a URL do webhook e o `WHATSAPP_VERIFY_TOKEN`.
5. Em **Configurações do App > Básico > Domínios SDK do JavaScript**, adicione `crm-institutobelart.vercel.app`.

### 2. Configurar variáveis no Vercel

1. No painel Vercel do projeto, em **Settings > Environment Variables**, adicione todas as variáveis listadas acima.
2. Redeploy o projeto para aplicar.

### 3. Testar o Embedded Signup

1. Acesse o CRM logado como ADMIN ou MANAGER.
2. Vá para a tela de Mensagens / Configuração de Canal.
3. Clique em **Conectar WhatsApp** — o popup do Facebook abrirá.
4. Siga o fluxo de Coexistência no popup.
5. Ao concluir, o CRM chamará `POST /api/whatsapp/install` automaticamente com o `code`, `waba_id` e `phone_number_id`.
6. O status na tela deve mudar para **vinculado**.

### 4. Verificar o webhook

```bash
# Confirmar que o endpoint responde à verificação
curl "https://crm-institutobelart.vercel.app/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=teste123"
# Deve retornar: teste123
```

### 5. Testar envio de mensagem

Após a vinculação, envie uma mensagem pelo CRM para um número cadastrado no WABA para confirmar que o `META_PHONE_NUMBER_ID` e o token foram aplicados corretamente.

---

## Arquivos relevantes

| Arquivo | Função |
|---------|--------|
| `app/auth/meta/callback/route.ts` | OAuth Redirect URI — recebe code e troca por token |
| `app/auth/meta/deauthorize/route.ts` | Deauthorize callback da Meta |
| `app/auth/meta/data-deletion/route.ts` | Data deletion callback da Meta |
| `app/auth/meta/data-deletion/status/[confirmation_code]/route.ts` | Status de solicitação de exclusão |
| `app/api/whatsapp/install/route.ts` | Instalação via SDK (troca code, salva config) |
| `app/api/webhooks/whatsapp/route.ts` | Recebe eventos do WhatsApp (mensagens, status) |
| `lib/server/encryption.ts` | Criptografia AES-256-GCM de access tokens |
| `lib/server/messages-client.ts` | Cliente Meta Cloud API + utilitários Embedded Signup |
| `features/messages/components/connection-status-card.tsx` | UI com botão "Conectar WhatsApp" e FB SDK |
