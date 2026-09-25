"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { content } from "@/data/content";

gsap.registerPlugin(ScrollTrigger);

export default function HeroSection() {
  const sectionRef  = useRef<HTMLElement>(null);
  const angelRef    = useRef<HTMLImageElement>(null);
  const wordsRef    = useRef<(HTMLSpanElement | null)[]>([]);
  const brandRef    = useRef<HTMLHeadingElement>(null);
  const metaBlRef   = useRef<HTMLDivElement>(null);
  const mouseTarget  = useRef({ x: 0, y: 0 });
  const mouseCurrent = useRef({ x: 0, y: 0 });
  const raf          = useRef<number>(0);

  /* ── Intro Animation ── */
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

    // Angel: scale in
    tl.fromTo(
      angelRef.current,
      { scale: 0.88, opacity: 0, y: 30 },
      { scale: 1, opacity: 1, y: 0, duration: 1.6, delay: 0.4 }
    );

    // Brand name: clip-path reveal
    tl.fromTo(
      brandRef.current,
      { clipPath: "inset(0 100% 0 0)", opacity: 0 },
      { clipPath: "inset(0 0% 0 0)", opacity: 1, duration: 1.0, ease: "power3.inOut" },
      "-=1.2"
    );

    // Headline words: slide up
    wordsRef.current.forEach((word, i) => {
      tl.fromTo(
        word,
        { y: "110%", opacity: 0 },
        { y: "0%", opacity: 1, duration: 1.0, ease: "power3.out" },
        i === 0 ? "-=0.7" : "-=0.75"
      );
    });

    // Tagline + meta fade in
    tl.fromTo(
      metaBlRef.current,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.6 },
      "-=0.4"
    );
  }, []);

  /* ── Mouse-Follow Parallax with Idle Float ── */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseTarget.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      };
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    let t = 0;
    const loop = () => {
      t += 0.008;
      const idleX = Math.sin(t) * 0.04;
      const idleY = Math.cos(t * 0.7) * 0.03;

      mouseCurrent.current.x += (mouseTarget.current.x - mouseCurrent.current.x) * 0.04;
      mouseCurrent.current.y += (mouseTarget.current.y - mouseCurrent.current.y) * 0.04;

      const x  = (mouseCurrent.current.x + idleX) * 18;
      const y  = (mouseCurrent.current.y + idleY) * 10;
      const rx = (mouseCurrent.current.y + idleY) * 3;
      const ry = (mouseCurrent.current.x + idleX) * 2;

      if (angelRef.current) {
        angelRef.current.style.transform = `
          translate(${x * 0.4}px, ${y * 0.25}px)
          rotateX(${rx}deg) rotateY(${ry}deg)
        `;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf.current);
      else raf.current = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  /* ── Scroll-driven angel parallax ── */
  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(angelRef.current, {
        y: "-12vh",
        scale: 1.04,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "80% top",
          scrub: 0.6,
        },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="hero section">
      <div className="hero-sticky">

        {/* Angel sculpture */}
        <div className="angel-wrap">
          <Image
            ref={angelRef}
            src="/angel.jpg"
            alt="OBSIDIAN — sculptural angel"
            width={900}
            height={1350}
            priority
            loading="eager"
            className="angel-img"
            style={{ opacity: 0 }}
            data-cursor="angel"
          />
        </div>

        {/* ── Left column: Brand + headline + CTA ── */}
        <div className="hero-type-wrap" style={{ zIndex: 3 }}>

          {/* OBSIDIAN — large bold brand name */}
          <h1
            ref={brandRef}
            className="hero-brand-name"
            style={{ opacity: 0, clipPath: "inset(0 100% 0 0)" }}
          >
            {content.brand}
          </h1>

          {/* Subtitle headline words */}
          <div className="hero-headline-wrap">
            {content.hero.headline.map((word, i) => (
              <span key={word} className="hero-line">
                <span
                  ref={(el) => { wordsRef.current[i] = el; }}
                  className="t-hero hero-word"
                  style={{ opacity: 0 }}
                >
                  {word}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Bottom-left scroll indicator */}
        <div ref={metaBlRef} className="hero-meta-bl" style={{ opacity: 0 }}>
          <div className="scroll-indicator">
            <span className="t-label" style={{ fontSize: 10 }}>
              {content.hero.scrollLabel}
            </span>
            <div className="scroll-line" />
          </div>
        </div>
      </div>
    </section>
  );
}
