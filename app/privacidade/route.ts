export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Política de Privacidade — Base CRM</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #1f2937; line-height: 1.7; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    h2 { font-size: 20px; margin-top: 32px; margin-bottom: 8px; }
    p, ul { margin-bottom: 16px; }
    .updated { color: #6b7280; font-size: 14px; margin-bottom: 32px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Política de Privacidade</h1>
  <p class="updated">Última atualização: junho de 2026</p>

  <p>O Base CRM opera o Base CRM, uma plataforma de gestão de relacionamento com clientes. Esta política descreve como coletamos, usamos e protegemos suas informações.</p>

  <h2>1. Informações que coletamos</h2>
  <p>Coletamos informações fornecidas diretamente por você, como nome, telefone, e-mail e dados de contato, para fins de gestão comercial e atendimento ao cliente.</p>

  <h2>2. Uso das informações</h2>
  <p>As informações coletadas são utilizadas exclusivamente para:</p>
  <ul>
    <li>Gestão de leads e oportunidades comerciais</li>
    <li>Comunicação via WhatsApp e outros canais autorizados</li>
    <li>Melhoria dos nossos serviços educacionais</li>
  </ul>

  <h2>3. Integração com WhatsApp</h2>
  <p>Utilizamos a WhatsApp Business Platform (Meta) para comunicação com clientes. As mensagens são armazenadas de forma segura e utilizadas apenas para atendimento. Tokens de integração são criptografados e nunca expostos publicamente.</p>

  <h2>4. Compartilhamento de dados</h2>
  <p>Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros, exceto quando necessário para prestação dos nossos serviços ou quando exigido por lei.</p>

  <h2>5. Segurança</h2>
  <p>Adotamos medidas técnicas para proteger suas informações, incluindo criptografia AES-256 para dados sensíveis e acesso restrito por usuários autorizados.</p>

  <h2>6. Seus direitos (LGPD)</h2>
  <p>Nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a acessar, corrigir ou solicitar a exclusão dos seus dados pessoais.</p>

  <h2>7. Exclusão de dados</h2>
  <p>Para solicitar a exclusão dos seus dados acesse:
    <a href="https://crm-institutobelart.vercel.app/auth/meta/data-deletion">
      crm-institutobelart.vercel.app/auth/meta/data-deletion
    </a>
  </p>

  <h2>8. Contato</h2>
  <p>Base CRM — Porto Alegre, RS, Brasil<br />
  Site: <a href="https://belart.com.br">belart.com.br</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
