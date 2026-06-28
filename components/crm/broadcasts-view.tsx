"use client";

import * as React from "react";
import { CheckCheck, Clock3, PauseCircle, RadioTower, Send, ShieldAlert, TimerReset } from "lucide-react";
import { CampaignManagerPanel } from "@/features/messages/components/campaign-manager-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currentDate, type Lead, type LeadList } from "@/lib/crm";
import type { MessageCampaign, MessageCampaignDispatchMode, MessageCampaignTemplateSettings, MessageCampaignTemplateVariableKey } from "@/lib/messages";
import { cn } from "@/lib/utils";

const CAMPAIGN_DISPATCH_MS = 15_000;

type Props = {
  leads: Lead[];
  leadLists: LeadList[];
  courseOptions: readonly string[];
  canEdit: boolean;
};

export function BroadcastsView({ leads, leadLists, courseOptions, canEdit }: Props) {
  const [campaigns, setCampaigns] = React.useState<MessageCampaign[]>([]);
  const [templateSettings, setTemplateSettings] = React.useState<MessageCampaignTemplateSettings | null>(null);
  const [campaignsLoading, setCampaignsLoading] = React.useState(false);
  const [pageVisible, setPageVisible] = React.useState(true);
  const campaignsFetchInFlightRef = React.useRef(false);
  const campaignDispatchInFlightRef = React.useRef(false);

  const loadCampaigns = React.useCallback(async (background = false) => {
    if (campaignsFetchInFlightRef.current) return;
    if (!background) setCampaignsLoading(true);
    campaignsFetchInFlightRef.current = true;
    try {
      const response = await fetch("/api/messages/campaigns");
      const data = (await response.json()) as {
        campaigns?: MessageCampaign[];
        templateSettings?: MessageCampaignTemplateSettings;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível carregar os disparos.");
      }
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
      if (data.templateSettings) setTemplateSettings(data.templateSettings);
    } finally {
      campaignsFetchInFlightRef.current = false;
      if (!background) setCampaignsLoading(false);
    }
  }, []);

  const createCampaign = React.useCallback(
    async (payload: {
      title: string;
      messageTemplate: string;
      delaySeconds: number;
      leadIds: string[];
      confirmLargeCampaign: boolean;
      dispatchMode: MessageCampaignDispatchMode;
      metaTemplateName?: string;
      metaTemplateLanguage?: string;
      templateVariableKeys?: MessageCampaignTemplateVariableKey[];
    }) => {
      const response = await fetch("/api/messages/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível criar o disparo.");
      }
      await loadCampaigns(true);
    },
    [loadCampaigns],
  );

  const changeCampaignStatus = React.useCallback(
    async (campaignId: string, status: MessageCampaign["status"]) => {
      const response = await fetch(`/api/messages/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível atualizar o disparo.");
      }
      await loadCampaigns(true);
    },
    [loadCampaigns],
  );

  React.useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    function handleVisibility() {
      setPageVisible(document.visibilityState === "visible");
    }
    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  React.useEffect(() => {
    if (!canEdit) return;
    if (!pageVisible) return;
    if (!campaigns.some((campaign) => campaign.status === "running")) return;

    const interval = window.setInterval(() => {
      if (campaignDispatchInFlightRef.current) return;
      campaignDispatchInFlightRef.current = true;
      void fetch("/api/messages/campaigns/dispatch", { method: "POST" })
        .then(async (response) => {
          if (response.ok) {
            await loadCampaigns(true);
          }
        })
        .finally(() => {
          campaignDispatchInFlightRef.current = false;
        });
    }, CAMPAIGN_DISPATCH_MS);

    return () => window.clearInterval(interval);
  }, [campaigns, canEdit, loadCampaigns, pageVisible]);

  const stats = React.useMemo(() => {
    const running = campaigns.filter((campaign) => campaign.status === "running").length;
    const paused = campaigns.filter((campaign) => campaign.status === "paused").length;
    const pendingRecipients = campaigns.reduce(
      (sum, campaign) => sum + campaign.recipients.filter((recipient) => recipient.status === "pending").length,
      0,
    );
    const sentRecipients = campaigns.reduce(
      (sum, campaign) => sum + campaign.recipients.filter((recipient) => recipient.status === "sent").length,
      0,
    );
    const failedRecipients = campaigns.reduce(
      (sum, campaign) => sum + campaign.recipients.filter((recipient) => recipient.status === "failed").length,
      0,
    );
    return { running, paused, pendingRecipients, sentRecipients, failedRecipients };
  }, [campaigns]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 bg-[#080808] p-4 lg:p-6 overflow-y-auto crm-scrollbar">
      <section className="rounded-[32px] border border-white/5 bg-[#0a0a0a]/95 p-6 backdrop-blur-md">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">WhatsApp Business Platform</Badge>
              <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-500">Disparos oficiais</Badge>
            </div>
            <h1 className="mt-4 text-[24px] font-medium tracking-wide text-white sm:text-[32px]">
              Central de disparos oficiais
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-white/50">
              Organize campanhas, selecione públicos com mais precisão e acompanhe a fila de envios em massa em uma operação dedicada, separada do atendimento diário.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
            <MetricCard icon={RadioTower} label="Disparos em andamento" value={String(stats.running)} tone="primary" />
            <MetricCard icon={PauseCircle} label="Filas pausadas" value={String(stats.paused)} tone="warning" />
            <MetricCard icon={TimerReset} label="Pendências na fila" value={String(stats.pendingRecipients)} tone="neutral" />
            <MetricCard icon={CheckCheck} label="Mensagens enviadas" value={String(stats.sentRecipients)} tone="success" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          icon={Send}
          title="Fluxo operacional"
          description="Monte a mensagem, selecione o público, revise a fila e só então inicie o disparo. O CRM mantém a separação entre criação e execução para reduzir erros."
        />
        <InfoCard
          icon={Clock3}
          title="Intervalo de segurança"
          description="Os disparos respeitam intervalo mínimo de 30 segundos entre mensagens, com escalonamento de fila para reduzir risco operacional e facilitar o acompanhamento."
        />
        <InfoCard
          icon={ShieldAlert}
          title="Confirmação em lote"
          description="Disparos acima de 20 leads exigem revisão manual. Isso protege o time contra campanhas amplas iniciadas sem conferência final de público e texto."
        />
        <div className="h-full rounded-[24px] border border-white/5 bg-[#0c0c0c] shadow-none">
          <div className="flex h-full flex-col justify-between gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold text-white">Data operacional</p>
                <p className="mt-1 text-[12px] leading-relaxed text-white/40">
                  Referência atual do CRM para organização da rotina comercial.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void loadCampaigns()} className="text-white/50 hover:bg-white/10 hover:text-white">
                Atualizar
              </Button>
            </div>
            <p className="text-[20px] font-medium text-white">{currentDate(0)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-white/5 bg-[#0a0a0a]/95 p-5 backdrop-blur-md">
        <CampaignManagerPanel
          leads={leads}
          leadLists={leadLists}
          campaigns={campaigns}
          canEdit={canEdit}
          loading={campaignsLoading}
          templateSettings={templateSettings}
          courseOptions={courseOptions}
          onRefresh={loadCampaigns}
          onCreateCampaign={createCampaign}
          onChangeCampaignStatus={changeCampaignStatus}
        />
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Send;
  label: string;
  value: string;
  tone: "primary" | "warning" | "neutral" | "success";
}) {
  const toneClassName =
    tone === "primary"
      ? "border-primary/20 bg-primary/10 text-primary shadow-none"
      : tone === "warning"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
        : tone === "success"
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
          : "border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/5";

  return (
    <div className={cn("rounded-[20px] border p-4 transition-colors", toneClassName)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest">{label}</p>
          <p className="mt-2 text-[24px] font-light">{value}</p>
        </div>
        <div className="rounded-full bg-white/5 p-2.5">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Send;
  title: string;
  description: string;
}) {
  return (
    <div className="h-full rounded-[24px] border border-white/5 bg-[#0c0c0c] shadow-none hover:bg-white/[0.02] transition-colors">
      <div className="h-full p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-full border border-primary/20 bg-primary/10 p-2.5 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-white">{title}</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/40">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
