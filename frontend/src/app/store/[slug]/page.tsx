"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function StoreSlugPage() {
  const routeParams = useParams();

  useEffect(() => {
    const slug = (routeParams?.slug as string) || "";
    const target = slug ? `/p3.html?slug=${encodeURIComponent(slug)}` : "/p3.html";
    window.location.replace(target);
  }, [routeParams]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #aab8c4, #d7e1ea 48%, #8ea4b3)",
        color: "#102a43",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🛍️</div>
        <p style={{ fontWeight: 700, letterSpacing: "0.05em" }}>Opening customer storefront...</p>
      </div>
    </div>
  );
}
