"use client";

import * as React from "react";
import { LoaderCircle, MessageCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type Lead } from "@/lib/crm";

type LeadAnalysisApiResult = {
  resumo: string;
  temperatura: "quente" | "morno" | "frio";
  urgencia: "alta" | "media" | "baixa";
  objecao_principal: string;
  proxima_acao: string;
  status_sugerido: string;
  sinais_de_compra: string[];
  riscos: string[];
  mensagem_whatsapp: string;
  source: "openrouter" | "fallback";
};

export function LeadAiCard({ lead }: { lead: Lead }) {
  const [result, setResult] = React.useState<LeadAnalysisApiResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleAnalyze() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ai/lead-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });

      if (!response.ok) {
        throw new Error("Falha ao analisar o lead.");
      }

      const data = (await response.json()) as LeadAnalysisApiResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel gerar a analise.");
    } finally {
      setLoading(false);
    }
  }

  const whatsappHref = result
    ? `https://wa.me/${(lead.whatsapp || lead.telefone)
        .replace(/\D/g, "")
        .replace(/^55/, "")
        .padStart(11, "0")
        .replace(/^/, "55")}?text=${encodeURIComponent(result.mensagem_whatsapp)}`
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              Analise com IA
            </CardTitle>
            <CardDescription>
              Classifica o lead, aponta risco, sugere o proximo passo e rascunha uma mensagem de WhatsApp.
            </CardDescription>
          </div>
          <Button onClick={handleAnalyze} disabled={loading} variant={result ? "outline" : "default"}>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {result ? "Analisar novamente" : "Analisar lead"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        {!result && !loading ? (
          <div className="rounded-md border border-dashed bg-muted/35 p-4 text-sm text-muted-foreground">
            Rode a analise para receber uma leitura comercial rapida deste lead.
          </div>
        ) : null}

        {result ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant={result.temperatura === "quente" ? "success" : result.temperatura === "frio" ? "outline" : "gold"}>
                Temperatura: {result.temperatura}
              </Badge>
              <Badge variant={result.urgencia === "alta" ? "danger" : result.urgencia === "media" ? "gold" : "outline"}>
                Urgencia: {result.urgencia}
              </Badge>
              <Badge variant="outline">Status sugerido: {result.status_sugerido}</Badge>
              <Badge variant="outline">{result.source === "openrouter" ? "OpenRouter" : "Fallback"}</Badge>
            </div>

            <div className="grid gap-3">
              <InfoBlock label="Resumo" content={result.resumo} />
              <InfoBlock label="Objecao principal" content={result.objecao_principal} />
              <InfoBlock label="Proxima acao recomendada" content={result.proxima_acao} />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <BulletBlock title="Sinais de compra" items={result.sinais_de_compra} tone="success" />
              <BulletBlock title="Riscos comerciais" items={result.riscos} tone="danger" />
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Mensagem sugerida para WhatsApp</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.mensagem_whatsapp}</p>
                </div>
                {whatsappHref ? (
                  <Button asChild size="sm">
                    <a href={whatsappHref} target="_blank" rel="noreferrer">
                      <MessageCircle className="h-4 w-4" />
                      Usar
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function InfoBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm leading-6 text-foreground">{content}</p>
    </div>
  );
}

function BulletBlock({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "success" | "danger";
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 grid gap-2">
        {items.length ? (
          items.map((item) => (
            <div key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span
                className={`mt-1.5 h-2 w-2 rounded-full ${tone === "success" ? "bg-emerald-500/70" : "bg-red-400/80"}`}
              />
              <span>{item}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum ponto relevante identificado.</p>
        )}
      </div>
    </div>
  );
}
