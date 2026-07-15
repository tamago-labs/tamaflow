import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import OneLiner from "@/components/landing/OneLiner";
import Problem from "@/components/landing/Problem";
import Features from "@/components/landing/Features";
import UserFlow from "@/components/landing/UserFlow";
import DemoScenario from "@/components/landing/DemoScenario";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "TamaFlow | AI Auto-Payroll for Global Teams",
  description:
    "Privacy-first AI auto-payroll for global teams — withholding tax, social security, and atomic settlement on Canton.",
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <OneLiner />
      <Problem />
      <Features />
      <UserFlow />
      <DemoScenario />
      <CTA />
      <Footer />
    </main>
  );
}