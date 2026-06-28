import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });

export const metadata: Metadata = {
  title: "CRM Base CRM",
  description: "CRM comercial para gestão de leads, funil, tarefas e matrículas do Base CRM.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${outfit.variable}`}>
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
