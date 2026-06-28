"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  enrollmentStatuses,
  type CourseSegmentKey,
  type CourseSegments,
  type LeadDuplicateHint,
  funnelStatuses,
  getRequiredLeadFieldsForStage,
  inferCourseSegment,
  type Lead,
} from "@/lib/crm";
import { cn } from "@/lib/utils";

type LeadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Omit<Lead, "id" | "history">;
  setLead: React.Dispatch<React.SetStateAction<Omit<Lead, "id" | "history">>>;
  ownerOptions: readonly string[];
  courseOptions: readonly string[];
  courseSegments?: CourseSegments;
  originOptions: readonly string[];
  captureMethodOptions: readonly string[];
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  error: string;
  editing: boolean;
  duplicateHints?: LeadDuplicateHint[];
};

export function LeadDialog({
  open,
  onOpenChange,
  lead,
  setLead,
  ownerOptions,
  courseOptions,
  courseSegments,
  originOptions,
  captureMethodOptions,
  onSubmit,
  error,
  editing,
  duplicateHints = [],
}: LeadDialogProps) {
  const update = (field: keyof Omit<Lead, "id" | "history">, value: string) => {
    setLead((current) => ({ ...current, [field]: value }));
  };

  const stageRequirements = getRequiredLeadFieldsForStage(lead.status_funil);
  const resolvedCourseSegments = React.useMemo<CourseSegments>(
    () =>
      courseSegments ?? {
        formacao: [...courseOptions],
        especializacao: [],
      },
    [courseOptions, courseSegments],
  );

  const [selectedCourseSegment, setSelectedCourseSegment] = React.useState<CourseSegmentKey>(() =>
    inferCourseSegment(
      {
        courses: [...courseOptions],
        courseSegments: resolvedCourseSegments,
        origins: [],
        leadCaptureMethods: [],
        owners: [],
      },
      lead.curso_de_interesse,
    ),
  );

  React.useEffect(() => {
    if (!open) return;
    setSelectedCourseSegment(
      inferCourseSegment(
        {
          courses: [...courseOptions],
          courseSegments: resolvedCourseSegments,
          origins: [],
          leadCaptureMethods: [],
          owners: [],
        },
        lead.curso_de_interesse,
      ),
    );
  }, [courseOptions, editing, lead.telefone, open, resolvedCourseSegments]);

  const visibleCourseOptions = resolvedCourseSegments[selectedCourseSegment];

  function handleCourseSegmentChange(value: string) {
    const nextSegment = value as CourseSegmentKey;
    setSelectedCourseSegment(nextSegment);
    const nextCourses = resolvedCourseSegments[nextSegment];
    if (nextCourses.includes(lead.curso_de_interesse)) return;
    update("curso_de_interesse", "");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lead" : "Cadastrar novo lead"}</DialogTitle>
          <DialogDescription>
            Cadastro operacional para atendimento comercial, com segmentação de curso, origem, responsável e contexto do lead.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-5" onSubmit={onSubmit}>
          {duplicateHints.length ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-foreground">Possível duplicidade encontrada</p>
              <div className="mt-2 space-y-1">
                {duplicateHints.map((hint) => (
                  <p key={`${hint.field}-${hint.lead.id}`} className="text-xs text-muted-foreground">
                    <strong className="text-foreground">{hint.field === "telefone" ? "Telefone" : "Email"}:</strong>{" "}
                    já usado por <strong className="text-foreground">{hint.lead.nome}</strong>.
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {stageRequirements.length ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-sm font-medium text-foreground">Requisitos da etapa atual</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {stageRequirements.map((requirement) => (
                  <Badge key={requirement.field} variant="gold">
                    {requirement.label}
                  </Badge>
                ))}
              </div>
              <div className="mt-2 space-y-1">
                {stageRequirements.map((requirement) => (
                  <p key={`${requirement.field}-reason`} className="text-xs text-muted-foreground">
                    <strong className="text-foreground">{requirement.label}:</strong> {requirement.reason}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="grid gap-5">
              <LeadSection
                title="Identificação e contato"
                description="Dados principais para criar o lead e deixar o atendimento operacional desde o primeiro registro."
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Nome *">
                    <Input required value={lead.nome} onChange={(event) => update("nome", event.target.value)} />
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={lead.email} onChange={(event) => update("email", event.target.value)} />
                  </Field>
                  <Field label="Telefone *">
                    <Input required value={lead.telefone} onChange={(event) => update("telefone", event.target.value)} />
                  </Field>
                  <Field label="WhatsApp">
                    <Input value={lead.whatsapp} onChange={(event) => update("whatsapp", event.target.value)} />
                  </Field>
                  <Field label="Cidade">
                    <Input value={lead.cidade} onChange={(event) => update("cidade", event.target.value)} />
                  </Field>
                  <Field label="Profissão">
                    <Input value={lead.profissao} onChange={(event) => update("profissao", event.target.value)} />
                  </Field>
                </div>
              </LeadSection>

              <LeadSection
                title="Curso e origem"
                description="Escolha primeiro o segmento do curso para liberar a lista correta de opções."
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Segmento do curso">
                    <SelectField
                      value={selectedCourseSegment}
                      onValueChange={handleCourseSegmentChange}
                      options={[
                        { value: "formacao", label: "Formação" },
                        { value: "especializacao", label: "Especialização" },
                      ]}
                    />
                  </Field>
                  <Field label="Curso">
                    <SelectField
                      value={lead.curso_de_interesse}
                      onValueChange={(value) => update("curso_de_interesse", value)}
                      options={visibleCourseOptions}
                    />
                  </Field>
                  <Field label="Origem">
                    <SelectField value={lead.origem} onValueChange={(value) => update("origem", value)} options={originOptions} />
                  </Field>
                  <Field label="Captado via">
                    <SelectField
                      value={lead.captado_via}
                      onValueChange={(value) => update("captado_via", value)}
                      options={captureMethodOptions}
                    />
                  </Field>
                  <Field label="Detalhe da origem" className="md:col-span-2">
                    <Input
                      value={lead.origem_detalhe}
                      onChange={(event) => update("origem_detalhe", event.target.value)}
                      placeholder="Ex.: Campanha maio · Instagram Direct · Lista Feira Estética"
                    />
                  </Field>
                </div>
              </LeadSection>

              <LeadSection
                title="Rastreamento e contexto"
                description="Guarde UTMs, referências e observações para que o histórico comercial fique consistente."
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="UTM source">
                    <Input value={lead.utm_source} onChange={(event) => update("utm_source", event.target.value)} placeholder="Ex.: instagram, google, meta" />
                  </Field>
                  <Field label="UTM medium">
                    <Input value={lead.utm_medium} onChange={(event) => update("utm_medium", event.target.value)} placeholder="Ex.: cpc, organic, referral" />
                  </Field>
                  <Field label="UTM campaign">
                    <Input value={lead.utm_campaign} onChange={(event) => update("utm_campaign", event.target.value)} placeholder="Ex.: campanha-maio-sobrancelhas" />
                  </Field>
                  <Field label="Tracking ID">
                    <Input value={lead.tracking_id} onChange={(event) => update("tracking_id", event.target.value)} placeholder="Ex.: fbclid, gclid ou ID interno" />
                  </Field>
                  <Field label="UTM term">
                    <Input value={lead.utm_term} onChange={(event) => update("utm_term", event.target.value)} />
                  </Field>
                  <Field label="UTM content">
                    <Input value={lead.utm_content} onChange={(event) => update("utm_content", event.target.value)} />
                  </Field>
                  <Field label="Referrer" className="md:col-span-2">
                    <Input value={lead.tracking_referrer} onChange={(event) => update("tracking_referrer", event.target.value)} placeholder="Ex.: https://instagram.com/..." />
                  </Field>
                  <Field label="Landing page" className="md:col-span-2">
                    <Input value={lead.tracking_landing_page} onChange={(event) => update("tracking_landing_page", event.target.value)} placeholder="Ex.: /lp/curso-design-sobrancelhas" />
                  </Field>
                  <Field label="Objeção / motivo de perda" className="md:col-span-2">
                    <Input value={lead.objecao_principal} onChange={(event) => update("objecao_principal", event.target.value)} />
                  </Field>
                  <Field label="Observações" className="md:col-span-2">
                    <Textarea value={lead.observacoes} onChange={(event) => update("observacoes", event.target.value)} className="min-h-24" />
                  </Field>
                </div>
              </LeadSection>
            </div>

            <div className="grid gap-5">
              <LeadSection
                title="Operação comercial"
                description="Defina os estados do funil e os responsáveis para o lead já entrar pronto no CRM."
              >
                <div className="grid gap-3">
                  <Field label="Status do funil">
                    <SelectField value={lead.status_funil} onValueChange={(value) => update("status_funil", value)} options={funnelStatuses} />
                  </Field>
                  <Field label="Status de matrícula">
                    <SelectField value={lead.status_matricula} onValueChange={(value) => update("status_matricula", value)} options={enrollmentStatuses} />
                  </Field>
                  <Field label="Responsável">
                    <SelectField value={lead.responsavel} onValueChange={(value) => update("responsavel", value)} options={ownerOptions} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Data de entrada">
                      <Input type="date" value={lead.data_entrada} onChange={(event) => update("data_entrada", event.target.value)} />
                    </Field>
                    <Field label="Próximo contato">
                      <Input type="date" value={lead.proximo_contato} onChange={(event) => update("proximo_contato", event.target.value)} />
                    </Field>
                  </div>
                  <Field label="Já foi aluno?">
                    <SelectField value={lead.ja_foi_aluno} onValueChange={(value) => update("ja_foi_aluno", value)} options={["Não", "Sim"]} />
                  </Field>
                </div>
              </LeadSection>

              <div className="rounded-2xl border bg-muted/25 p-4">
                <p className="text-sm font-semibold">Resumo rápido</p>
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                  <p><span className="font-medium text-foreground">Curso:</span> {lead.curso_de_interesse || "Não definido"}</p>
                  <p><span className="font-medium text-foreground">Segmento:</span> {selectedCourseSegment === "formacao" ? "Formação" : "Especialização"}</p>
                  <p><span className="font-medium text-foreground">Origem:</span> {lead.origem || "Não definida"}</p>
                  <p><span className="font-medium text-foreground">Responsável:</span> {lead.responsavel || "Não definido"}</p>
                </div>
              </div>
            </div>
          </div>

          {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar lead</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function LeadSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SelectField({
  value,
  onValueChange,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly string[] | ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={typeof option === "string" ? option : option.value} value={typeof option === "string" ? option : option.value}>
            {typeof option === "string" ? option : option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
