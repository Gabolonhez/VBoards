
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { ProjectProvider } from "@/context/project-context";
import { LanguageProvider } from "@/context/language-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FlowOS",
  description: "Kanban and version control for your team & apps",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground flex h-screen overflow-hidden`} suppressHydrationWarning>
        <LanguageProvider>
          <ProjectProvider>
            <Sidebar />
            <main className="flex-1 overflow-auto bg-background">
              {children}
            </main>
            <Toaster />
          </ProjectProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
