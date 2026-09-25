"use client";

import { useEffect, useRef } from "react";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if touch device / mobile screen
    if (typeof window === "undefined") return;
    const isTouch = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
    if (isTouch) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    const badge = badgeRef.current;
    const container = containerRef.current;
    if (!dot || !ring || !container) return;

    // Mouse coordinates
    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let dotX = -100;
    let dotY = -100;

    // Velocity for dynamic stretch/squash
    let prevX = -100;
    let prevY = -100;
    let velX = 0;
    let velY = 0;
    let angle = 0;
    let speed = 0;

    let isVisible = false;
    let isClicking = false;
    let currentMode: "default" | "link" | "input" | "showcase" | "card" = "default";
    let rafId = 0;

    // Stardust trail particles
    const TRAIL_COUNT = 6;
    const trailData = Array.from({ length: TRAIL_COUNT }, () => ({
      x: -100,
      y: -100,
      alpha: 0,
      size: 4,
    }));

    const trailNodes: HTMLDivElement[] = [];
    const trailContainer = document.createElement("div");
    trailContainer.className = "obsidian-trail-container";
    container.appendChild(trailContainer);

    for (let i = 0; i < TRAIL_COUNT; i++) {
      const node = document.createElement("div");
      node.className = "obsidian-stardust";
      trailContainer.appendChild(node);
      trailNodes.push(node);
    }

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (!isVisible) {
        isVisible = true;
        container.style.opacity = "1";
        ringX = mouseX;
        ringY = mouseY;
        dotX = mouseX;
        dotY = mouseY;
        trailData.forEach((t) => {
          t.x = mouseX;
          t.y = mouseY;
        });
      }
    };

    const onMouseDown = () => {
      isClicking = true;
      ring.classList.add("is-clicking");
      dot.classList.add("is-clicking");
    };

    const onMouseUp = () => {
      isClicking = false;
      ring.classList.remove("is-clicking");
      dot.classList.remove("is-clicking");
    };

    const onMouseLeave = () => {
      isVisible = false;
      container.style.opacity = "0";
    };

    const onMouseEnter = () => {
      isVisible = true;
      container.style.opacity = "1";
    };

    // Global Event Delegation for Interactive Elements
    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 3D Monument / Showcase / Angel
      const showcaseEl = target.closest(
        "[data-cursor='angel'], .angel-wrap, .angel-img, .scene, .display, .monument-wrap, canvas"
      );
      if (showcaseEl) {
        currentMode = "showcase";
        setCursorState("is-showcase", "EXPLORE");
        return;
      }

      // Input / Textarea / ContentEditable
      const inputEl = target.closest(
        "input, textarea, select, [contenteditable='true'], .field input, .field select"
      );
      if (inputEl) {
        currentMode = "input";
        setCursorState("is-input", "");
        return;
      }

      // Links, Buttons, Clickables, Nav Pills
      const linkEl = target.closest(
        "a, button, [role='button'], .ctrl-btn, .pill, .btn-primary, .btn-back, .next-btn, .tab-item, .db-nav-item, .social-btn, .submit-btn, [data-cursor='link'], .forgot-link, .db-btn, .action-btn"
      );
      if (linkEl) {
        currentMode = "link";
        setCursorState("is-link", "");
        return;
      }

      // Interactive Cards
      const cardEl = target.closest(
        ".stat-card, .metric-card, .step-card, .auth-card, .theme-card, .roadmap-card, [data-cursor='card']"
      );
      if (cardEl) {
        currentMode = "card";
        setCursorState("is-card", "");
        return;
      }

      // Reset to default
      currentMode = "default";
      setCursorState("", "");
    };

    const setCursorState = (stateClass: string, label: string) => {
      ring.className = `cursor-ring ${stateClass} ${isClicking ? "is-clicking" : ""}`.trim();
      dot.className = `cursor-dot ${stateClass} ${isClicking ? "is-clicking" : ""}`.trim();
      if (badge) {
        badge.textContent = label;
      }
    };

    // Animation Render Loop
    const loop = () => {
      // Dot smooth follow (snappy responsive lerp)
      dotX += (mouseX - dotX) * 0.45;
      dotY += (mouseY - dotY) * 0.45;

      // Ring smooth trailing inertia (luxury spring lerp)
      ringX += (mouseX - ringX) * 0.14;
      ringY += (mouseY - ringY) * 0.14;

      // Velocity calculation
      velX = mouseX - prevX;
      velY = mouseY - prevY;
      prevX = mouseX;
      prevY = mouseY;
      speed = Math.sqrt(velX * velX + velY * velY);
      angle = Math.atan2(velY, velX) * (180 / Math.PI);

      // Subtle dynamic velocity stretch on the ring when moving swiftly
      const stretch = Math.min(1 + speed * 0.008, 1.4);
      const squeeze = Math.max(1 - speed * 0.004, 0.75);

      dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`;

      if (currentMode === "default" || currentMode === "card") {
        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) rotate(${angle}deg) scale(${stretch}, ${squeeze})`;
      } else {
        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(1, 1)`;
      }

      // Update stardust trail
      let leadX = mouseX;
      let leadY = mouseY;
      for (let i = 0; i < TRAIL_COUNT; i++) {
        const t = trailData[i];
        t.x += (leadX - t.x) * (0.35 - i * 0.03);
        t.y += (leadY - t.y) * (0.35 - i * 0.03);
        leadX = t.x;
        leadY = t.y;

        const node = trailNodes[i];
        if (node) {
          const trailOpacity = Math.max(0, (1 - i / TRAIL_COUNT) * Math.min(speed / 8, 0.75));
          const trailScale = (1 - i / TRAIL_COUNT) * 0.9;
          node.style.transform = `translate3d(${t.x}px, ${t.y}px, 0) translate(-50%, -50%) scale(${trailScale})`;
          node.style.opacity = isVisible ? `${trailOpacity}` : "0";
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);
    window.addEventListener("mouseover", onMouseOver, { passive: true });

    rafId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      window.removeEventListener("mouseover", onMouseOver);
      cancelAnimationFrame(rafId);
      if (trailContainer && container.contains(trailContainer)) {
        container.removeChild(trailContainer);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="obsidian-cursor-container"
      aria-hidden="true"
      style={{ opacity: 0, transition: "opacity 0.3s ease" }}
    >
      {/* Outer Ethereal Halo Ring */}
      <div ref={ringRef} className="cursor-ring">
        <div className="cursor-ring-reticle">
          <span className="reticle-tick tick-n" />
          <span className="reticle-tick tick-s" />
          <span className="reticle-tick tick-e" />
          <span className="reticle-tick tick-w" />
        </div>
        <span ref={badgeRef} className="cursor-badge" />
      </div>

      {/* Precision Inner Dot */}
      <div ref={dotRef} className="cursor-dot" />
    </div>
  );
}
