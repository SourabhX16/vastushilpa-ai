import HeritageBackground from "@/components/heritage-background";
import Hero from "@/components/hero";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import WizardShell from "@/components/wizard-shell";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <HeritageBackground />
      <SiteHeader />
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 md:px-8">
        <Hero />
        <WizardShell />
      </main>
      <SiteFooter />
    </div>
  );
}
