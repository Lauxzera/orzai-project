"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { OrzaiLogo } from "@/features/landing/components/orzai-logo";
import { cn } from "@/lib/utils";

type Props = {
  /** Página atual — controla se as âncoras rolam na própria página ou navegam de volta pra home. */
  currentPage: "home" | "sales";
  /** Só é necessário (e só funciona) na home, onde o gate de login mora. */
  onEnterCrm?: () => void;
};

/**
 * Navbar compartilhado entre as páginas públicas de marketing (home, /crm-de-vendas, ...).
 * Único lugar que decide "qual botão leva a qual rota" — evita decidir isso página a página.
 */
export function PublicSiteNav({ currentPage, onEnterCrm }: Props) {
  const { scrollYProgress } = useScroll();
  const opacityNav = useTransform(scrollYProgress, [0, 0.05], [0, 1]);
  const isHome = currentPage === "home";

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <motion.nav
      style={isHome ? { opacity: opacityNav, backdropFilter: "blur(12px)" } : { backdropFilter: "blur(12px)" }}
      className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#080808]/80"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-12 h-16 sm:h-20 flex items-center justify-between gap-2">
        {isHome ? (
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group shrink-0" onClick={() => scrollTo("hero")}>
            <OrzaiLogo className="h-7 w-7 sm:h-8 sm:w-8 transition-transform group-hover:scale-105" />
            <span className="font-bold tracking-tight text-lg sm:text-xl text-white/90">Orzai</span>
          </div>
        ) : (
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
            <OrzaiLogo className="h-7 w-7 sm:h-8 sm:w-8 transition-transform group-hover:scale-105" />
            <span className="font-bold tracking-tight text-lg sm:text-xl text-white/90">Orzai</span>
          </Link>
        )}

        <div className="hidden md:flex items-center gap-8 text-[11px] font-semibold tracking-[0.15em] uppercase text-white/50">
          {isHome ? (
            <button onClick={() => scrollTo("proposta")} className="hover:text-white transition-colors duration-300">
              Proposta
            </button>
          ) : (
            <Link href="/#proposta" className="hover:text-white transition-colors duration-300">
              Proposta
            </Link>
          )}
          {isHome ? (
            <button onClick={() => scrollTo("diferenciais")} className="hover:text-white transition-colors duration-300">
              Plataforma
            </button>
          ) : (
            <Link href="/#diferenciais" className="hover:text-white transition-colors duration-300">
              Plataforma
            </Link>
          )}
          <Link
            href="/crm-de-vendas"
            className={cn(
              "hover:text-white transition-colors duration-300",
              currentPage === "sales" && "text-white",
            )}
          >
            Para equipes de vendas
          </Link>
          <Link href="/demo" className="hover:text-white transition-colors duration-300">
            Demonstrações
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {isHome ? (
            <button
              onClick={onEnterCrm}
              className="text-[10px] sm:text-[11px] font-semibold tracking-[0.1em] uppercase text-white/40 hover:text-white transition-colors shrink-0"
            >
              Entrar
            </button>
          ) : (
            <Link
              href="/"
              className="text-[10px] sm:text-[11px] font-semibold tracking-[0.1em] uppercase text-white/40 hover:text-white transition-colors shrink-0"
            >
              Entrar
            </Link>
          )}
          <Button
            asChild
            className="rounded px-3 sm:px-6 h-9 sm:h-10 text-[10px] sm:text-xs font-bold tracking-[0.05em] sm:tracking-[0.1em] uppercase transition-transform hover:scale-105 active:scale-95 bg-primary text-primary-foreground shadow-[0_0_20px_-5px_rgba(45,127,234,0.4)] hover:shadow-[0_0_30px_-5px_rgba(45,127,234,0.6)] shrink-0"
          >
            <Link href="/demo">
              <span className="sm:hidden">Testar</span>
              <span className="hidden sm:inline">Testar demonstração</span>
            </Link>
          </Button>
        </div>
      </div>
    </motion.nav>
  );
}
