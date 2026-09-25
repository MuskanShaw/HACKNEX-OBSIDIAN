"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header
      style={{
        position: "fixed",
        top: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "92%",
        maxWidth: "1280px",
        zIndex: 9999,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "rgba(10, 15, 26, 0.78)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: "999px",
          boxShadow: "0 12px 35px rgba(0, 0, 0, 0.35)",
        }}
      >
        {/* Brand */}
        <Link
          href="/p1"
          data-cursor="link"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            textDecoration: "none",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: "0.92rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #38bdf8, #818cf8)",
              boxShadow: "0 0 10px rgba(56, 189, 248, 0.8)",
            }}
          />
          OBSIDIAN
        </Link>

        {/* Navigation Links */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          <Link
            href="/p1"
            data-cursor="link"
            style={{
              textDecoration: "none",
              padding: "6px 14px",
              borderRadius: "999px",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: pathname === "/p1" ? "#ffffff" : "#94a3b8",
              background: pathname === "/p1" ? "rgba(255, 255, 255, 0.14)" : "transparent",
              transition: "all 0.2s",
            }}
          >
            🏛️ Monument
          </Link>


          <Link
            href="/p2"
            data-cursor="link"
            style={{
              textDecoration: "none",
              padding: "6px 14px",
              borderRadius: "999px",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: pathname === "/p2" ? "#ffffff" : "#94a3b8",
              background: pathname === "/p2" ? "rgba(255, 255, 255, 0.14)" : "transparent",
              transition: "all 0.2s",
            }}
          >
            📊 Dashboard
          </Link>

          <a
            href="/p3.html"
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="link"
            style={{
              textDecoration: "none",
              padding: "6px 14px",
              borderRadius: "999px",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#38bdf8",
              background: "rgba(56, 189, 248, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              transition: "all 0.2s",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            🛍️ Live Store ↗
          </a>

          <a
            href="/checkout.html"
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="link"
            style={{
              textDecoration: "none",
              padding: "6px 14px",
              borderRadius: "999px",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#94a3b8",
              transition: "all 0.2s",
            }}
          >
            💳 Checkout
          </a>
        </nav>

        {/* Right CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Link
            href="/login"
            data-cursor="link"
            style={{
              textDecoration: "none",
              padding: "6px 14px",
              borderRadius: "999px",
              fontSize: "0.78rem",
              fontWeight: 700,
              color: pathname === "/" || pathname === "/login" ? "#38bdf8" : "#e2e8f0",
              background: pathname === "/" || pathname === "/login" ? "rgba(56, 189, 248, 0.16)" : "rgba(255, 255, 255, 0.08)",
              border: pathname === "/" || pathname === "/login" ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid rgba(255, 255, 255, 0.16)",
              transition: "all 0.2s",
            }}
          >
            🔑 Login
          </Link>

          <Link
            href="/p2"
            data-cursor="link"
            style={{
              textDecoration: "none",
              padding: "7px 16px",
              borderRadius: "999px",
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "#0a0f1a",
              background: "linear-gradient(135deg, #38bdf8, #60a5fa)",
              boxShadow: "0 0 15px rgba(56, 189, 248, 0.4)",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            Launch Store →
          </Link>
        </div>
      </div>
    </header>
  );
}
