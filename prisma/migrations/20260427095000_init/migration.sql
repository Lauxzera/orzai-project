-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'SALES', 'VIEWER');

-- CreateEnum
CREATE TYPE "FunnelStatus" AS ENUM ('NOVO_LEAD', 'PRIMEIRO_CONTATO_FEITO', 'INTERESSADO_NO_CURSO', 'INFORMACOES_ENVIADAS', 'AGUARDANDO_RETORNO', 'NEGOCIACAO_MATRICULA', 'AGUARDANDO_PAGAMENTO', 'MATRICULADO', 'PERDIDO', 'REATIVAR_FUTURAMENTE');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('NAO_INICIADO', 'INTERESSADO', 'AGUARDANDO_PAGAMENTO', 'PAGAMENTO_CONFIRMADO', 'MATRICULADO', 'CANCELADO', 'REMANEJADO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SALES',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT,
    "cursoDeInteresse" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "statusFunil" "FunnelStatus" NOT NULL DEFAULT 'NOVO_LEAD',
    "statusMatricula" "EnrollmentStatus" NOT NULL DEFAULT 'NAO_INICIADO',
    "responsavelId" TEXT,
    "responsavelNome" TEXT NOT NULL,
    "dataEntrada" TIMESTAMP(3) NOT NULL,
    "proximoContato" TIMESTAMP(3),
    "objecaoPrincipal" TEXT,
    "observacoes" TEXT,
    "jaFoiAluno" BOOLEAN NOT NULL DEFAULT false,
    "cidade" TEXT,
    "profissao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Lead_statusFunil_idx" ON "Lead"("statusFunil");

-- CreateIndex
CREATE INDEX "Lead_statusMatricula_idx" ON "Lead"("statusMatricula");

-- CreateIndex
CREATE INDEX "Lead_origem_idx" ON "Lead"("origem");

-- CreateIndex
CREATE INDEX "Lead_cursoDeInteresse_idx" ON "Lead"("cursoDeInteresse");

-- CreateIndex
CREATE INDEX "Lead_responsavelNome_idx" ON "Lead"("responsavelNome");

-- CreateIndex
CREATE INDEX "Lead_proximoContato_idx" ON "Lead"("proximoContato");

-- CreateIndex
CREATE INDEX "Task_owner_idx" ON "Task"("owner");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_done_idx" ON "Task"("done");

-- CreateIndex
CREATE INDEX "LeadHistory_leadId_idx" ON "LeadHistory"("leadId");

-- CreateIndex
CREATE INDEX "LeadHistory_userId_idx" ON "LeadHistory"("userId");

-- CreateIndex
CREATE INDEX "LeadHistory_createdAt_idx" ON "LeadHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadHistory" ADD CONSTRAINT "LeadHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadHistory" ADD CONSTRAINT "LeadHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
