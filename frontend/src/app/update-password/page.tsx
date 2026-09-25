"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import "@/app/login.css";

export default function UpdatePasswordPage() {
  const router = useRouter();

  // Form states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Feedback states
  const [loading, setLoading] = useState(false);
  const [checkingSession] = useState(false);
  const [isValidSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
  };

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    if (!newPassword) {
      triggerToast("Please enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      triggerToast("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      triggerToast("Passwords do not match. Please verify.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await api.updatePassword({ password: newPassword });

      const stored = localStorage.getItem("obsidian_session");
      if (stored) {
        try {
          const userObj = JSON.parse(stored);
          userObj.hasUpdatedPassword = true;
          localStorage.setItem("obsidian_session", JSON.stringify(userObj));
        } catch {
          // ignore
        }
      }

      setSuccessMessage("Your password has been successfully updated!");
      triggerToast("Password updated successfully!");

      // Auto redirect after short delay
      setTimeout(() => {
        router.push("/p2");
      }, 2000);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while updating your password.";
      setErrorMessage(message);
      triggerToast(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      {/* Background Ambient Layers */}
      <div className="video-wrapper">
        <video
          className="bg-video blur-effect"
          autoPlay
          loop
          muted
          playsInline
          src="/hand_animation.mp4"
        />
        <div className="video-overlay-gradient" />
        <div
          className="ambient-orb"
          style={{
            width: "480px",
            height: "480px",
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.28) 0%, transparent 70%)",
            top: "15%",
            left: "20%",
          }}
        />
        <div
          className="ambient-orb"
          style={{
            width: "420px",
            height: "420px",
            background: "radial-gradient(circle, rgba(6, 182, 212, 0.22) 0%, transparent 70%)",
            bottom: "15%",
            right: "20%",
            animationDelay: "-6s",
          }}
        />
      </div>

      {/* Main Glass Card Container */}
      <div className="login-container" style={{ maxWidth: "460px", margin: "0 auto", padding: "20px" }}>
        <div className="glass-card">
          {/* Header Brand */}
          <div className="brand-header" style={{ marginBottom: "24px", textAlign: "center" }}>
            <Link href="/" style={{ textDecoration: "none", display: "inline-block" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  padding: "8px 16px",
                  borderRadius: "999px",
                  marginBottom: "16px",
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>💎</span>
                <span
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "#f8fafc",
                  }}
                >
                  OBSIDIAN
                </span>
              </div>
            </Link>

            <h1 className="title" style={{ fontSize: "1.75rem", fontWeight: 700, color: "#ffffff" }}>
              {successMessage ? "Password Updated" : "Create New Password"}
            </h1>
            <p className="subtitle" style={{ fontSize: "0.9rem", color: "#94a3b8", marginTop: "6px" }}>
              {successMessage
                ? "Your credentials have been securely updated."
                : "Enter and confirm your new secure password below."}
            </p>
          </div>

          {/* Loading Session Check */}
          {checkingSession && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "36px 0",
                gap: "14px",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  border: "3px solid rgba(139, 92, 246, 0.2)",
                  borderTopColor: "#8b5cf6",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
                Verifying password recovery session...
              </p>
            </div>
          )}

          {/* Error / Expired Link Banner */}
          {!checkingSession && !isValidSession && !successMessage && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "14px",
                padding: "20px",
                textAlign: "center",
                marginBottom: "20px",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>⚠️</div>
              <h3 style={{ color: "#fca5a5", fontSize: "1.05rem", fontWeight: 600, marginBottom: "6px" }}>
                Invalid or Expired Link
              </h3>
              <p style={{ color: "#fca5a5", fontSize: "0.85rem", lineHeight: "1.4", opacity: 0.9 }}>
                {errorMessage || "The reset link is invalid or has expired."}
              </p>

              <div style={{ marginTop: "18px" }}>
                <Link
                  href="/"
                  className="btn-primary"
                  style={{
                    display: "inline-block",
                    textDecoration: "none",
                    padding: "10px 20px",
                    fontSize: "0.88rem",
                  }}
                >
                  Request New Reset Link
                </Link>
              </div>
            </div>
          )}

          {/* Success Notification Banner */}
          {successMessage && (
            <div
              style={{
                background: "rgba(34, 197, 94, 0.12)",
                border: "1px solid rgba(34, 197, 94, 0.35)",
                borderRadius: "14px",
                padding: "24px",
                textAlign: "center",
                marginBottom: "20px",
              }}
            >
              <div style={{ fontSize: "2.2rem", marginBottom: "8px" }}>✅</div>
              <h3 style={{ color: "#86efac", fontSize: "1.1rem", fontWeight: 600, marginBottom: "6px" }}>
                Password Updated!
              </h3>
              <p style={{ color: "#bbf7d0", fontSize: "0.88rem", lineHeight: "1.5", marginBottom: "18px" }}>
                {successMessage} Redirecting to your dashboard...
              </p>
              <Link
                href="/p2"
                className="btn-primary"
                style={{
                  display: "inline-block",
                  textDecoration: "none",
                  padding: "10px 24px",
                  fontSize: "0.88rem",
                }}
              >
                Go to Dashboard Now
              </Link>
            </div>
          )}

          {/* Form when session is valid */}
          {!checkingSession && isValidSession && !successMessage && (
            <form onSubmit={handlePasswordUpdate} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* New Password Field */}
              <div className="input-group">
                <label className="input-label" htmlFor="newPassword">
                  New Password
                </label>
                <div className="input-wrapper">
                  <span className="input-icon">🔒</span>
                  <input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    className="input-field"
                    placeholder="Enter at least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                    tabIndex={-1}
                  >
                    {showPassword ? "👁️" : "🙈"}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="input-group">
                <label className="input-label" htmlFor="confirmPassword">
                  Confirm New Password
                </label>
                <div className="input-wrapper">
                  <span className="input-icon">🔐</span>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    className="input-field"
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label="Toggle confirm password visibility"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? "👁️" : "🙈"}
                  </button>
                </div>
              </div>

              {/* Validation helper hints */}
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#94a3b8",
                  padding: "4px 2px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>{newPassword.length >= 6 ? "🟢" : "⚪"}</span>
                  <span>Minimum 6 characters</span>
                </div>
                {confirmPassword && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{newPassword === confirmPassword ? "🟢" : "🔴"}</span>
                    <span>
                      {newPassword === confirmPassword
                        ? "Passwords match"
                        : "Passwords do not match"}
                    </span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
                style={{
                  marginTop: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  cursor: loading || newPassword.length < 6 || newPassword !== confirmPassword ? "not-allowed" : "pointer",
                  opacity: loading || newPassword.length < 6 || newPassword !== confirmPassword ? 0.65 : 1,
                }}
              >
                {loading ? (
                  <>
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        border: "2px solid rgba(255, 255, 255, 0.3)",
                        borderTopColor: "#fff",
                        animation: "spin 0.6s linear infinite",
                      }}
                    />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </form>
          )}

          {/* Footer Navigation */}
          <div style={{ textAlign: "center", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <Link
              href="/"
              style={{
                color: "#94a3b8",
                fontSize: "0.85rem",
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
            >
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Toast Notification Container */}
      {showToast && (
        <div
          style={{
            position: "fixed",
            bottom: "30px",
            right: "30px",
            background: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(139, 92, 246, 0.4)",
            borderRadius: "12px",
            padding: "14px 22px",
            color: "#ffffff",
            fontSize: "0.9rem",
            fontWeight: 500,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(139, 92, 246, 0.25)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            animation: "slideInUp 0.3s ease-out forwards",
          }}
        >
          <span>🔔</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Spinner keyframes style */}
      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes slideInUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
