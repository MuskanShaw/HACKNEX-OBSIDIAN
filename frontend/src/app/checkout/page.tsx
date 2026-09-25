"use client";

import { useEffect } from "react";

export default function CheckoutRedirectPage() {
  useEffect(() => {
    // Forward directly to customer checkout page
    window.location.replace("/checkout.html");
  }, []);

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
        <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>💳</div>
        <p style={{ fontWeight: 700, letterSpacing: "0.05em" }}>Loading checkout...</p>
      </div>
    </div>
  );
}
