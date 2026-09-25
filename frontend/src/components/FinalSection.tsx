"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import { content } from "@/data/content";

gsap.registerPlugin(ScrollTrigger);

export default function FinalSection() {
  const sectionRef  = useRef<HTMLElement>(null);
  const linesRef    = useRef<(HTMLSpanElement | null)[]>([]);
  const ctaRef      = useRef<HTMLDivElement>(null);
  const roadmapRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      linesRef.current.forEach((line, i) => {
        gsap.fromTo(line,
          { y: "100%", opacity: 0 },
          {
            y: "0%", opacity: 1,
            duration: 1.2, ease: "power4.out",
            delay: i * 0.16,
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 70%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      gsap.fromTo([ctaRef.current, roadmapRef.current],
        { opacity: 0, y: 24 },
        {
          opacity: 1, y: 0, duration: 0.8, stagger: 0.2, delay: 0.55,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="final section">
      {/* Ghost angel */}
      <div className="final-angel-bg">
        <Image
          src="/angel.jpg"
          alt=""
          width={700}
          height={1050}
          className="final-angel-img"
          aria-hidden="true"
        />
      </div>

      <div className="final-content">
        {/* Headline */}
        <div className="final-type">
          {content.final.headline.map((word, i) => (
            <span key={i} className="final-line-wrap">
              <span
                ref={(el) => { linesRef.current[i] = el; }}
                className="t-hero final-word"
                style={{ display: "block", opacity: 0 }}
              >
                {word}
              </span>
            </span>
          ))}
        </div>

        {/* CTA */}
        <div ref={ctaRef} className="final-cta-wrap" style={{ opacity: 0 }}>
          <span className="t-label final-sub" style={{ color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>
            {content.final.label}
          </span>
          <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/p2" className="btn-primary" data-cursor="link">
              {content.final.cta}
            </Link>
          </div>
          <p className="t-label final-sub">{content.final.sub}</p>
        </div>

        {/* Roadmap */}
        <div ref={roadmapRef} className="final-roadmap" style={{ opacity: 0 }}>
          {content.final.roadmap.map((r) => (
            <div key={r.phase} className={`roadmap-card ${r.label === "active" ? "roadmap-active" : ""}`}>
              <span className="roadmap-phase t-label">{r.phase}</span>
              <p className="roadmap-title">{r.title}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
