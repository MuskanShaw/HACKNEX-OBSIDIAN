"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { content } from "@/data/content";

gsap.registerPlugin(ScrollTrigger);

export default function DetailSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const labelRef   = useRef<HTMLSpanElement>(null);
  const titleRef   = useRef<HTMLHeadingElement>(null);
  const bodyRef    = useRef<HTMLParagraphElement>(null);
  const stepsRef   = useRef<HTMLDivElement>(null);
  const imageRef   = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 70%",
          toggleActions: "play none none reverse",
        },
      });

      tl.fromTo(imageRef.current,
        { opacity: 0, scale: 1.06, x: 30 },
        { opacity: 1, scale: 1, x: 0, duration: 1.4, ease: "power3.out" }
      )
      .fromTo(labelRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" },
        "-=0.9"
      )
      .fromTo(titleRef.current,
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" },
        "-=0.6"
      )
      .fromTo(bodyRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" },
        "-=0.5"
      )
      .fromTo(stepsRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" },
        "-=0.4"
      );

      // Slow zoom on scroll
      gsap.fromTo(imageRef.current,
        { scale: 1 },
        {
          scale: 1.08, ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 2.5,
          },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="detail section">
      <div className="detail-inner">

        {/* Text */}
        <div className="detail-text-col">
          <span ref={labelRef} className="t-label" style={{ opacity: 0 }}>
            {content.detail.label}
          </span>
          <h2 ref={titleRef} className="t-title" style={{ opacity: 0 }}>
            {content.detail.title}
          </h2>
          <p ref={bodyRef} className="t-body" style={{ opacity: 0 }}>
            {content.detail.body}
          </p>

          {/* 3 steps */}
          <div ref={stepsRef} className="detail-steps" style={{ opacity: 0 }}>
            {content.detail.steps.map((s) => (
              <div key={s.num} className="detail-step">
                <span className="detail-step-num t-label">{s.num}</span>
                <div>
                  <p className="detail-step-title">{s.title}</p>
                  <p className="t-body" style={{ fontSize: 13 }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Image */}
        <div className="detail-image-col">
          <Image
            ref={imageRef}
            src="/angel.jpg"
            alt="OBSIDIAN — how it works"
            width={700}
            height={700}
            className="detail-angel-crop"
            style={{ opacity: 0 }}
            data-cursor="angel"
          />
        </div>
      </div>
    </section>
  );
}
