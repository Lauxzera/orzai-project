"use client";

import * as React from "react";
import { Plus, Save, Trash2, Tag, ArrowRight, UserPlus, GraduationCap, Briefcase, Sparkles, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CourseSegmentKey, CrmCustomizations } from "@/lib/crm";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  customizations: CrmCustomizations;
  ownerOptions: readonly string[];
  saving: boolean;
  error: string;
  success: string;
  onSave: (customizations: CrmCustomizations) => Promise<void>;
};

type SectionKey = "origins" | "leadCaptureMethods" | "owners";

const SETTINGS_CATEGORIES = [
  { id: "geral", label: "Geral", icon: Sparkles },
  { id: "atendimento", label: "Atendimento", icon: UserPlus },
  { id: "portfolio", label: "Portfólio", icon: GraduationCap },
] as const;

export function LeadSettingsView({ customizations, ownerOptions, saving, error, success, onSave }: Props) {
  const [draft, setDraft] = React.useState<CrmCustomizations>(customizations);
  const [activeCategory, setActiveCategory] = React.useState<"geral" | "atendimento" | "portfolio">("atendimento");
  const [savedSignal, setSavedSignal] = React.useState(false);
  
  const [inputs, setInputs] = React.useState<Record<SectionKey, string>>({
    origins: "",
    leadCaptureMethods: "",
    owners: "",
  });
  const [courseInputs, setCourseInputs] = React.useState<Record<CourseSegmentKey, string>>({
    formacao: "",
    especializacao: "",
  });

  React.useEffect(() => {
    setDraft(customizations);
  }, [customizations]);

  React.useEffect(() => {
    if (success) {
      setSavedSignal(true);
      const t = setTimeout(() => setSavedSignal(false), 2000);
      return () => clearTimeout(t);
    }
  }, [success]);

  async function persistDraft(nextDraft: CrmCustomizations) {
    setDraft(nextDraft);
    await onSave(nextDraft);
  }

  async function addCourseItem(segment: CourseSegmentKey) {
    const value = courseInputs[segment].trim();
    if (!value) return;
    const nextDraft: CrmCustomizations = {
      ...draft,
      courseSegments: {
        ...draft.courseSegments,
        [segment]: Array.from(new Set([...draft.courseSegments[segment], value])),
      },
      courses: Array.from(
        new Set([
          ...draft.courseSegments.formacao,
          ...draft.courseSegments.especializacao,
          value,
        ]),
      ),
    };
    await persistDraft(nextDraft);
    setCourseInputs((current) => ({ ...current, [segment]: "" }));
  }

  async function addItem(key: SectionKey) {
    const value = inputs[key].trim();
    if (!value) return;
    const nextDraft = {
      ...draft,
      [key]: Array.from(new Set([...draft[key], value])),
    };
    await persistDraft(nextDraft);
    setInputs((current) => ({ ...current, [key]: "" }));
  }

  async function removeItem(key: SectionKey | CourseSegmentKey, value: string, isCourse = false) {
    if (isCourse) {
      const segKey = key as CourseSegmentKey;
      const nextSegmentValues = draft.courseSegments[segKey].filter((course) => course !== value);
      const nextDraft: CrmCustomizations = {
        ...draft,
        courseSegments: {
          ...draft.courseSegments,
          [segKey]: nextSegmentValues,
        },
        courses: Array.from(
          new Set([
            ...(segKey === "formacao" ? nextSegmentValues : draft.courseSegments.formacao),
            ...(segKey === "especializacao" ? nextSegmentValues : draft.courseSegments.especializacao),
          ]),
        ),
      };
      await persistDraft(nextDraft);
    } else {
      const secKey = key as SectionKey;
      const nextDraft = {
        ...draft,
        [secKey]: draft[secKey].filter((item) => item !== value),
      };
      await persistDraft(nextDraft);
    }
  }

  function mergePendingInputs(currentDraft: CrmCustomizations, currentInputs: Record<SectionKey, string>): CrmCustomizations {
    const nextDraft = { ...currentDraft };
    for (const key of Object.keys(currentInputs) as SectionKey[]) {
      const pendingValue = currentInputs[key].trim();
      if (!pendingValue) continue;
      nextDraft[key] = Array.from(new Set([...nextDraft[key], pendingValue]));
    }
    return nextDraft;
  }

  function mergePendingCourseInputs(
    currentDraft: CrmCustomizations,
    currentInputs: Record<CourseSegmentKey, string>,
  ): CrmCustomizations {
    const nextDraft: CrmCustomizations = {
      ...currentDraft,
      courseSegments: {
        formacao: [...currentDraft.courseSegments.formacao],
        especializacao: [...currentDraft.courseSegments.especializacao],
      },
      courses: [...currentDraft.courses],
    };

    for (const key of Object.keys(currentInputs) as CourseSegmentKey[]) {
      const pendingValue = currentInputs[key].trim();
      if (!pendingValue) continue;
      nextDraft.courseSegments[key] = Array.from(new Set([...nextDraft.courseSegments[key], pendingValue]));
    }

    nextDraft.courses = Array.from(
      new Set([...nextDraft.courseSegments.formacao, ...nextDraft.courseSegments.especializacao]),
    );

    return nextDraft;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextDraft = mergePendingCourseInputs(mergePendingInputs(draft, inputs), courseInputs);
    setDraft(nextDraft);
    setInputs({ origins: "", leadCaptureMethods: "", owners: "" });
    setCourseInputs({ formacao: "", especializacao: "" });
    await onSave(nextDraft);
  }

  const renderInputForm = (
    title: string,
    description: string,
    value: string,
    onChange: (val: string) => void,
    onAdd: () => void,
    placeholder: string,
    items: string[],
    onRemove: (item: string) => void,
    isRemovable: (item: string) => boolean = () => true
  ) => (
    <Card className="rounded-[32px] overflow-hidden mb-6">
      <CardHeader className="border-b border-white/5 bg-white/[0.01] px-8 py-6">
        <CardTitle className="text-lg font-light tracking-wide text-white">{title}</CardTitle>
        <CardDescription className="text-white/40">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-8">
        <div className="relative max-w-xl">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
            placeholder={placeholder}
            className="h-14 rounded-full border-white/10 bg-white/[0.02] pl-6 pr-32 text-[14px] text-white placeholder:text-white/30 focus-visible:ring-primary/40"
          />
          <Button 
            type="button" 
            onClick={onAdd}
            className="absolute right-2 top-2 h-10 rounded-full bg-white/5 hover:bg-primary hover:text-white text-white/50 border border-white/10 hover:border-primary hover:shadow-[0_0_20px_rgba(219,13,113,0.4)] px-4 transition-all duration-300"
          >
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
            {items.map((item) => (
              <span
                key={item}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[13px] font-medium text-white/80 transition-all hover:bg-white/[0.05]"
              >
                <Tag className="h-3 w-3 text-white/30 group-hover:text-primary transition-colors" />
                {item}
                {isRemovable(item) && (
                  <button
                    type="button"
                    onClick={() => onRemove(item)}
                    className="ml-1 -mr-2 grid h-6 w-6 place-items-center rounded-full bg-transparent text-white/30 transition-colors hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100 opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            ))}
            {items.length === 0 && (
              <span className="text-[13px] font-light text-white/30 italic">Nenhum item cadastrado.</span>
            )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <form className="mx-auto flex max-w-6xl flex-col lg:flex-row gap-8 py-8 h-full" onSubmit={handleSubmit}>
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-8">
        <div>
          <h2 className="text-2xl font-light tracking-wide text-white">Configurações</h2>
          <p className="mt-2 text-[13px] font-light text-white/40">
            Padronize a taxonomia de vendas do seu estúdio.
          </p>
        </div>

        <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 crm-scrollbar">
          {SETTINGS_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`group relative flex items-center gap-3 rounded-full lg:rounded-2xl px-5 py-3.5 text-left transition-all duration-300 whitespace-nowrap lg:whitespace-normal ${
                  isActive ? "text-primary" : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                {isActive && (
                  <div
                    className="absolute inset-0 z-0 rounded-full lg:rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_0_30px_-10px_rgba(255,255,255,0.1)] transition-all duration-300"
                  />
                )}
                <Icon className={`relative z-10 h-4 w-4 ${isActive ? "drop-shadow-[0_0_8px_rgba(219,13,113,0.5)]" : ""}`} />
                <span className={`relative z-10 text-[13px] font-medium tracking-wide ${isActive ? "text-white" : ""}`}>
                  {cat.label}
                </span>
                <ArrowRight className={`relative z-10 ml-auto h-3 w-3 transition-transform duration-300 ${isActive ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0 lg:block hidden"}`} />
              </button>
            );
          })}
        </nav>

        <div className="mt-auto hidden lg:block rounded-3xl border border-white/5 bg-white/[0.01] p-5">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Visão Geral</span>
          </div>
          <div className="space-y-2 text-[12px] font-light text-white/50">
            <div className="flex justify-between"><span>Cursos:</span> <span className="text-white">{draft.courses.length}</span></div>
            <div className="flex justify-between"><span>Origens:</span> <span className="text-white">{draft.origins.length}</span></div>
            <div className="flex justify-between"><span>Atendentes:</span> <span className="text-white">{draft.owners.length}</span></div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-8">
          <AnimatePresence mode="wait">
            <motion.h3 
              key={activeCategory}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="text-lg font-light tracking-[0.2em] uppercase text-white/50"
            >
              {SETTINGS_CATEGORIES.find(c => c.id === activeCategory)?.label}
            </motion.h3>
          </AnimatePresence>

          <Button 
            type="submit" 
            disabled={saving}
            className="rounded-full bg-primary px-6 h-10 shadow-[0_0_20px_rgba(219,13,113,0.3)] hover:shadow-[0_0_30px_rgba(219,13,113,0.6)] text-[12px] font-bold uppercase tracking-wider transition-all"
          >
            <AnimatePresence mode="wait">
              {savedSignal ? (
                <motion.div key="saved" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Salvo
                </motion.div>
              ) : (
                <motion.div key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </div>

        {error ? <p className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 px-6 py-4 text-[13px] text-destructive shadow-[0_0_30px_rgba(239,68,68,0.2)]">{error}</p> : null}

        <div className="relative min-h-[500px]">
          <AnimatePresence mode="wait">
            {activeCategory === "atendimento" && (
              <motion.div 
                key="atendimento"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderInputForm(
                  "Responsáveis de Atendimento", 
                  "Cadastre os consultores e vendedores que receberão leads.", 
                  inputs.owners, 
                  (val) => setInputs(c => ({...c, owners: val})), 
                  () => void addItem("owners"), 
                  "Ex: Juliana Costa", 
                  draft.owners, 
                  (item) => void removeItem("owners", item, false),
                  (item) => draft.owners.length > 1
                )}

                {renderInputForm(
                  "Métodos de Captação", 
                  "Padronize como o lead entrou no CRM (Whatsapp, Ligação, API).", 
                  inputs.leadCaptureMethods, 
                  (val) => setInputs(c => ({...c, leadCaptureMethods: val})), 
                  () => void addItem("leadCaptureMethods"), 
                  "Ex: Conversa WhatsApp", 
                  draft.leadCaptureMethods, 
                  (item) => void removeItem("leadCaptureMethods", item, false),
                  (item) => draft.leadCaptureMethods.length > 1
                )}
              </motion.div>
            )}

            {activeCategory === "geral" && (
              <motion.div 
                key="geral"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderInputForm(
                  "Origens Comerciais", 
                  "Controle os canais disponíveis para rastreamento (Instagram, Indicação).", 
                  inputs.origins, 
                  (val) => setInputs(c => ({...c, origins: val})), 
                  () => void addItem("origins"), 
                  "Ex: Instagram Ads", 
                  draft.origins, 
                  (item) => void removeItem("origins", item, false),
                  (item) => draft.origins.length > 1
                )}
              </motion.div>
            )}

            {activeCategory === "portfolio" && (
              <motion.div 
                key="portfolio"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderInputForm(
                  "Cursos de Formação", 
                  "Cursos de entrada e formações principais do portfólio.", 
                  courseInputs.formacao, 
                  (val) => setCourseInputs(c => ({...c, formacao: val})), 
                  () => void addCourseItem("formacao"), 
                  "Ex: Design de Sobrancelhas", 
                  draft.courseSegments.formacao, 
                  (item) => void removeItem("formacao", item, true)
                )}

                {renderInputForm(
                  "Cursos de Especialização", 
                  "Cursos avançados para leads mais qualificados.", 
                  courseInputs.especializacao, 
                  (val) => setCourseInputs(c => ({...c, especializacao: val})), 
                  () => void addCourseItem("especializacao"), 
                  "Ex: Especialização em Harmonização", 
                  draft.courseSegments.especializacao, 
                  (item) => void removeItem("especializacao", item, true)
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </form>
  );
}
