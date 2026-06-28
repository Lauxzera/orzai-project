import { describe, expect, it } from "vitest";
import { buildTemplateParams, renderCampaignFreeText, sanitizeTemplateVariableKeys } from "@/lib/server/message-campaign-template";
import type { Lead } from "@/lib/crm";

const lead = {
  id: "lead-mariana",
  nome: "Mariana Alves",
  telefone: "11999999999",
  whatsapp: "",
  email: "",
  curso_de_interesse: "Design de Sobrancelhas",
  origem: "Instagram",
  origem_detalhe: "",
  captado_via: "",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_term: "",
  utm_content: "",
  tracking_referrer: "",
  tracking_landing_page: "",
  tracking_id: "",
  status_funil: "Novo Lead",
  status_matricula: "Não iniciado",
  responsavel: "Ana",
  data_entrada: "",
  proximo_contato: "",
  objecao_principal: "",
  observacoes: "",
  ja_foi_aluno: "Não",
  cidade: "Sao Paulo",
  profissao: "Esteticista",
  predictive_score: null,
  predictive_score_confidence: "",
  predictive_score_reasons: [],
  predictive_score_risks: [],
  predictive_score_source: "",
  predictive_score_updated_at: "",
  history: [],
} satisfies Lead;

describe("sanitizeTemplateVariableKeys", () => {
  it("mantem apenas variaveis suportadas e sem duplicidade", () => {
    expect(sanitizeTemplateVariableKeys(["nome", "curso", "nome", "invalida"])).toEqual(["nome", "curso"]);
  });
});

describe("buildTemplateParams", () => {
  it("monta parametros posicionais na ordem escolhida", () => {
    const result = buildTemplateParams(lead, ["nome", "curso", "responsavel"], {
      fallbackName: "Fallback",
      phone: "5511999999999",
    });

    expect(result.params).toEqual(["Mariana Alves", "Design de Sobrancelhas", "Ana"]);
    expect(result.snapshot).toEqual({
      "{{1}}:nome": "Mariana Alves",
      "{{2}}:curso": "Design de Sobrancelhas",
      "{{3}}:responsavel": "Ana",
    });
  });
});

describe("renderCampaignFreeText", () => {
  it("renderiza placeholders internos do CRM", () => {
    expect(renderCampaignFreeText("Oi {nome}, curso {curso}, funcao {profissao}, tel {telefone}", lead, "Fallback", "5511999999999")).toBe(
      "Oi Mariana Alves, curso Design de Sobrancelhas, funcao Esteticista, tel 5511999999999",
    );
  });
});
