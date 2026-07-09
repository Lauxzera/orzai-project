# Ideias — Funcionalidades para a aba Demonstrações

Este arquivo guarda ideias de funcionalidades discutidas mas ainda não implementadas.
Objetivo: quando surgir tempo/prioridade, voltar aqui em vez de reconstruir o raciocínio do zero.

Contexto: todas as ideias abaixo são evoluções do próprio Base CRM (não produtos novos e
separados) — a estratégia é terminar recursos que já têm código pela metade no repositório
antes de inventar algo do zero, porque isso é mais rápido e já prova a tese de vendas
("Orzai automatiza o que dá trabalho manual").

---

## 1. Atendimento multicanal (WhatsApp + Instagram + Messenger)

**Por quê**: a maioria dos concorrentes só faz WhatsApp. Atender os três num inbox só é
um diferencial real pro público que também vende por Instagram.

**O que já existe no código**:
- `lib/server/channel-adapters/meta-webhook-adapter.ts` — parser de payload do Graph API
  da Meta que já normaliza mensagens de Instagram/Messenger pro formato genérico do CRM.
- `ChannelIntegration` no `prisma/schema.prisma` — tabela pra guardar credenciais de cada
  canal por departamento (já migrada em produção).

**O que falta**:
- Rota de webhook real recebendo eventos do Instagram/Messenger e chamando o adapter.
- Persistir essas mensagens em `MessageConversation`/`MessageRecord` (hoje só WhatsApp grava).
- Fluxo de conexão de conta (Instagram Business / Página do Facebook) na tela de Setores
  (`features/settings/components/department-settings-view.tsx` já tem os cards visuais,
  mas os botões "Conectar Instagram/Messenger" não fazem nada ainda).

---

## 2. Reengajamento automático de lead frio

**Por quê**: gancho de venda forte — "a IA recupera lead que você já tinha perdido",
resolve uma dor concreta (equipe esquece de retomar contato).

**O que já existe no código**:
- `lib/server/reengagement.ts` — `scheduleFollowUp`, `cancelPendingFollowUps` e variações
  por telefone já implementadas.
- Modelo `ScheduledFollowUp` e enum `FollowUpStatus` já estão no `schema.prisma`.

**O que falta**:
- **Migration real no banco** — `ScheduledFollowUp` existe no schema mas não tem tabela
  criada em produção (nenhum script `apply-*-schema.js` foi feito pra essa tabela ainda).
- Nenhuma rota/cron chama essas funções hoje — é código morto, sem trigger.
- Precisa de um job periódico (parecido com `/api/jobs/check-sla`) que rode reengajamento
  e realmente dispare mensagem via WhatsApp quando o follow-up vence.
- Decidir a régua: quantas tentativas, qual intervalo, qual mensagem padrão.

---

## 3. Agendamento inteligente via WhatsApp

**Por quê**: muito relevante pra clínicas/cursos com agenda (estética, harmonização,
massoterapia — os próprios cursos de exemplo do seed já sugerem esse público).
Lead marca horário direto na conversa, sem sair pro Calendly/Cal.com.

**O que já existe no código**:
- `lib/server/ai/tools/calendar.ts` — ferramentas de IA `checkAvailabilityTool` e
  `bookAppointmentTool` no formato de function-calling, com mocks de disponibilidade.
- Modelo `Appointment` + enum `AppointmentStatus` no `schema.prisma`, com migration já
  escrita em `prisma/migrations/20260703000000_phase2_appointments/`.
- Comentário no código já resolve a parte sensível: anamnese/motivo da consulta nunca
  deve ir pro provedor de agenda externo (LGPD/dado de saúde).

**O que falta**:
- Tudo hoje é mock — não conecta em nenhuma agenda real (Cal.com, Google Calendar).
- As funções `executeCheckAvailability`/`executeBookAppointment` não persistem nada no
  banco (o `prisma.appointment.create` está comentado no código).
- Ligar essas tools ao assistente de IA real (`lib/ai.ts`) pra virar uma ação de verdade.

---

## 4. Emissor de proposta/orçamento em PDF automático

**Por quê**: reduz trabalho manual de montar orçamento, e já dá pra usar o design/marca
do cliente — bom argumento visual de demonstração.

**O que já existe no código**:
- `jspdf` e `jspdf-autotable` já são dependências do projeto (`package.json`), mas hoje
  não achei nenhum uso ativo deles no código — parecem ter sido adicionados pra uma
  feature que não foi concluída ou foi removida.

**O que falta**:
- Tudo: template de proposta, endpoint que gera o PDF a partir dos dados do lead
  (curso de interesse, valor, condição comercial), botão na ficha do lead pra gerar/baixar.

---

## 5. BI simplificado "modo dono"

**Por quê**: dono de negócio pequeno não quer abrir o CRM inteiro, só quer ver
"quanto entrou, quanto fechou" — uma versão enxuta do Analytics, pensada pro celular.

**O que já existe no código**:
- Toda a lógica de métricas já existe em `features/analytics/lib/analytics-metrics.ts`
  e no Dashboard (`components/crm/dashboard.tsx`) — é reaproveitamento de dados, não
  cálculo novo.

**O que falta**:
- Uma tela nova, mobile-first, com só os números essenciais (sem funil detalhado,
  sem filtros avançados).
- Decidir se é uma view dentro do CRM (atrás de login) ou algo separado tipo relatório
  por e-mail/WhatsApp semanal.

---

## Como usar este arquivo

- Ao decidir tocar uma dessas ideias, criar uma seção de tarefas separada (TaskCreate)
  e ir riscando os itens de "o que falta" à medida que forem implementados.
- Ao terminar uma ideia por completo (código + demo na landing page), mover a seção
  daqui pro `STATUS-PROJETO.md` como funcionalidade ativa, e apagar daqui.
- Não deixar esse arquivo virar diário de decisões — só o essencial pra retomar o
  raciocínio depois.
