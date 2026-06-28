"use client";

import * as React from "react";
import { ShieldCheck, MessageCircle, BarChart3, GripVertical, Rocket, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, useScroll, useTransform, Variants } from "framer-motion";

type Props = {
  onEnterCrm: () => void;
};

// Configurações padrão de animação
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
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

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#F5F2EE] font-sans selection:bg-primary/30 relative overflow-hidden dark">
      {/* Background Blobs Animados (Estilo VM2) */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }} 
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -right-[5%] w-[60vw] h-[60vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(219,13,113,0.15)_0,transparent_60%)] blur-[100px]"
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }} 
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute -bottom-[10%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(40,128,210,0.15)_0,transparent_60%)] blur-[120px]"
        />
      </div>

      {/* Navbar com reveal no scroll */}
      <motion.nav 
        style={{ opacity: opacityNav, backdropFilter: "blur(12px)" }}
        className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#080808]/80"
      >
        <div className="container mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => scrollTo("hero")}>
            <div className="grid h-8 w-8 place-items-center rounded bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-[0.1em] text-xs uppercase text-white/90">Base CRM</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[11px] font-semibold tracking-[0.15em] uppercase text-white/50">
            <button onClick={() => scrollTo("proposta")} className="hover:text-white transition-colors duration-300">Proposta</button>
            <button onClick={() => scrollTo("diferenciais")} className="hover:text-white transition-colors duration-300">Plataforma</button>
          </div>
          <div>
            <Button onClick={onEnterCrm} className="rounded px-6 h-10 text-xs font-bold tracking-[0.1em] uppercase transition-transform hover:scale-105 active:scale-95 bg-primary text-primary-foreground shadow-[0_0_20px_-5px_rgba(219,13,113,0.4)] hover:shadow-[0_0_30px_-5px_rgba(219,13,113,0.6)]">
              Acessar
            </Button>
          </div>
        </div>
      </motion.nav>

      <main className="relative z-10">
        {/* Hero Section */}
        <section id="hero" className="relative pt-[25vh] pb-[15vh] px-6 lg:px-12 flex flex-col items-center text-center">
          <motion.div 
            initial="hidden" animate="visible" variants={staggerContainer}
            className="max-w-[1000px] w-full flex flex-col items-center"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-2 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary">Plataforma Exclusiva</span>
            </motion.div>
            
            <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl lg:text-[90px] font-light tracking-[-0.04em] leading-[0.95] text-white">
              Gestão comercial, <br className="hidden md:block" />
              <span className="text-primary italic font-light">redesenhada.</span>
            </motion.h1>
            
            <motion.p variants={fadeUp} className="mt-8 text-lg md:text-xl font-light text-white/60 max-w-2xl leading-[1.6]">
              A inteligência do Base CRM aliada à mais avançada engenharia de software. Fluxos fluídos, disparos seguros e analytics em tempo real.
            </motion.p>
            
            <motion.div variants={fadeUp} className="mt-12 flex flex-col sm:flex-row items-center gap-4">
              <button onClick={onEnterCrm} className="group relative inline-flex items-center gap-4 rounded-full bg-white px-8 h-14 text-sm font-bold tracking-[0.05em] uppercase text-[#080808] transition-transform hover:scale-105">
                Iniciar sessão
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
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
              Nós removemos a fricção do atendimento para que a sua equipe foque apenas no que importa: <strong className="font-normal text-primary">relacionamento e fechamento.</strong>
            </motion.h2>
          </motion.div>
        </section>

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
                title="Pipeline Visual"
                enLabel="01 // KANBAN"
                description="Controle a jornada inteira. Arraste as oportunidades de estágio em estágio com total visibilidade."
              />
              <FeatureCard
                icon={MessageCircle}
                title="Atendimento"
                enLabel="02 // INBOX"
                description="WhatsApp nativo. Todas as mensagens, áudios e interações atreladas diretamente à ficha do lead."
              />
              <FeatureCard
                icon={Rocket}
                title="Disparos Oficiais"
                enLabel="03 // BROADCAST"
                description="Integração Meta Cloud API. Evite bloqueios e escale suas campanhas de forma separada da operação diária."
              />
              <FeatureCard
                icon={BarChart3}
                title="Analytics"
                enLabel="04 // INSIGHTS"
                description="Visão macro e micro. Descubra os gargalos do funil e o tempo de resposta exato da sua equipe."
              />
            </motion.div>
          </div>
        </section>

        {/* Call to Action Final */}
        <section id="proposta" className="py-40 px-6 lg:px-12 text-center relative border-t border-white/5 bg-gradient-to-t from-primary/5 to-transparent">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={staggerContainer}
            className="max-w-3xl mx-auto flex flex-col items-center"
          >
            <motion.h2 variants={fadeUp} className="text-4xl md:text-6xl font-light tracking-tighter mb-10 text-white">
              Pronto para evoluir?
            </motion.h2>
            <motion.button 
              variants={fadeUp}
              onClick={onEnterCrm} 
              className="group flex h-16 items-center gap-4 rounded-full bg-primary px-10 text-sm font-bold tracking-[0.1em] uppercase text-white shadow-[0_0_40px_-10px_rgba(219,13,113,0.5)] transition hover:scale-105"
            >
              Acessar a Plataforma
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </motion.button>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#080808] py-12 px-6 lg:px-12 relative z-10">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-[0.1em] text-xs uppercase text-white/70">Base CRM</span>
          </div>
          <p className="text-[11px] uppercase tracking-[0.1em] text-white/30">
            © {new Date().getFullYear()} CRM Proprietário. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FeatureCard({ icon: Icon, title, description, enLabel }: { icon: any, title: string, description: string, enLabel: string }) {
  return (
    <motion.div 
      variants={fadeUp}
      className="group relative flex flex-col justify-between overflow-hidden rounded-[20px] bg-white/[0.02] border border-white/5 p-8 transition-all duration-500 hover:-translate-y-2 hover:bg-white/[0.04] hover:border-primary/30 hover:shadow-[0_0_40px_-15px_rgba(219,13,113,0.3)] min-h-[340px]"
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
        <ArrowRight className="h-5 w-5 text-primary opacity-0 -translate-x-4 transition-all duration-500 group-hover:opacity-100 group-hover:translate-x-0" />
      </div>
    </motion.div>
  );
}
