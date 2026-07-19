import type { Metadata } from "next";
import { Inter, Cinzel, JetBrains_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { getNavUser } from "@/lib/auth/nav-user";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  weight: ["500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Forgotten Letters — Trench Crusade Scenario Repository",
    template: "%s · Forgotten Letters",
  },
  description:
    "Community-driven scenario repository for wargame scenario generation and sharing, starting with Trench Crusade.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Resolved server-side so the first paint already reflects the session
  // — a client-side fetch would flash "Log in" for every signed-in user.
  const user = await getNavUser();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${cinzel.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-dvh flex flex-col">
        <Navbar user={user} />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
