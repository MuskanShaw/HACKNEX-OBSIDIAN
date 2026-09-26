"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: "#050505",
          color: "#ffffff",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: "480px",
            textAlign: "center",
            padding: "32px",
            borderRadius: "12px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          <h1 style={{ fontSize: "24px", marginBottom: "16px", fontWeight: "600" }}>
            Application Error
          </h1>
          <p style={{ color: "#9ca3af", fontSize: "14px", marginBottom: "24px" }}>
            An unexpected error occurred while rendering the page.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              backgroundColor: "#ffffff",
              color: "#050505",
              border: "none",
              borderRadius: "6px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
