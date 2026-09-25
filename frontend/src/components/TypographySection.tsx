"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { content } from "@/data/content";

gsap.registerPlugin(ScrollTrigger);

export default function TypographySection() {
  const sectionRef   = useRef<HTMLDivElement>(null);
  const linesRef     = useRef<(HTMLSpanElement | null)[]>([]);
  const labelRef     = useRef<HTMLSpanElement>(null);
  const taglineRef   = useRef<HTMLDivElement>(null);
  const subRef       = useRef<HTMLParagraphElement>(null);
  const dividerRef   = useRef<HTMLDivElement>(null);
  const leftColRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {

      // Left column slides in
      gsap.fromTo(leftColRef.current,
        { opacity: 0, x: -40 },
        {
          opacity: 1, x: 0, duration: 1.2, ease: "power4.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 65%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Divider grows
      gsap.fromTo(dividerRef.current,
        { scaleY: 0, transformOrigin: "top center" },
        {
          scaleY: 1, duration: 1.4, ease: "power4.out", delay: 0.2,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 65%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Headline lines: cascade reveal
      linesRef.current.forEach((line, i) => {
        gsap.fromTo(line,
          { y: "110%", opacity: 0 },
          {
            y: "0%", opacity: 1,
            duration: 1.1,
            ease: "power4.out",
            delay: 0.15 + i * 0.15,
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 65%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // Parallax on ghost angel
      gsap.fromTo(".vision-angel-img",
        { y: "8%" },
        {
          y: "-8%",
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 2,
          },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={sectionRef} className="vision section">

      {/* Ghost angel — full bleed background */}
      <div className="vision-angel-bg" aria-hidden="true">
        <Image
          src="/angel.jpg"
          alt=""
          width={700}
          height={1000}
          className="vision-angel-img"
        />
      </div>

      {/* Gold horizontal rule at top */}
      <div className="vision-top-rule" aria-hidden="true" />

      {/* Main editorial grid */}
      <div className="vision-grid">

        {/* ── Left column: label + description ── */}
        <div className="vision-left" ref={leftColRef} style={{ opacity: 0 }}>

          {/* Section label */}
          <span ref={labelRef} className="vision-section-label t-label">
            {content.vision.label}
          </span>

          {/* Decorative gold rule */}
          <div className="vision-gold-rule" />

          {/* Sub description */}
          <p ref={subRef} className="vision-description t-body">
            {content.vision.sub}
          </p>

          {/* Bottom badge */}
          <div ref={taglineRef} className="vision-badge">
            <span className="vision-badge-dot" aria-hidden="true" />
            <span className="vision-badge-text t-label">Digital · Commerce · Platform</span>
          </div>
        </div>

        {/* ── Vertical divider ── */}
        <div className="vision-divider" ref={dividerRef} aria-hidden="true" />

        {/* ── Right column: giant headline ── */}
        <div className="vision-type">
          {content.vision.headline.map((word, i) => (
            <span key={i} className="vision-line-wrap">
              <span
                ref={(el) => { linesRef.current[i] = el; }}
                className="vision-headline-word"
                style={{ display: "block", opacity: 0 }}
              >
                {word}
              </span>
            </span>
          ))}
          {/* Decorative italic accent below headline */}
          <p className="vision-headline-accent">— est. 2025</p>
        </div>

      </div>

      {/* Bottom rule */}
      <div className="vision-bottom-rule" aria-hidden="true" />
    </div>
  );
}
