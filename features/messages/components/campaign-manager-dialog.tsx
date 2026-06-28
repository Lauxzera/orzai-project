"use client";

import * as React from "react";
import { LoaderCircle, Pause, Play, Plus, Send, Square, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { funnelStatuses, type Lead, type LeadList } from "@/lib/crm";
import type { MessageCampaign } from "@/lib/messages";

type Props = {
  leads: Lead[];
  leadLists: LeadList[];
  campaigns: MessageCampaign[];
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
  }) => Promise<void>;
  onChangeCampaignStatus: (campaignId: string, status: MessageCampaign["status"]) => Promise<void>;
};

export function CampaignManagerDialog({
  leads,
  leadLists,
  campaigns,
  canEdit,
  loading,
  courseOptions,
  onRefresh,
  onCreateCampaign,
  onChangeCampaignStatus,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [funnelFilter, setFunnelFilter] = React.useState("all");
  const [courseFilter, setCourseFilter] = React.useState("all");
  const [studentFilter, setStudentFilter] = React.useState("all");
  const [leadListFilter, setLeadListFilter] = React.useState("all");
  const [selectedLeadIds, setSelectedLeadIds] = React.useState<string[]>([]);
  const [title, setTitle] = React.useState("");
  const [messageTemplate, setMessageTemplate] = React.useState(
    "Olá, {nome}! Aqui é do Base CRM sobre o curso {curso}. Posso te ajudar a avançar?"
  );
  const [delaySeconds, setDelaySeconds] = React.useState("45");
  const [confirmLargeCampaign, setConfirmLargeCampaign] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const largeCampaign = selectedLeadIds.length > 20;

  function buildFallbackTitle() {
    const now = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(new Date())
      .replace(",", "");
    return `Campanha ${now}`;
  }

  const eligibleLeads = React.useMemo(
    () => leads.filter((lead) => Boolean((lead.whatsapp || lead.telefone).replace(/\D/g, ""))),
    [leads]
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
      current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId]
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const normalizedTitle = title.trim().length >= 3 ? title.trim() : buildFallbackTitle();
      await onCreateCampaign({
        title: normalizedTitle,
        messageTemplate,
        delaySeconds: Number(delaySeconds),
        leadIds: selectedLeadIds,
        confirmLargeCampaign,
      });
      setTitle("");
      setMessageTemplate("Olá, {nome}! Aqui é do Base CRM sobre o curso {curso}. Posso te ajudar a avançar?");
      setDelaySeconds("45");
      setSelectedLeadIds([]);
      setConfirmLargeCampaign(false);
      setLeadListFilter("all");
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a campanha.");
    } finally {
      setSaving(false);
    }
  }

  const runningCount = campaigns.filter((campaign) => campaign.status === "running").length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Send className="h-4 w-4" />
          Campanhas
          {runningCount > 0 ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {runningCount} ativa(s)
            </span>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Campanhas de mensagens</DialogTitle>
          <DialogDescription>
            Monte disparos em lote com fila, pausa e atraso operacional entre mensagens.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Criar campanha</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4" onSubmit={handleSubmit}>
                  <div className="grid gap-2">
                    <Label htmlFor="campaign-title">Título</Label>
                    <Input
                      id="campaign-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Ex.: Reativação de maio"
                      disabled={!canEdit || saving}
                    />
                    <p className="text-xs text-muted-foreground">
                      Se ficar em branco, o CRM cria um título automático para a campanha.
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="campaign-message">Mensagem</Label>
                    <Textarea
                      id="campaign-message"
                      value={messageTemplate}
                      onChange={(event) => setMessageTemplate(event.target.value)}
                      className="min-h-28"
                      disabled={!canEdit || saving}
                    />
                    <p className="text-xs text-muted-foreground">
                      Variáveis: {"{nome}"}, {"{curso}"}, {"{origem}"}, {"{cidade}"}, {"{responsavel}"}
                    </p>
                  </div>

                  <div className="grid gap-2 sm:max-w-[180px]">
                    <Label htmlFor="campaign-delay">Delay entre envios (segundos)</Label>
                    <Input
                      id="campaign-delay"
                      type="number"
                      min={30}
                      max={1800}
                      value={delaySeconds}
                      onChange={(event) => setDelaySeconds(event.target.value)}
                      disabled={!canEdit || saving}
                    />
                    <p className="text-xs text-muted-foreground">Janela permitida: 30 a 1800 segundos por envio.</p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="campaign-search">Selecionar leads</Label>
                    <Input
                      id="campaign-search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar por nome, curso ou responsável"
                      disabled={!canEdit || saving}
                    />
                    <div className="grid gap-2 md:grid-cols-4">
                      <Select value={funnelFilter} onValueChange={setFunnelFilter} disabled={!canEdit || saving}>
                        <SelectTrigger>
                          <SelectValue placeholder="Funil" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os funis</SelectItem>
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
                          <SelectValue placeholder="Já é aluno?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="Sim">Já é aluno</SelectItem>
                          <SelectItem value="Não">Ainda não é aluno</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={leadListFilter} onValueChange={setLeadListFilter} disabled={!canEdit || saving}>
                        <SelectTrigger>
                          <SelectValue placeholder="Lista de clientes" />
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

                    <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
                      <p className="text-xs text-muted-foreground">
                        {filteredLeads.length} lead(s) visível(is) com os filtros atuais
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

                    <div className="crm-scrollbar max-h-72 overflow-y-auto rounded-xl border">
                      <div className="grid divide-y">
                        {filteredLeads.map((lead) => (
                          <label key={lead.id} className="flex cursor-pointer items-start gap-3 px-4 py-3 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedLeadIds.includes(lead.id)}
                              onChange={() => toggleLead(lead.id)}
                              disabled={!canEdit || saving}
                              className="mt-1"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium">{lead.nome}</span>
                              <span className="block text-muted-foreground">
                                {lead.curso_de_interesse} · {lead.responsavel}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">{selectedLeadIds.length} lead(s) selecionado(s)</p>

                    {largeCampaign ? (
                      <label className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-3 text-sm">
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
                            Esta campanha excede 20 leads. Revise o texto, público e atraso antes de iniciar.
                          </span>
                        </span>
                      </label>
                    ) : null}
                  </div>

                  {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p> : null}

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={!canEdit || saving || !selectedLeadIds.length || (largeCampaign && !confirmLargeCampaign)}
                    >
                      {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Criar campanha
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Campanhas criadas</CardTitle>
                  <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
                    {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Atualizar"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="crm-scrollbar max-h-[560px] space-y-3 overflow-y-auto pr-1">
                  {campaigns.length ? (
                    campaigns.map((campaign) => {
                      const sent = campaign.recipients.filter((recipient) => recipient.status === "sent").length;
                      const failed = campaign.recipients.filter((recipient) => recipient.status === "failed").length;
                      const pending = campaign.recipients.filter((recipient) => recipient.status === "pending").length;
                      const skipped = campaign.recipients.filter((recipient) => recipient.status === "skipped").length;

                      return (
                        <div key={campaign.id} className="rounded-2xl border p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">{campaign.title}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {campaign.createdByName} · atraso {campaign.delaySeconds}s
                              </p>
                            </div>
                            <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              {campaign.status}
                            </span>
                          </div>
                          <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{campaign.messageTemplate}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="rounded-full bg-muted px-2 py-1">{sent} enviados</span>
                            <span className="rounded-full bg-muted px-2 py-1">{pending} pendentes</span>
                            <span className="rounded-full bg-muted px-2 py-1">{failed} falhas</span>
                            <span className="rounded-full bg-muted px-2 py-1">{skipped} ignorados</span>
                            <span className="rounded-full bg-muted px-2 py-1">{campaign.recipients.length} total</span>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {campaign.status === "draft" || campaign.status === "paused" ? (
                              <Button size="sm" onClick={() => onChangeCampaignStatus(campaign.id, "running")} disabled={!canEdit || loading}>
                                <Play className="h-4 w-4" />
                                Iniciar
                              </Button>
                            ) : null}
                            {campaign.status === "running" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onChangeCampaignStatus(campaign.id, "paused")}
                                disabled={!canEdit || loading}
                              >
                                <Pause className="h-4 w-4" />
                                Pausar
                              </Button>
                            ) : null}
                            {campaign.status !== "completed" && campaign.status !== "cancelled" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onChangeCampaignStatus(campaign.id, "cancelled")}
                                disabled={!canEdit || loading}
                              >
                                <Square className="h-4 w-4" />
                                Cancelar
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      <Users className="mx-auto mb-3 h-5 w-5" />
                      Nenhuma campanha criada ainda.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

