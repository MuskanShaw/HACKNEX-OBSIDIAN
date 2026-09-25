"use client";

import SmoothScroll from "@/components/SmoothScroll";
import HeroSection from "@/components/HeroSection";
import dynamic from "next/dynamic";

const StorySection = dynamic(() => import("@/components/StorySection"), { ssr: false });
const TypographySection = dynamic(() => import("@/components/TypographySection"), { ssr: false });
const DetailSection = dynamic(() => import("@/components/DetailSection"), { ssr: false });
const FinalSection = dynamic(() => import("@/components/FinalSection"), { ssr: false });
const SiteFooter = dynamic(() => import("@/components/SiteFooter"), { ssr: false });

export default function Home() {
  return (
    <SmoothScroll>
      {/* ── Page content ── */}
      <main>
        {/* Section 1 — Hero (sticky scroll experience) */}
        <HeroSection />

        {/* Section 2 — Story */}
        <StorySection />

        {/* Section 3 — Giant typography overlapping angel */}
        <TypographySection />

        {/* Section 4 — Detail close-up */}
        <DetailSection />

        {/* Section 5 — Final CTA */}
        <FinalSection />
      </main>

      <SiteFooter />
    </SmoothScroll>
  );
}
