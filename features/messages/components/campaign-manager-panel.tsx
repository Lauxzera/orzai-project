"use client";

import * as React from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  FileText,
  ListFilter,
  LoaderCircle,
  MessageSquareText,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  TimerReset,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SmoothInput as Input } from "@/components/ui/smooth-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { funnelStatuses, type Lead, type LeadList } from "@/lib/crm";
import {
  MESSAGE_CAMPAIGN_TEMPLATE_VARIABLES,
  type MessageCampaign,
  type MessageCampaignDispatchMode,
  type MessageCampaignTemplateSettings,
  type MessageCampaignTemplateVariableKey,
} from "@/lib/messages";

type Props = {
  leads: Lead[];
  leadLists: LeadList[];
  campaigns: MessageCampaign[];
  templateSettings: MessageCampaignTemplateSettings | null;
  canEdit: boolean;
  loading: boolean;
  courseOptions: readonly string[];
  onRefresh: () => void;
  onCreateCampaign: (payload: {
    title: string;
    messageTemplate: string;
    delaySeconds: number;
    leadIds: string[];
    confirmLargeCampaign: boolean;
    dispatchMode: MessageCampaignDispatchMode;
    metaTemplateName?: string;
    metaTemplateLanguage?: string;
    templateVariableKeys?: MessageCampaignTemplateVariableKey[];
  }) => Promise<void>;
  onChangeCampaignStatus: (campaignId: string, status: MessageCampaign["status"]) => Promise<void>;
};

const DISPATCH_MODE_OPTIONS = [
  {
    value: "hybrid" as const,
    title: "Híbrido",
    description: "Texto quando possível, template fora da janela",
    icon: ShieldCheck,
    recommended: true,
  },
  {
    value: "meta_template" as const,
    title: "Somente template",
    description: "Sempre usa o modelo aprovado na Meta",
    icon: FileText,
    recommended: false,
  },
  {
    value: "free_text" as const,
    title: "Somente texto",
    description: "Só alcança quem está na janela de 24h",
    icon: MessageSquareText,
    recommended: false,
  },
];

const CAMPAIGN_STATUS_META: Record<
  MessageCampaign["status"],
  { label: string; className: string; dotClassName: string }
> = {
  draft: {
    label: "Rascunho",
    className: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    dotClassName: "bg-slate-500",
  },
  running: {
    label: "Em execução",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dotClassName: "bg-emerald-500",
  },
  paused: {
    label: "Pausado",
    className: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dotClassName: "bg-amber-500",
  },
  completed: {
    label: "Concluído",
    className: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    dotClassName: "bg-sky-500",
  },
  cancelled: {
    label: "Cancelado",
    className: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    dotClassName: "bg-rose-500",
  },
};

export function CampaignManagerPanel({
  leads,
  leadLists,
  campaigns,
  templateSettings,
  canEdit,
  loading,
  courseOptions,
  onRefresh,
  onCreateCampaign,
  onChangeCampaignStatus,
}: Props) {
  const [search, setSearch] = React.useState("");
  const [funnelFilter, setFunnelFilter] = React.useState("all");
  const [courseFilter, setCourseFilter] = React.useState("all");
  const [studentFilter, setStudentFilter] = React.useState("all");
  const [leadListFilter, setLeadListFilter] = React.useState("all");
  const [selectedLeadIds, setSelectedLeadIds] = React.useState<string[]>([]);
  const [title, setTitle] = React.useState("");
  const [messageTemplate, setMessageTemplate] = React.useState(
    "Olá, {nome}! Aqui é do Base CRM sobre o curso {curso}. Posso te ajudar a avançar?",
  );
  const [dispatchMode, setDispatchMode] = React.useState<MessageCampaignDispatchMode>("hybrid");
  const [metaTemplateName, setMetaTemplateName] = React.useState("");
  const [metaTemplateLanguage, setMetaTemplateLanguage] = React.useState("pt_BR");
  const [manualTemplateEntry, setManualTemplateEntry] = React.useState(false);
  const [templateVariableKeys, setTemplateVariableKeys] = React.useState<MessageCampaignTemplateVariableKey[]>([]);
  const [templateDialogOpen, setTemplateDialogOpen] = React.useState(false);
  const [delaySeconds, setDelaySeconds] = React.useState("45");
  const [confirmLargeCampaign, setConfirmLargeCampaign] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const largeCampaign = selectedLeadIds.length > 20;
  const explicitTemplateName = metaTemplateName.trim();
  const fallbackTemplateName = templateSettings?.fallbackTemplateName || "";
  const fallbackTemplateLanguage = templateSettings?.fallbackTemplateLanguage || "pt_BR";
  const effectiveTemplateName = metaTemplateName.trim() || templateSettings?.fallbackTemplateName || "";
  const effectiveTemplateLanguage = metaTemplateLanguage.trim() || fallbackTemplateLanguage;
  const templateRequired = dispatchMode === "meta_template" || dispatchMode === "hybrid";
  const templateVariables = templateSettings?.supportedVariables?.length
    ? templateSettings.supportedVariables
    : MESSAGE_CAMPAIGN_TEMPLATE_VARIABLES;
  const availableMetaTemplates = React.useMemo(
    () => (templateSettings?.availableTemplates ?? []).filter((template) => template.status === "APPROVED"),
    [templateSettings?.availableTemplates],
  );
  const allSyncedMetaTemplates = templateSettings?.availableTemplates ?? [];
  const selectedMetaTemplate = availableMetaTemplates.find(
    (template) => template.name === explicitTemplateName && template.language === effectiveTemplateLanguage,
  );
  const templateParameterMismatch =
    templateRequired && selectedMetaTemplate ? selectedMetaTemplate.parameterCount !== templateVariableKeys.length : false;
  const selectedTemplateKey = selectedMetaTemplate
    ? `${selectedMetaTemplate.name}::${selectedMetaTemplate.language}`
    : explicitTemplateName
      ? "__manual__"
      : fallbackTemplateName
        ? "__fallback__"
        : "__none__";
  const templateSource =
    dispatchMode === "free_text"
      ? "none"
      : explicitTemplateName
        ? "campaign"
        : fallbackTemplateName
          ? "fallback"
          : "missing";
  const canCreateCampaign =
    canEdit &&
    !saving &&
    selectedLeadIds.length > 0 &&
    (!largeCampaign || confirmLargeCampaign) &&
    (!templateRequired || Boolean(effectiveTemplateName)) &&
    !templateParameterMismatch;

  const dispatchSummary =
    dispatchMode === "free_text"
      ? "Texto livre · só dentro da janela de 24h"
      : templateSource === "missing"
        ? "Pendente: selecione um template"
        : `${effectiveTemplateName || "Fallback global"} (${effectiveTemplateLanguage}) · ${templateVariableKeys.length} parâmetro${templateVariableKeys.length === 1 ? "" : "s"}`;

  function buildFallbackTitle() {
    const now = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(new Date())
      .replace(",", "");
    return `Disparo ${now}`;
  }

  const eligibleLeads = React.useMemo(
    () => leads.filter((lead) => Boolean((lead.whatsapp || lead.telefone).replace(/\D/g, ""))),
    [leads],
  );

  const leadListLeadIds = React.useMemo(() => {
    if (leadListFilter === "all") return null;
    const selectedList = leadLists.find((list) => list.id === leadListFilter);
    return new Set(selectedList?.leadIds ?? []);
  }, [leadListFilter, leadLists]);

  const filteredLeads = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return eligibleLeads.filter((lead) => {
      const matchesSearch =
        !term ||
        lead.nome.toLowerCase().includes(term) ||
        lead.curso_de_interesse.toLowerCase().includes(term) ||
        lead.responsavel.toLowerCase().includes(term);
      const matchesFunnel = funnelFilter === "all" || lead.status_funil === funnelFilter;
      const matchesCourse = courseFilter === "all" || lead.curso_de_interesse === courseFilter;
      const matchesStudent =
        studentFilter === "all" ||
        (studentFilter === "Sim"
          ? lead.ja_foi_aluno === "Sim"
          : lead.ja_foi_aluno === ("Não" as Lead["ja_foi_aluno"]));
      const matchesLeadList = !leadListLeadIds || leadListLeadIds.has(lead.id);

      return matchesSearch && matchesFunnel && matchesCourse && matchesStudent && matchesLeadList;
    });
  }, [courseFilter, eligibleLeads, funnelFilter, leadListLeadIds, search, studentFilter]);

  const visibleLeadIds = React.useMemo(() => filteredLeads.map((lead) => lead.id), [filteredLeads]);
  const allVisibleSelected =
    visibleLeadIds.length > 0 && visibleLeadIds.every((leadId) => selectedLeadIds.includes(leadId));

  function toggleLead(leadId: string) {
    setSelectedLeadIds((current) =>
      current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId],
    );
  }

  function toggleVisibleLeads() {
    setSelectedLeadIds((current) => {
      if (allVisibleSelected) {
        return current.filter((leadId) => !visibleLeadIds.includes(leadId));
      }
      return Array.from(new Set([...current, ...visibleLeadIds]));
    });
  }

  function toggleTemplateVariable(key: MessageCampaignTemplateVariableKey) {
    setTemplateVariableKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  function selectMetaTemplate(value: string) {
    if (value === "__none__") {
      return;
    }
    if (value === "__fallback__") {
      setMetaTemplateName("");
      setMetaTemplateLanguage(fallbackTemplateLanguage);
      setManualTemplateEntry(false);
      return;
    }
    if (value === "__manual__") {
      setManualTemplateEntry(true);
      return;
    }

    const [name, language] = value.split("::");
    const template = availableMetaTemplates.find((item) => item.name === name && item.language === language);
    if (!template) return;
    setMetaTemplateName(template.name);
    setMetaTemplateLanguage(template.language || "pt_BR");
    setManualTemplateEntry(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (templateRequired && !effectiveTemplateName) {
        throw new Error("Selecione um template aprovado antes de criar este disparo.");
      }
      if (templateParameterMismatch && selectedMetaTemplate) {
        throw new Error(
          `O template selecionado espera ${selectedMetaTemplate.parameterCount} parametro(s), mas ${templateVariableKeys.length} foram marcados.`,
        );
      }
      const normalizedTitle = title.trim().length >= 3 ? title.trim() : buildFallbackTitle();
      await onCreateCampaign({
        title: normalizedTitle,
        messageTemplate,
        delaySeconds: Number(delaySeconds),
        leadIds: selectedLeadIds,
        confirmLargeCampaign,
        dispatchMode,
        metaTemplateName: dispatchMode === "free_text" ? "" : effectiveTemplateName,
        metaTemplateLanguage: dispatchMode === "free_text" ? "pt_BR" : effectiveTemplateLanguage,
        templateVariableKeys,
      });
      setTitle("");
      setDispatchMode("hybrid");
      setMetaTemplateName("");
      setMetaTemplateLanguage("pt_BR");
      setManualTemplateEntry(false);
      setTemplateVariableKeys([]);
      setMessageTemplate("Olá, {nome}! Aqui é do Base CRM sobre o curso {curso}. Posso te ajudar a avançar?");
      setDelaySeconds("45");
      setSelectedLeadIds([]);
      setConfirmLargeCampaign(false);
      setLeadListFilter("all");
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o disparo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.56fr)]">
      <div className="flex flex-col overflow-hidden rounded-[32px] border border-border bg-[#0c0c0c]">
        <div className="border-b border-white/5 pb-4 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-3 text-[18px] font-medium text-white">
                <span className="rounded-[16px] border border-primary/20 bg-primary/10 p-2.5 text-primary">
                  <Send className="h-4 w-4" />
                </span>
                Novo disparo oficial
              </h2>
              <p className="mt-2.5 text-[13px] leading-relaxed text-white/50">
                Prepare mensagem, template, ritmo e público antes de criar a fila de envio.
              </p>
            </div>
            <span
              className={[
                "inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em]",
                canCreateCampaign
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-amber-500/20 bg-amber-500/10 text-amber-500",
              ].join(" ")}
            >
              <span className={["h-1.5 w-1.5 rounded-full", canCreateCampaign ? "bg-primary" : "bg-amber-500"].join(" ")} />
              {canCreateCampaign ? "Pronto para criar" : "Aguardando revisão"}
            </span>
          </div>
        </div>
        <div className="p-6 pt-0">
          <form className="grid gap-6 pt-6" onSubmit={handleSubmit}>
            <FormStepCard
              icon={MessageSquareText}
              eyebrow="Etapa 1"
              title="Mensagem e identificação"
              description="Nomeie internamente a campanha e revise o texto base que será usado no envio."
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className="grid gap-2">
                  <Label htmlFor="campaign-title" className="text-white/70">Nome interno</Label>
                  <Input
                    id="campaign-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Ex.: Reativação de base junho"
                    disabled={!canEdit || saving}
                    className="h-11 rounded-[16px] border-white/10 bg-white/5 text-[13px] text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-primary/50"
                  />
                  <p className="text-[11px] text-white/30">Se ficar em branco, o CRM cria um nome automático.</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="campaign-message" className="text-white/70">Mensagem base</Label>
                  <Textarea
                    id="campaign-message"
                    value={messageTemplate}
                    onChange={(event) => setMessageTemplate(event.target.value)}
                    className="min-h-32 rounded-[16px] border-white/10 bg-white/5 text-[13px] text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-primary/50"
                    disabled={!canEdit || saving}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] text-muted-foreground">
                {["{nome}", "{curso}", "{origem}", "{cidade}", "{responsavel}", "{profissao}", "{telefone}"].map((variable) => (
                  <span key={variable} className="rounded-full border bg-background px-2 py-1 font-medium">
                    {variable}
                  </span>
                ))}
              </div>
            </FormStepCard>

            <div
              className={[
                "flex flex-wrap items-center justify-between gap-4 rounded-[20px] border p-5 ",
                templateSource === "missing"
                  ? "border-rose-500/30 bg-rose-500/5"
                  : templateSource === "fallback"
                    ? "border-amber-500/25 bg-amber-500/5"
                    : "border-primary/20 bg-primary/5",
              ].join(" ")}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-white">
                  {templateSource === "missing" ? (
                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                  Envio
                </p>
                <p className="mt-1.5 truncate text-[12px] text-white/50">{dispatchSummary}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setTemplateDialogOpen(true)} disabled={!canEdit || saving} className="rounded-[16px] h-10 border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold tracking-wide">
                <FileText className="h-4 w-4 mr-2" />
                Selecionar template
              </Button>
            </div>

            <FormStepCard
              icon={Clock3}
              eyebrow="Etapa 2"
              title="Ritmo operacional"
              description="Controle o intervalo para reduzir risco e manter a operação acompanhável."
            >
              <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
                <div className="grid gap-2">
                  <Label htmlFor="campaign-delay" className="text-white/70">Intervalo entre envios (s)</Label>
                  <Input
                    id="campaign-delay"
                    type="number"
                    min={30}
                    max={1800}
                    value={delaySeconds}
                    onChange={(event) => setDelaySeconds(event.target.value)}
                    disabled={!canEdit || saving}
                    className="h-11 rounded-[16px] border-white/10 bg-white/5 text-[13px] text-white"
                  />
                </div>
                <div className="flex items-center gap-3 rounded-[16px] border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-[12px] leading-relaxed text-sky-200">
                  <TimerReset className="h-4 w-4 shrink-0 text-sky-400" />
                  <span>
                    Padrão seguro: mínimo de 30 segundos. O CRM processa a fila em ciclos e evita disparo instantâneo em massa.
                  </span>
                </div>
              </div>
            </FormStepCard>

            <div className="overflow-hidden rounded-[24px] border border-white/5 bg-white/[0.01]">
              <div className="flex flex-col gap-3 border-b border-white/5 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-[14px] font-semibold text-white">
                    <Users className="h-4 w-4 text-primary" />
                    Público do disparo
                  </p>
                  <p className="mt-1.5 text-[12px] text-white/40">Filtre, confira e selecione somente os leads compatíveis com a campanha.</p>
                </div>
                <div className="inline-flex w-fit items-center gap-1.5 rounded-[12px] border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {selectedLeadIds.length} selecionado{selectedLeadIds.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="grid gap-3 p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="campaign-search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar por nome, curso ou responsável"
                      disabled={!canEdit || saving}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground">
                    <ListFilter className="h-4 w-4" />
                    {filteredLeads.length} visível(is)
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <Select value={funnelFilter} onValueChange={setFunnelFilter} disabled={!canEdit || saving}>
                    <SelectTrigger>
                      <SelectValue placeholder="Etapa do funil" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as etapas</SelectItem>
                      {funnelStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={courseFilter} onValueChange={setCourseFilter} disabled={!canEdit || saving}>
                    <SelectTrigger>
                      <SelectValue placeholder="Curso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os cursos</SelectItem>
                      {courseOptions.map((course) => (
                        <SelectItem key={course} value={course}>
                          {course}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={studentFilter} onValueChange={setStudentFilter} disabled={!canEdit || saving}>
                    <SelectTrigger>
                      <SelectValue placeholder="Já foi aluno?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="Sim">Já é aluno</SelectItem>
                      <SelectItem value="Não">Ainda não é aluno</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={leadListFilter} onValueChange={setLeadListFilter} disabled={!canEdit || saving}>
                    <SelectTrigger>
                      <SelectValue placeholder="Lista comercial" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as listas</SelectItem>
                      {leadLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Seleção rápida com base nos filtros atuais
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleVisibleLeads}
                    disabled={!canEdit || saving || !visibleLeadIds.length}
                  >
                    {allVisibleSelected ? "Desmarcar visíveis" : "Selecionar visíveis"}
                  </Button>
                </div>

                <div className="crm-scrollbar max-h-80 overflow-y-auto rounded-xl border bg-background">
                  <div className="grid divide-y">
                    {filteredLeads.length ? (
                      filteredLeads.map((lead) => {
                        const checked = selectedLeadIds.includes(lead.id);
                        return (
                          <label
                            key={lead.id}
                            className={[
                              "flex cursor-pointer items-start gap-3 px-4 py-3 text-sm transition",
                              checked ? "bg-primary/8" : "hover:bg-muted/40",
                            ].join(" ")}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleLead(lead.id)}
                              disabled={!canEdit || saving}
                              className="mt-1"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2 font-medium">
                                <span className={["h-2 w-2 rounded-full", checked ? "bg-primary" : "bg-muted-foreground/40"].join(" ")} />
                                <span className="truncate">{lead.nome}</span>
                              </span>
                              <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                                <span className="rounded-full bg-muted px-2 py-0.5">{lead.curso_de_interesse}</span>
                                <span className="rounded-full bg-muted px-2 py-0.5">{lead.responsavel}</span>
                              </span>
                            </span>
                          </label>
                        );
                      })
                    ) : (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        <Search className="mx-auto mb-2 h-5 w-5" />
                        Nenhum lead encontrado com os filtros atuais.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {largeCampaign ? (
              <label className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={confirmLargeCampaign}
                  onChange={(event) => setConfirmLargeCampaign(event.target.checked)}
                  disabled={!canEdit || saving}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-foreground">Confirmação manual obrigatória</span>
                  <span className="block text-muted-foreground">
                    Este disparo excede 20 leads. Revise mensagem, público e intervalo antes de iniciar.
                  </span>
                </span>
              </label>
            ) : null}

            {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p> : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={!canCreateCampaign}>
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Criar disparo
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div className="flex flex-col rounded-[32px] border border-border bg-[#0c0c0c]">
        <div className="border-b border-white/5 pb-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-medium text-white">Fila de disparos</h3>
              <p className="mt-1 text-[12px] text-white/50">Acompanhe status, progresso e pontos de atenção.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading} className="text-white/50 hover:bg-white/10 hover:text-white">
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Atualizar"}
            </Button>
          </div>
        </div>
        <div className="p-6 pt-4">
          <div className="crm-scrollbar max-h-[760px] space-y-3 overflow-y-auto pr-1">
            {campaigns.length ? (
              campaigns.map((campaign) => {
                const sent = campaign.recipients.filter((recipient) => recipient.status === "sent").length;
                const failed = campaign.recipients.filter((recipient) => recipient.status === "failed").length;
                const pending = campaign.recipients.filter((recipient) => recipient.status === "pending").length;
                const skipped = campaign.recipients.filter((recipient) => recipient.status === "skipped").length;
                const total = campaign.recipients.length;
                const processed = sent + failed + skipped;
                const progress = total > 0 ? Math.round((processed / total) * 100) : 0;
                const templateConfig = campaign.templateConfig || campaign.recipients.find((recipient) => recipient.templateConfig)?.templateConfig;
                const templateSent = campaign.recipients.filter((recipient) => recipient.selectedRoute === "meta_template").length;
                const freeTextSent = campaign.recipients.filter((recipient) => recipient.selectedRoute === "free_text").length;
                const statusMeta = CAMPAIGN_STATUS_META[campaign.status];
                const routeLabel =
                  templateConfig?.mode === "meta_template"
                    ? "Somente template"
                    : templateConfig?.mode === "hybrid"
                      ? "Híbrido"
                      : "Texto livre";
                const issueReasons = new Map<string, number>();
                for (const recipient of campaign.recipients) {
                  if ((recipient.status === "skipped" || recipient.status === "failed") && recipient.error) {
                    issueReasons.set(recipient.error, (issueReasons.get(recipient.error) ?? 0) + 1);
                  }
                }

                return (
                  <div key={campaign.id} className="overflow-hidden rounded-[20px] border border-white/5 bg-white/[0.02]">
                    <div className="border-b border-white/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-white">{campaign.title}</p>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/40">
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {campaign.createdByName}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5" />
                              {campaign.delaySeconds}s
                            </span>
                          </p>
                        </div>
                        <span
                          className={[
                            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest",
                            statusMeta.className,
                          ].join(" ")}
                        >
                          <span className={["h-1.5 w-1.5 rounded-full", statusMeta.dotClassName].join(" ")} />
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>

                    <div className="p-3">
                      <div className="flex items-center justify-between gap-3 text-[12px]">
                        <span className="font-medium text-white">{processed}/{total} processados</span>
                        <span className="font-bold text-white/50">{progress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-primary transition-colors" style={{ width: `${progress}%` }} />
                      </div>

                      <p className="mt-4 line-clamp-2 text-[12px] leading-relaxed text-white/60">{campaign.messageTemplate}</p>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                        <QueueStatChip icon={CheckCircle2} label="Enviados" value={sent} className="bg-emerald-500/10 text-emerald-400" />
                        <QueueStatChip icon={TimerReset} label="Pendentes" value={pending} className="bg-amber-500/10 text-amber-500" />
                        <QueueStatChip icon={AlertTriangle} label="Falhas" value={failed} className="bg-rose-500/10 text-rose-500" />
                        <QueueStatChip icon={Ban} label="Ignorados" value={skipped} className="bg-slate-500/10 text-slate-400" />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-white/50 uppercase tracking-widest font-bold">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                          <Send className="h-3 w-3" />
                          {routeLabel}
                        </span>
                        {templateConfig?.metaTemplateName ? (
                          <span className="max-w-full truncate rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                            {templateConfig.metaTemplateName} ({templateConfig.metaTemplateLanguage || "pt_BR"})
                          </span>
                        ) : null}
                        {templateSent ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{templateSent} via template</span> : null}
                        {freeTextSent ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{freeTextSent} via texto</span> : null}
                      </div>

                      {issueReasons.size > 0 ? (
                        <div className="mt-4 rounded-[16px] border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                          <p className="flex items-center gap-2 text-[12px] font-bold text-amber-500">
                            <AlertTriangle className="h-4 w-4" />
                            Pontos de atenção
                          </p>
                          <ul className="mt-2 space-y-1 text-[11px] text-amber-500/70">
                            {Array.from(issueReasons.entries())
                              .slice(0, 3)
                              .map(([reason, count]) => (
                                <li key={reason} className="truncate">
                                  {count}x · {reason}
                                </li>
                              ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="mt-5 flex flex-wrap gap-2">
                        {campaign.status === "draft" || campaign.status === "paused" ? (
                          <Button size="sm" onClick={() => onChangeCampaignStatus(campaign.id, "running")} disabled={!canEdit || loading} className="rounded-full font-bold uppercase tracking-wider text-[10px] h-8">
                            <Play className="h-3.5 w-3.5 mr-1" />
                            Iniciar
                          </Button>
                        ) : null}
                        {campaign.status === "running" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onChangeCampaignStatus(campaign.id, "paused")}
                            disabled={!canEdit || loading}
                            className="rounded-full font-bold uppercase tracking-wider text-[10px] h-8 border-white/10 bg-white/5 text-white hover:bg-white/10"
                          >
                            <Pause className="h-3.5 w-3.5 mr-1" />
                            Pausar
                          </Button>
                        ) : null}
                        {campaign.status !== "completed" && campaign.status !== "cancelled" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onChangeCampaignStatus(campaign.id, "cancelled")}
                            disabled={!canEdit || loading}
                            className="rounded-full font-bold uppercase tracking-wider text-[10px] h-8 text-white/50 hover:bg-white/10 hover:text-white"
                          >
                            <Square className="h-3.5 w-3.5 mr-1" />
                            Cancelar
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 p-8 text-center text-[13px] text-white/30">
                <Users className="mx-auto mb-3 h-6 w-6 text-white/20" />
                Nenhum disparo criado ainda.
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Selecionar template</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-3">
              {DISPATCH_MODE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = dispatchMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setDispatchMode(option.value)}
                    disabled={!canEdit || saving}
                    className={[
                      "rounded-xl border p-3 text-left transition",
                      selected ? "border-primary bg-primary/10" : "bg-background hover:border-primary/50 hover:bg-muted/40",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">{option.title}</span>
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{option.description}</span>
                  </button>
                );
              })}
            </div>

            {dispatchMode !== "free_text" ? (
              <>
                <div className="grid gap-2">
                  {availableMetaTemplates.length > 0 && !manualTemplateEntry ? (
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="campaign-meta-template-select">Template aprovado</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setManualTemplateEntry(true)} disabled={!canEdit || saving}>
                          Digitar manualmente
                        </Button>
                      </div>
                      <Select value={selectedTemplateKey} onValueChange={selectMetaTemplate} disabled={!canEdit || saving}>
                        <SelectTrigger id="campaign-meta-template-select">
                          <SelectValue placeholder="Selecione um template aprovado" />
                        </SelectTrigger>
                        <SelectContent>
                          {!fallbackTemplateName && !explicitTemplateName ? (
                            <SelectItem value="__none__">Selecione um template aprovado</SelectItem>
                          ) : null}
                          {fallbackTemplateName ? (
                            <SelectItem value="__fallback__">
                              Fallback global: {fallbackTemplateName} ({fallbackTemplateLanguage})
                            </SelectItem>
                          ) : null}
                          {availableMetaTemplates.map((template) => (
                            <SelectItem key={`${template.name}::${template.language}`} value={`${template.name}::${template.language}`}>
                              {template.name} ({template.language}) · {template.parameterCount} parametro
                              {template.parameterCount === 1 ? "" : "s"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="campaign-meta-template">Nome do template na Meta</Label>
                          {availableMetaTemplates.length > 0 ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setManualTemplateEntry(false)} disabled={!canEdit || saving}>
                              Voltar para lista
                            </Button>
                          ) : null}
                        </div>
                        <Input
                          id="campaign-meta-template"
                          value={metaTemplateName}
                          onChange={(event) => setMetaTemplateName(event.target.value)}
                          placeholder={fallbackTemplateName || "ex.: reengajamento_geral"}
                          disabled={!canEdit || saving}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="campaign-meta-language">Idioma</Label>
                        <Input
                          id="campaign-meta-language"
                          value={metaTemplateLanguage}
                          onChange={(event) => setMetaTemplateLanguage(event.target.value)}
                          placeholder="pt_BR"
                          disabled={!canEdit || saving}
                        />
                      </div>
                    </div>
                  )}

                  {templateSettings?.templatesSyncError ? (
                    <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                      A lista da Meta não foi atualizada agora: {templateSettings.templatesSyncError}
                    </p>
                  ) : !templateSettings?.templatesSyncConfigured ? (
                    <p className="text-xs text-muted-foreground">Configure META_WABA_ID para listar templates da Meta automaticamente.</p>
                  ) : allSyncedMetaTemplates.length > availableMetaTemplates.length ? (
                    <p className="text-xs text-muted-foreground">
                      {allSyncedMetaTemplates.length - availableMetaTemplates.length} template(s) ainda não aprovados foram ocultados.
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label>Parâmetros do template</Label>
                  <p className="text-xs text-muted-foreground">Marque na mesma ordem do template aprovado: o primeiro marcado vira {"{{1}}"}.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {templateVariables.map((variable) => {
                      const checked = templateVariableKeys.includes(variable.key);
                      const position = checked ? templateVariableKeys.indexOf(variable.key) + 1 : null;
                      return (
                        <label
                          key={variable.key}
                          className={[
                            "flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs transition",
                            checked ? "border-primary bg-primary/10" : "bg-background hover:bg-muted/40",
                          ].join(" ")}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            onChange={() => toggleTemplateVariable(variable.key)}
                            disabled={!canEdit || saving}
                          />
                          <span className="min-w-0">
                            <span className="block font-medium text-foreground">
                              {position ? `{{${position}}} ` : ""}
                              {variable.label}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {selectedMetaTemplate ? (
                    <p className={["text-xs", templateParameterMismatch ? "text-destructive" : "text-muted-foreground"].join(" ")}>
                      Este template espera {selectedMetaTemplate.parameterCount} parametro
                      {selectedMetaTemplate.parameterCount === 1 ? "" : "s"} · {templateVariableKeys.length} marcado(s)
                      {templateParameterMismatch ? " — ajuste antes de continuar." : ""}
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setTemplateDialogOpen(false)}>
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormStepCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: typeof Send;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-border bg-card">
      <div className="flex items-start gap-4 border-b border-white/5 p-5">
        <span className="rounded-full border border-primary/20 bg-primary/10 p-2.5 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">{eyebrow}</p>
          <p className="mt-1 text-[15px] font-semibold text-white">{title}</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-white/40">{description}</p>
        </div>
      </div>
      <div className="grid gap-4 p-5">{children}</div>
    </div>
  );
}

function QueueStatChip({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof Send;
  label: string;
  value: number;
  className: string;
}) {
  return (
    <span className={["inline-flex items-center justify-between gap-2 rounded-[12px] px-3 py-2 border border-white/5", className].join(" ")}>
      <span className="inline-flex min-w-0 items-center gap-1.5 opacity-80">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate uppercase tracking-widest text-[9px] font-bold">{label}</span>
      </span>
      <span className="font-bold">{value}</span>
    </span>
  );
}
