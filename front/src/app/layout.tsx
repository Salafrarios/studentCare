import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/control/AuthContext";
import Header from "@/view/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StudentCare",
  description: "Sistema de monitoramento e apoio a estudantes neurodivergentes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AuthProvider>
          <Header />
          <main className="pt-16 min-h-screen">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
