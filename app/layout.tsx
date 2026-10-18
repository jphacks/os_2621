import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { FlowGuard } from "@/components/flow-guard";
import { FlowNoticeBanner } from "@/components/flow-notice-banner";
import { FlowStepIndicator } from "@/components/flow-step-indicator";

export const metadata: Metadata = {
  title: "ひだまり — AIと対話し、同じ悩みを持つ仲間と安全につながる場所",
  description:
    "気力ゼロでも、AIのエスコートで同じ痛みを分かち合える仲間と安全に繋がれる匿名Webアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="min-h-screen flex flex-col overflow-x-hidden">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          <FlowNoticeBanner />
          <FlowStepIndicator />
          <FlowGuard>{children}</FlowGuard>
        </main>
      </body>
    </html>
  );
}
