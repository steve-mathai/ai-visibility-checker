import Link from "next/link";
import { Container } from "@/components/Container";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { WhatWeCheck } from "@/components/landing/WhatWeCheck";

export default function Home() {
  return (
    <>
      <Hero />
      <WhatWeCheck />
      <HowItWorks />
      <section aria-labelledby="cta-title" className="py-16 sm:py-20">
        <Container className="text-center">
          <h2 id="cta-title" className="text-2xl font-semibold tracking-tight">
            Find out where your page stands
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-muted">
            It takes a few seconds and needs no account.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="#check" className="btn btn-primary">
              Check a page
            </Link>
            <Link href="/report?demo=1" className="btn btn-secondary">
              See a sample report
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
