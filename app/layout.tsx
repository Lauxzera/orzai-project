import type { Metadata } from "next";
import { Inter, Outfit, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-outfit", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const spaceMono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-space-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Orzai - IA e Automação",
  description: "IA que trabalha. Automação de processos para PMEs.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${outfit.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`}>
      <head>
        {/* Aplica o tema antes do primeiro paint para evitar flash de light para dark */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=localStorage.getItem("orzai-project-theme");if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}})();',
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
