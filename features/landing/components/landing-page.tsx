"use client";

import * as React from "react";
import Link from "next/link";
import { MessageCircle, BarChart3, GripVertical, Rocket, ArrowRight, ShieldCheck, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, useScroll, useTransform, useSpring, Variants } from "framer-motion";

const WHATSAPP_SALES_LINK = "https://wa.me/SEU_NUMERO_AQUI";

type Props = {
  onEnterCrm: () => void;
};

// Configurações padrão de animação
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
};

// Componente Logo Orzai
const OrzaiLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M60 36 A24 24 0 1 1 50.5 14.5" stroke="#2D7FEA" strokeWidth="5" strokeLinecap="round" fill="none" />
    <path d="M56 36 A20 20 0 1 1 47.5 18" stroke="#2D7FEA" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.25" />
    <circle cx="53" cy="13.5" r="5" fill="#00E5A0" />
    <circle cx="53" cy="13.5" r="2.5" fill="#0A0F1E" />
    <circle cx="53" cy="13.5" r="8" stroke="#00E5A0" strokeWidth="1" fill="none" opacity="0.3" />
    <circle cx="26" cy="28" r="2" fill="#2D7FEA" opacity="0.5" />
    <circle cx="36" cy="18" r="1.5" fill="#2D7FEA" opacity="0.35" />
  </svg>
);

// Componente de Conexão Modular (Segmentos do Grande S)
const ScrollConnector = ({ segment }: { segment: "start" | "middle" | "end" }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start 85%", "end 35%"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 70, damping: 20, restDelta: 0.001 });
  const pathD = segment === "start" ? "M 50 0 C 50 70, 90 30, 90 100" : segment === "middle" ? "M 90 0 C 90 70, 10 30, 10 100" : "M 10 0 C 10 70, 50 30, 50 100";
  
  return (
    <div ref={containerRef} className="w-full flex justify-center items-center relative z-0 -my-6 overflow-hidden">
      <div className="w-full max-w-[600px] h-28 md:h-40 relative">
        <motion.svg viewBox="0 0 100 100" fill="none" preserveAspectRatio="none" className="w-full h-full opacity-30">
          <defs>
            <linearGradient id={`gradient-${segment}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={pathD} stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
          <motion.path d={pathD} stroke={`url(#gradient-${segment})`} strokeWidth="1" style={{ pathLength: smoothProgress }} />
        </motion.svg>
      </div>
    </div>
  );
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

export function LandingPage({ onEnterCrm }: Props) {
  const { scrollYProgress } = useScroll();
  const yBg = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacityNav = useTransform(scrollYProgress, [0, 0.05], [0, 1]);
  const yBlob1 = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const yBlob2 = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#F5F2EE] font-sans selection:bg-primary/30 relative overflow-hidden dark">


      {/* Navbar com reveal no scroll */}
      <motion.nav 
        style={{ opacity: opacityNav, backdropFilter: "blur(12px)" }}
        className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#080808]/80"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-12 h-16 sm:h-20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group shrink-0" onClick={() => scrollTo("hero")}>
            <OrzaiLogo className="h-7 w-7 sm:h-8 sm:w-8 transition-transform group-hover:scale-105" />
            <span className="font-bold tracking-tight text-lg sm:text-xl text-white/90">Orzai</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[11px] font-semibold tracking-[0.15em] uppercase text-white/50">
            <button onClick={() => scrollTo("proposta")} className="hover:text-white transition-colors duration-300">Proposta</button>
            <button onClick={() => scrollTo("diferenciais")} className="hover:text-white transition-colors duration-300">Plataforma</button>
            <Link href="/demo" className="hover:text-white transition-colors duration-300">Demonstrações</Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={onEnterCrm} className="text-[10px] sm:text-[11px] font-semibold tracking-[0.1em] uppercase text-white/40 hover:text-white transition-colors shrink-0">
              Entrar
            </button>
            <Button asChild className="rounded px-3 sm:px-6 h-9 sm:h-10 text-[10px] sm:text-xs font-bold tracking-[0.05em] sm:tracking-[0.1em] uppercase transition-transform hover:scale-105 active:scale-95 bg-primary text-primary-foreground shadow-[0_0_20px_-5px_rgba(45,127,234,0.4)] hover:shadow-[0_0_30px_-5px_rgba(45,127,234,0.6)] shrink-0">
              <Link href="/demo">
                <span className="sm:hidden">Testar</span>
                <span className="hidden sm:inline">Testar demonstração</span>
              </Link>
            </Button>
          </div>
        </div>
      </motion.nav>

      <main className="relative z-10">
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <motion.div style={{ y: yBlob1 }} className="absolute -top-[10%] -right-[5%] w-[60vw] h-[60vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(45,127,234,0.15)_0,transparent_60%)] blur-[100px] opacity-30" />
          <motion.div style={{ y: yBlob2 }} className="absolute -bottom-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(0,229,160,0.15)_0,transparent_60%)] blur-[120px] opacity-20" />
        </div>

        {/* Hero Section */}
        <section id="hero" className="relative pt-[25vh] pb-[15vh] px-6 lg:px-12 flex flex-col items-center text-center">
          <motion.div 
            initial="hidden" animate="visible" variants={staggerContainer}
            className="max-w-[1000px] w-full flex flex-col items-center"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-2 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary">CRM com WhatsApp nativo</span>
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl lg:text-[90px] font-light tracking-[-0.04em] leading-[0.95] text-white">
              Pare de perder lead <br className="hidden md:block" />
              <span className="text-primary italic font-light">no WhatsApp.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-8 text-lg md:text-xl font-light text-white/60 max-w-2xl leading-[1.6]">
              A Orzai centraliza atendimento, funil de vendas e disparos oficiais em um só lugar — pra sua equipe responder mais rápido e nenhum contato se perder na correria.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-12 flex flex-col sm:flex-row items-center gap-4">
              <Link href="/demo" className="group relative inline-flex items-center gap-4 rounded-full bg-white px-8 h-14 text-sm font-bold tracking-[0.05em] uppercase text-[#080808] transition-transform hover:scale-105">
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
          
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          >
            <span className="text-[9px] tracking-[0.2em] uppercase text-white/30">Descubra</span>
            <div className="w-[1px] h-10 bg-gradient-to-b from-primary/50 to-transparent" />
          </motion.div>
        </section>

        <ScrollConnector segment="start" />

        {/* Separator / Manifesto */}
        <section className="py-24 px-6 lg:px-12 border-t border-white/5 bg-white/[0.02]">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="max-w-5xl mx-auto"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-2 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-blue-500">Nosso Método</span>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-light tracking-tight leading-[1.2] text-white max-w-3xl">
              Todo lead que chega pelo WhatsApp cai direto no funil — sem planilha, sem "esqueci de responder", sem depender de um caderno de anotações. <strong className="font-normal text-primary">Sua equipe foca em fechar.</strong>
            </motion.h2>
          </motion.div>
        </section>

        <ScrollConnector segment="middle" />

        {/* Diferenciais / Pillars */}
        <section id="diferenciais" className="py-32 px-6 lg:px-12 relative">
          <div className="max-w-[1400px] mx-auto">
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              <FeatureCard
                icon={GripVertical}
                title="Nunca mais perca o fio da conversa"
                enLabel="01 // PIPELINE"
                description="Veja de relance quem está esperando resposta, quem já negocia e quem já matriculou — e arraste cada lead pra próxima etapa em segundos."
              />
              <FeatureCard
                icon={MessageCircle}
                title="Todo atendimento em um só lugar"
                enLabel="02 // INBOX"
                description="WhatsApp da equipe direto no CRM: mensagens, áudios e histórico ficam junto da ficha do lead, sem trocar de tela."
              />
              <FeatureCard
                icon={Rocket}
                title="Dispare campanhas sem levar bloqueio"
                enLabel="03 // DISPAROS"
                description="Integração oficial com a Meta Cloud API, respeitando janela de atendimento e templates aprovados — escale sem colocar o número em risco."
              />
              <FeatureCard
                icon={BarChart3}
                title="Enxergue onde o funil trava"
                enLabel="04 // ANALYTICS"
                description="Tempo de resposta por atendente, motivo de leads parados e taxa de conversão real — decisão com dado, não com achismo."
              />
            </motion.div>
          </div>
        </section>

        <ScrollConnector segment="end" />

        {/* Demonstrações */}
        <section id="demonstracoes" className="py-32 px-6 lg:px-12 relative border-t border-white/5">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              <motion.div variants={fadeUp} className="flex items-center gap-2 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary">Demonstrações</span>
              </motion.div>
              <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-light tracking-tight leading-[1.2] text-white max-w-2xl mb-12">
                Veja o produto rodando antes de conversar com a gente.
              </motion.h2>

              <motion.div
                variants={fadeUp}
                className="group relative flex flex-col md:flex-row items-start md:items-center justify-between gap-8 overflow-hidden rounded-[24px] bg-white/[0.02] border border-white/5 p-8 md:p-10 transition-all duration-500 hover:bg-white/[0.04] hover:border-primary/30"
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-bold tracking-[0.2em] text-white/30">01 // PRODUTO</span>
                  <h3 className="mt-3 text-2xl font-light tracking-tight text-white">Base CRM</h3>
                  <p className="mt-3 max-w-xl text-sm font-light leading-relaxed text-white/50">
                    O CRM completo de atendimento via WhatsApp: funil de vendas, inbox unificado e analytics.
                    Explore uma versão com dados fictícios — sem precisar de login, sem compromisso.
                  </p>
                </div>
                <Link
                  href="/demo"
                  className="group/btn relative flex-none inline-flex items-center gap-3 rounded-full bg-primary px-7 h-14 text-sm font-bold tracking-[0.05em] uppercase text-white transition-transform hover:scale-105"
                >
                  <PlayCircle className="h-4 w-4" />
                  <span>Abrir demonstração</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                </Link>
              </motion.div>

              <motion.p variants={fadeUp} className="mt-6 text-xs text-white/25">
                Mais projetos da Orzai em breve nesta página.
              </motion.p>
            </motion.div>
          </div>
        </section>

        <ScrollConnector segment="end" />

        {/* Call to Action Final */}
        <section id="proposta" className="py-40 px-6 lg:px-12 text-center relative border-t border-white/5 bg-gradient-to-t from-primary/5 to-transparent">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={staggerContainer}
            className="max-w-3xl mx-auto flex flex-col items-center"
          >
            <motion.h2 variants={fadeUp} className="text-4xl md:text-6xl font-light tracking-tighter mb-4 text-white">
              Pronto para parar de perder lead?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/50 font-light mb-10 max-w-lg">
              Teste a demonstração agora ou fale com a gente pra ver o que a Orzai resolve pro seu negócio.
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
function AnimatedHoverIcon({ icon: Icon, className = "" }: { icon: any, className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <Icon className="absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-50 group-hover:opacity-0 group-hover:-rotate-12 w-full h-full text-white/40" />
      <Icon 
        className="absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] scale-50 opacity-0 rotate-12 group-hover:scale-110 group-hover:opacity-100 group-hover:rotate-0 w-full h-full text-[#00F0FF] drop-shadow-[0_0_12px_rgba(0,240,255,0.6)]" 
        strokeWidth={2.5}
      />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FeatureCard({ icon: Icon, title, description, enLabel }: { icon: any, title: string, description: string, enLabel: string }) {
  return (
    <motion.div 
      variants={fadeUp}
      className="group relative flex flex-col justify-between overflow-hidden rounded-[20px] bg-white/[0.02] border border-white/5 p-8 transition-all duration-500 hover:-translate-y-2 hover:bg-white/[0.04] hover:border-primary/30 hover:shadow-[0_0_40px_-15px_rgba(45,127,234,0.3)] min-h-[340px]"
    >
      <div>
        <div className="mb-8 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-white/40 transition-colors duration-500 group-hover:bg-primary/20 group-hover:text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="mb-4 text-2xl font-light tracking-tight text-white">{title}</h3>
        <p className="text-sm font-light leading-relaxed text-white/50">{description}</p>
      </div>
      
      <div className="mt-8 flex items-end justify-between">
        <span className="text-[10px] font-bold tracking-[0.2em] text-white/20">{enLabel}</span>
                <div className="relative ml-2 w-5 h-5 flex items-center justify-center">
                  <ArrowRight className="absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:translate-x-4 group-hover:scale-50 group-hover:opacity-0 w-full h-full text-[#050B14]" />
                  <ArrowRight 
                    className="absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] -translate-x-4 scale-50 opacity-0 group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100 w-full h-full text-[#0055FF]" 
                    strokeWidth={3}
                  />
                </div>
      </div>
    </motion.div>
  );
}
