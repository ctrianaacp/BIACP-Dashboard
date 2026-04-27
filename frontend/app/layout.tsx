import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "BIACP – Plataforma BI Industria Petróleo y Gas",
  description: "Dashboard de indicadores clave para la industria de Petróleo y Gas en Colombia. Producción, inversión, regalías, bloqueos y más.",
  keywords: "petróleo, gas, Colombia, ACP, dashboard, indicadores, producción, regalías",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
