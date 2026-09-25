"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { content } from "@/data/content";

gsap.registerPlugin(ScrollTrigger);

export default function StorySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const labelRef   = useRef<HTMLSpanElement>(null);
  const titleRef   = useRef<HTMLHeadingElement>(null);
  const bodyRef    = useRef<HTMLParagraphElement>(null);
  const bulletsRef = useRef<HTMLDivElement>(null);
  const imageRef   = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 72%",
          toggleActions: "play none none reverse",
        },
      });

      tl.fromTo(imageRef.current,
        { opacity: 0, x: -40, scale: 0.97 },
        { opacity: 1, x: 0, scale: 1, duration: 1.2, ease: "power3.out" }
      )
      .fromTo(labelRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
        "-=0.8"
      )
      .fromTo(titleRef.current,
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" },
        "-=0.4"
      )
      .fromTo(bodyRef.current,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" },
        "-=0.5"
      )
      .fromTo(bulletsRef.current,
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" },
        "-=0.4"
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="story section">
      <div className="story-inner">
        {/* Image column */}
        <div className="story-image-col">
          <Image
            ref={imageRef}
            src="/angel.jpg"
            alt="OBSIDIAN — the problem"
            width={700}
            height={1050}
            className="story-angel-crop"
            style={{ opacity: 0 }}
            data-cursor="angel"
          />
        </div>

        {/* Text column */}
        <div className="story-text-col">
          <span ref={labelRef} className="t-label" style={{ opacity: 0 }}>
            {content.story.label}
          </span>
          <h2 ref={titleRef} className="t-title" style={{ opacity: 0 }}>
            {content.story.title}
          </h2>
          <p ref={bodyRef} className="t-body" style={{ opacity: 0 }}>
            {content.story.body}
          </p>

          {/* Problem bullets */}
          <div ref={bulletsRef} className="story-bullets" style={{ opacity: 0 }}>
            {content.story.bullets.map((b) => (
              <div key={b.title} className="story-bullet">
                <span className="story-bullet-icon">{b.icon}</span>
                <div>
                  <p className="story-bullet-title">{b.title}</p>
                  <p className="t-body" style={{ fontSize: 13 }}>{b.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
