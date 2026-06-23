import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import OneLiner from "@/components/landing/OneLiner";
import Problem from "@/components/landing/Problem";
import Solution from "@/components/landing/Solution";
import UserFlow from "@/components/landing/UserFlow";
import DemoScenario from "@/components/landing/DemoScenario";
import Features from "@/components/landing/Features";
import WhyCanton from "@/components/landing/WhyCanton";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "TamaFlow | Local AI Auto-Payroll on Canton",
  description:
    "Privacy-first payroll that nets cross-border obligations and settles them confidentially on Canton — without ever leaking data to a third-party LLM.",
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <OneLiner />
      <Problem />
      <Solution />
      <UserFlow />
      <DemoScenario />
      <Features />
      <WhyCanton />
      <CTA />
      <Footer />
    </main>
  );
}
