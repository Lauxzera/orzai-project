"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  GripVertical,
  MessageCircle,
  PlayCircle,
  Rocket,
  ShieldCheck,
  Target,
} from "lucide-react";
import { motion, useScroll, useTransform, useSpring, Variants } from "framer-motion";
import { WHATSAPP_SALES_LINK } from "@/features/landing/lib/brand";
import { OrzaiLogo } from "@/features/landing/components/orzai-logo";
import { PublicSiteNav } from "@/features/landing/components/public-site-nav";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
};

const ScrollConnector = ({ segment }: { segment: "start" | "middle" | "end" }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start 85%", "end 35%"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 70, damping: 20, restDelta: 0.001 });
  const pathD =
    segment === "start"
      ? "M 50 0 C 50 70, 90 30, 90 100"
      : segment === "middle"
        ? "M 90 0 C 90 70, 10 30, 10 100"
        : "M 10 0 C 10 70, 50 30, 50 100";

  return (
    <div ref={containerRef} className="w-full flex justify-center items-center relative z-0 -my-6 overflow-hidden">
      <div className="w-full max-w-[600px] h-28 md:h-40 relative">
        <motion.svg viewBox="0 0 100 100" fill="none" preserveAspectRatio="none" className="w-full h-full opacity-30">
          <defs>
            <linearGradient id={`gradient-sales-${segment}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={pathD} stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
          <motion.path d={pathD} stroke={`url(#gradient-sales-${segment})`} strokeWidth="1" style={{ pathLength: smoothProgress }} />
        </motion.svg>
      </div>
    </div>
  );
};

export function SalesLandingPage() {
  const { scrollYProgress } = useScroll();
  const yBlob1 = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const yBlob2 = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);

  return (
    <div className="min-h-screen bg-[#080808] text-[#F5F2EE] font-sans selection:bg-primary/30 relative overflow-hidden dark">
      <PublicSiteNav currentPage="sales" />

      <main className="relative z-10">
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <motion.div
            style={{ y: yBlob1 }}
            className="absolute -top-[10%] -right-[5%] w-[60vw] h-[60vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(45,127,234,0.15)_0,transparent_60%)] blur-[100px] opacity-30"
          />
          <motion.div
            style={{ y: yBlob2 }}
            className="absolute -bottom-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(0,229,160,0.15)_0,transparent_60%)] blur-[120px] opacity-20"
          />
        </div>

        {/* Hero */}
        <section id="hero" className="relative pt-[25vh] pb-[15vh] px-6 lg:px-12 flex flex-col items-center text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="max-w-[1000px] w-full flex flex-col items-center"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-2 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary">CRM feito para vender</span>
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl lg:text-[84px] font-light tracking-[-0.04em] leading-[0.95] text-white">
              O CRM que sua equipe <br className="hidden md:block" />
              <span className="text-primary italic font-light">de vendas usa de verdade.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-8 text-lg md:text-xl font-light text-white/60 max-w-2xl leading-[1.6]">
              Funil visual, priorização automática de quem tem mais chance de fechar e agendamento por IA direto no WhatsApp — pra sua equipe vender mais sem virar refém de planilha.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-12 flex flex-col sm:flex-row items-center gap-4">
              <Link
                href="/demo"
                className="group relative inline-flex items-center gap-4 rounded-full bg-white px-8 h-14 text-sm font-bold tracking-[0.05em] uppercase text-[#080808] transition-transform hover:scale-105"
              >
                <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-primary animate-button-wave" />
                <div className="pointer-events-none absolute inset-0 rounded-full border border-primary animate-button-wave-delayed" />
                <PlayCircle className="relative z-10 h-4 w-4" />
                <span className="relative z-10">Testar demonstração</span>
              </Link>
              <a
                href={WHATSAPP_SALES_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3 rounded-full border border-white/15 px-8 h-14 text-sm font-bold tracking-[0.05em] uppercase text-white/80 transition-colors hover:text-white hover:border-white/30"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Falar com vendas</span>
              </a>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-8 flex items-center gap-2 text-[11px] text-white/30">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Dados de leads e conversas tratados conforme a LGPD.</span>
            </motion.div>
          </motion.div>
        </section>

        <ScrollConnector segment="start" />

        {/* Manifesto */}
        <section className="py-24 px-6 lg:px-12 border-t border-white/5 bg-white/[0.02]">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="max-w-5xl mx-auto"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-2 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-blue-500">Por que vendedor abandona CRM</span>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-light tracking-tight leading-[1.2] text-white max-w-3xl">
              A maioria dos CRMs pede pro vendedor sair do WhatsApp pra registrar o que já aconteceu no WhatsApp.{" "}
              <strong className="font-normal text-primary">O Orzai vive dentro da conversa — ninguém precisa preencher nada duas vezes.</strong>
            </motion.h2>
          </motion.div>
        </section>

        <ScrollConnector segment="middle" />

        {/* Diferenciais */}
        <section id="diferenciais" className="py-32 px-6 lg:px-12 relative">
          <div className="max-w-[1400px] mx-auto">
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-16 max-w-2xl">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary">Diferenciais</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-light tracking-tight leading-[1.2] text-white">
                Tudo que uma equipe de vendas precisa, num único lugar.
              </h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              <FeatureCard
                icon={GripVertical}
                title="Funil visual, arraste e feche"
                enLabel="01 // PIPELINE"
                description="Veja de relance quem está esperando resposta, quem já negocia e quem já fechou — arraste cada lead pra próxima etapa em segundos, sem planilha."
              />
              <FeatureCard
                icon={Target}
                title="Priorize quem tem mais chance de fechar"
                enLabel="02 // SCORE PREDITIVO"
                description="Cada lead recebe uma pontuação automática com base no histórico de interação — sua equipe sabe exatamente em quem focar primeiro."
              />
              <FeatureCard
                icon={CalendarClock}
                title="Agendamento Inteligente"
                enLabel="03 // IA NA AGENDA"
                description="A IA consulta a agenda, marca o horário e envia lembrete automático pro cliente — reduz falta sem seu time perder tempo indo atrás de confirmação."
                highlight
              />
              <FeatureCard
                icon={MessageCircle}
                title="Todo atendimento em um só lugar"
                enLabel="04 // INBOX"
                description="WhatsApp da equipe direto no funil: mensagens, áudios e histórico ficam junto da ficha do lead, sem trocar de tela nem perder contexto."
              />
              <FeatureCard
                icon={Rocket}
                title="Dispare campanhas sem levar bloqueio"
                enLabel="05 // DISPAROS"
                description="Integração oficial com a Meta Cloud API, respeitando janela de atendimento e templates aprovados — escale sem colocar o número em risco."
              />
              <FeatureCard
                icon={BarChart3}
                title="Enxergue onde o funil trava"
                enLabel="06 // ANALYTICS"
                description="Tempo de resposta por vendedor, motivo de lead parado e taxa de conversão por etapa — decisão com dado, não com achismo."
              />
            </motion.div>
          </div>
        </section>

        <ScrollConnector segment="end" />

        {/* Benefícios */}
        <section className="py-32 px-6 lg:px-12 relative border-t border-white/5">
          <div className="max-w-5xl mx-auto">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer}>
              <motion.div variants={fadeUp} className="flex items-center gap-2 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary">No dia a dia da equipe</span>
              </motion.div>
              <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-light tracking-tight leading-[1.2] text-white max-w-2xl mb-12">
                O que muda pra quem vende todo dia.
              </motion.h2>

              <motion.div variants={fadeUp} className="grid sm:grid-cols-2 gap-6">
                <BenefitItem
                  title="Menos lead esquecido"
                  description="Todo contato que chega pelo WhatsApp cai direto no funil — nenhum lead fica perdido numa conversa antiga ou num caderno de anotações."
                />
                <BenefitItem
                  title="Resposta mais rápida"
                  description="Inbox unificado com a ficha do lead ao lado — sua equipe responde sem procurar histórico em outro app."
                />
                <BenefitItem
                  title="Menos trabalho manual de agenda"
                  description="A IA cuida de consultar disponibilidade, marcar e lembrar o cliente — o vendedor foca em vender, não em gerenciar calendário."
                />
                <BenefitItem
                  title="Gestão com visibilidade real"
                  description="O gestor enxerga, por vendedor e por etapa, onde o funil trava — sem precisar pedir relatório manual pra ninguém."
                />
              </motion.div>
            </motion.div>
          </div>
        </section>

        <ScrollConnector segment="end" />

        {/* CTA final */}
        <section id="proposta" className="py-40 px-6 lg:px-12 text-center relative border-t border-white/5 bg-gradient-to-t from-primary/5 to-transparent">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="max-w-3xl mx-auto flex flex-col items-center"
          >
            <motion.h2 variants={fadeUp} className="text-4xl md:text-6xl font-light tracking-tighter mb-4 text-white">
              Pronto pra sua equipe vender mais?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/50 font-light mb-10 max-w-lg">
              Teste a demonstração agora ou fale com a gente pra ver o que o Orzai resolve pro seu time de vendas.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4">
              <Link
                href="/demo"
                className="group relative flex h-16 items-center gap-4 rounded-full bg-primary px-10 text-sm font-bold tracking-[0.1em] uppercase text-white shadow-[0_0_40px_-10px_rgba(45,127,234,0.5)] transition hover:scale-105"
              >
                <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-primary animate-button-wave" />
                <div className="pointer-events-none absolute inset-0 rounded-full border border-primary animate-button-wave-delayed" />
                <span className="relative z-10">Testar demonstração</span>
                <ArrowRight className="relative z-10 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href={WHATSAPP_SALES_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-16 items-center gap-3 rounded-full border border-white/15 px-10 text-sm font-bold tracking-[0.1em] uppercase text-white/80 transition-colors hover:text-white hover:border-white/30"
              >
                <MessageCircle className="h-5 w-5" />
                <span>Falar com vendas</span>
              </a>
            </motion.div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#080808] py-12 px-6 lg:px-12 relative z-10">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <OrzaiLogo className="h-10 w-10 text-primary" />
            <span className="font-bold tracking-tight text-xl text-white/90">Orzai</span>
          </div>
          <div className="flex flex-col items-center md:items-end gap-2">
            <p className="text-[11px] uppercase tracking-[0.1em] text-white/30">
              © {new Date().getFullYear()} Orzai. Todos os direitos reservados.
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-white/25">
              <ShieldCheck className="h-3 w-3" />
              Dados tratados conforme a LGPD.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FeatureCard({
  icon: Icon,
  title,
  description,
  enLabel,
  highlight = false,
}: {
  icon: any;
  title: string;
  description: string;
  enLabel: string;
  highlight?: boolean;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-[20px] border p-8 transition-all duration-500 hover:-translate-y-2 min-h-[300px] ${
        highlight
          ? "bg-primary/[0.06] border-primary/30 hover:border-primary/50 hover:shadow-[0_0_50px_-15px_rgba(45,127,234,0.4)]"
          : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-primary/30 hover:shadow-[0_0_40px_-15px_rgba(45,127,234,0.3)]"
      }`}
    >
      {highlight ? (
        <span className="absolute right-6 top-6 rounded-full bg-primary/15 px-2.5 py-1 text-[9px] font-bold tracking-[0.15em] uppercase text-primary">
          Exclusivo
        </span>
      ) : null}
      <div>
        <div className="mb-8 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-white/40 transition-colors duration-500 group-hover:bg-primary/20 group-hover:text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="mb-4 text-xl font-light tracking-tight text-white">{title}</h3>
        <p className="text-sm font-light leading-relaxed text-white/50">{description}</p>
      </div>

      <div className="mt-8 flex items-end justify-between">
        <span className="text-[10px] font-bold tracking-[0.2em] text-white/20">{enLabel}</span>
      </div>
    </motion.div>
  );
}

function BenefitItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[20px] border border-white/5 bg-white/[0.02] p-6">
      <h3 className="mb-2 text-lg font-light text-white">{title}</h3>
      <p className="text-sm font-light leading-relaxed text-white/50">{description}</p>
    </div>
  );
}
