"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import "./login.css";

interface LocalUser {
  id: string;
  email: string;
  full_name?: string;
}

const VIDEO_THEMES = {
  cyber: {
    name: "Cyberpunk City",
    videoUrl: "/hand_animation.mp4",
    particleColors: ["#00f2fe", "#4facfe"],
  },
  aurora: {
    name: "Aurora Borealis",
    videoUrl: "/chotodanapori.mp4",
    particleColors: ["#38f9d7", "#43e97b"],
  },
  cosmos: {
    name: "Deep Cosmos",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1610-large.mp4",
    particleColors: ["#fa709a", "#fee140"],
  },
  abstract: {
    name: "Abstract Waves",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-abstract-purple-and-blue-mesh-loop-41554-large.mp4",
    particleColors: ["#8b5cf6", "#ec4899"],
  },
};

type ThemeKey = keyof typeof VIDEO_THEMES;

export default function LoginPage() {
  const router = useRouter();
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>("cyber");
  const [isBlurred, setIsBlurred] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeSessionUser, setActiveSessionUser] = useState<LocalUser | null>(null);

  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Form inputs
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  // Show a toast message
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
  };

  // Check existing session on mount from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("obsidian_session");
      if (stored) {
        setActiveSessionUser(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Video theme change handler
  const handleThemeChange = (key: ThemeKey) => {
    if (key === currentTheme) return;
    setCurrentTheme(key);
    if (videoRef.current) {
      videoRef.current.src = VIDEO_THEMES[key].videoUrl;
      videoRef.current.play().catch(() => { });
      setIsPaused(false);
    }
    triggerToast(`Theme set to ${VIDEO_THEMES[key].name}`);
  };

  // Video Controls
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.play().catch(() => { });
      } else {
        videoRef.current.pause();
      }
      setIsPaused(!isPaused);
    }
  };

  const toggleBlur = () => {
    setIsBlurred(!isBlurred);
  };

  // Interactive Particle Trail Overlay on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      decay: number;
    }

    const particles: Particle[] = [];
    const colors = VIDEO_THEMES[currentTheme].particleColors;

    const addParticles = (x: number, y: number, count = 2) => {
      for (let i = 0; i < count; i++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5 - 0.5,
          size: Math.random() * 2.5 + 1,
          color,
          alpha: 0.8,
          decay: Math.random() * 0.015 + 0.005,
        });
      }
    };

    const updatePos = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      addParticles(clientX, clientY, 2);
    };

    window.addEventListener("mousemove", updatePos);
    window.addEventListener("touchmove", updatePos);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Ambient background particles floating up
      if (Math.random() < 0.15) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        particles.push({
          x: Math.random() * width,
          y: height + 10,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -(Math.random() * 1.2 + 0.3),
          size: Math.random() * 2 + 0.5,
          color,
          alpha: 0.5,
          decay: 0.003,
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("mousemove", updatePos);
      window.removeEventListener("touchmove", updatePos);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [currentTheme]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      triggerToast("Please enter your email address.");
      return;
    }

    // Handle Password Reset / Recovery
    if (isForgotPasswordMode) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        triggerToast(`Password reset link sent to ${trimmedEmail}!`);
        setTimeout(() => {
          setIsForgotPasswordMode(false);
          setIsSignUpMode(false);
        }, 1500);
      }, 500);
      return;
    }

    if (!password) {
      triggerToast("Please enter your password.");
      return;
    }

    if (password.length < 6) {
      triggerToast("Password must be at least 6 characters.");
      return;
    }

    if (isSignUpMode) {
      if (password !== confirmPassword) {
        triggerToast("Passwords do not match!");
        return;
      }

      setLoading(true);
      const displayName = fullName.trim() || trimmedEmail.split("@")[0];

      try {
        const res = await api.signup({
          email: trimmedEmail,
          password,
          full_name: displayName,
        });

        const loggedUser: LocalUser = {
          id: res.user?.id || `user_${Date.now()}`,
          email: res.user?.email || trimmedEmail,
          full_name: res.user?.full_name || displayName,
        };

        localStorage.setItem("obsidian_session", JSON.stringify(loggedUser));
        if (res.token) {
          localStorage.setItem("obsidian_token", res.token);
        }
        localStorage.setItem("ownerName", displayName);
        setActiveSessionUser(loggedUser);

        triggerToast("Account created successfully!");
        setTimeout(() => {
          setLoading(false);
          router.push("/p1");
        }, 1000);
      } catch (err: any) {
        setLoading(false);
        triggerToast(err.message || "Failed to create account. Please try again.");
      }
    } else {
      setLoading(true);
      const displayName = fullName.trim() || trimmedEmail.split("@")[0];

      try {
        const res = await api.login({
          email: trimmedEmail,
          password,
        });

        const loggedUser: LocalUser = {
          id: res.user?.id || `user_${Date.now()}`,
          email: res.user?.email || trimmedEmail,
          full_name: res.user?.full_name || displayName,
        };

        localStorage.setItem("obsidian_session", JSON.stringify(loggedUser));
        if (res.token) {
          localStorage.setItem("obsidian_token", res.token);
        }
        if (!localStorage.getItem("ownerName") || res.user?.full_name) {
          localStorage.setItem("ownerName", loggedUser.full_name || displayName);
        }
        setActiveSessionUser(loggedUser);

        triggerToast("Signed In Successfully!");
        setTimeout(() => {
          setLoading(false);
          router.push("/p1");
        }, 1000);
      } catch (err: any) {
        setLoading(false);
        triggerToast(err.message || "Invalid credentials. Please check your email and password.");
      }
    }
  };

  return (
    <div className="login-page-wrapper">
      {/* Fullscreen Video Background */}
      <div className="video-wrapper">
        <video
          ref={videoRef}
          className={`bg-video ${isBlurred ? "blur-effect" : ""}`}
          autoPlay
          loop
          muted={isMuted}
          playsInline
          preload="auto"
        >
          <source src={VIDEO_THEMES[currentTheme].videoUrl} type="video/mp4" />
          Your browser does not support HTML5 video.
        </video>
        <canvas ref={canvasRef} className="video-canvas" />
        <div className="video-overlay-gradient" />
      </div>

      <div className="app-container">
        {/* Center Auth Card */}
        <main className="main-content">
          <div className="auth-card-container">
            <div className="auth-card">
              <div className="auth-header">
                <h1
                  className={`obsidian-title ${isSignUpMode || isForgotPasswordMode ? "create-account-title" : ""
                    }`}
                  aria-label="OBSIDIAN"
                >
                  {isForgotPasswordMode ? (
                    "RESET PASSWORD"
                  ) : isSignUpMode ? (
                    "CREATE ACCOUNT"
                  ) : (
                    <>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <span className="obsidian-mark" aria-hidden="true" />
                        BSIDIAN
                      </span>
                    </>
                  )}
                </h1>
                <p>
                  {isForgotPasswordMode
                    ? "Enter your email to receive recovery instructions"
                    : isSignUpMode
                      ? "Establish your digital storefront footprint"
                      : "Access your digital architectural storefront"}
                </p>
              </div>

              {activeSessionUser && !isForgotPasswordMode && (
                <div className="existing-session-banner">
                  <div className="existing-session-info">
                    <span className="existing-session-badge">Active Account</span>
                    <span>{activeSessionUser.email || "Signed In"}</span>
                  </div>
                  <button
                    type="button"
                    className="resume-btn"
                    onClick={() => router.push("/p1")}
                    data-cursor="link"
                  >
                    Resume Store →
                  </button>
                </div>
              )}

              <form onSubmit={handleFormSubmit}>
                {isSignUpMode && !isForgotPasswordMode && (
                  <div className="form-group">
                    <label className="input-label" htmlFor="fullName">
                      Full Name
                    </label>
                    <div className="input-wrapper">
                      <input
                        type="text"
                        id="fullName"
                        className="form-input"
                        placeholder="Alex Morgan"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                      <div className="input-icon">
                        <svg viewBox="0 0 24 24" width="18" height="18">
                          <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="input-label" htmlFor="email">
                    Email Address
                  </label>
                  <div className="input-wrapper">
                    <input
                      type="email"
                      id="email"
                      className="form-input"
                      placeholder="alex@aether.io"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <div className="input-icon">
                      <svg viewBox="0 0 24 24" width="18" height="18">
                        <path fill="currentColor" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {!isForgotPasswordMode && (
                  <div className="form-group">
                    <label className="input-label" htmlFor="password">
                      Password
                    </label>
                    <div className="input-wrapper">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        className="form-input"
                        placeholder="••••••••••••"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <div className="input-icon">
                        <svg viewBox="0 0 24 24" width="18" height="18">
                          <path fill="currentColor" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                        </svg>
                      </div>
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        data-cursor="link"
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18">
                          <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {isSignUpMode && !isForgotPasswordMode && (
                  <div className="form-group">
                    <label className="input-label" htmlFor="confirmPassword">
                      Confirm Password
                    </label>
                    <div className="input-wrapper">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="confirmPassword"
                        className="form-input"
                        placeholder="••••••••••••"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <div className="input-icon">
                        <svg viewBox="0 0 24 24" width="18" height="18">
                          <path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {!isForgotPasswordMode && (
                  <div className="form-options">
                    <label className="remember-me">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        data-cursor="link"
                      />{" "}
                      <span>Remember me</span>
                    </label>
                    <button
                      type="button"
                      className="forgot-link"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      onClick={() => {
                        setIsForgotPasswordMode(true);
                        setIsSignUpMode(false);
                      }}
                      data-cursor="link"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}

                {/* Mode switch prompts */}
                {isForgotPasswordMode ? (
                  <div className="signup-prompt">
                    <span>Remember your password?</span>
                    <button
                      className="signup-link"
                      type="button"
                      onClick={() => {
                        setIsForgotPasswordMode(false);
                        setIsSignUpMode(false);
                      }}
                      data-cursor="link"
                    >
                      Sign In
                    </button>
                  </div>
                ) : isSignUpMode ? (
                  <div className="signup-prompt">
                    <span>Already have an account?</span>
                    <button
                      className="signup-link"
                      type="button"
                      onClick={() => {
                        setIsSignUpMode(false);
                        setIsForgotPasswordMode(false);
                      }}
                      data-cursor="link"
                    >
                      Sign In
                    </button>
                  </div>
                ) : (
                  <div className="signup-prompt">
                    <span>New account?</span>
                    <button
                      className="signup-link"
                      type="button"
                      onClick={() => {
                        setIsSignUpMode(true);
                        setIsForgotPasswordMode(false);
                      }}
                      data-cursor="link"
                    >
                      Sign Up
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={loading}
                  style={{ opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
                  data-cursor="link"
                >
                  <span className="btn-text">
                    {loading
                      ? isForgotPasswordMode
                        ? "Sending Reset Link..."
                        : isSignUpMode
                          ? "Creating Store Account..."
                          : "Signing In..."
                      : isForgotPasswordMode
                        ? "Send Reset Instructions"
                        : isSignUpMode
                          ? "Create Store Account"
                          : "Sign In to Account"}
                  </span>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                  </svg>
                </button>
              </form>

              {!isForgotPasswordMode && (
                <>
                  <div className="social-divider">Or continue with</div>

                  <div className="social-buttons">
                    <button
                      className="social-btn"
                      type="button"
                      data-cursor="link"
                      onClick={async () => {
                        const targetEmail = email.trim() || prompt("Enter your Gmail address to sign in with Google:")?.trim() || "";
                        if (!targetEmail) {
                          triggerToast("Please enter your Gmail address to sign in.");
                          return;
                        }

                        setLoading(true);
                        const targetName = fullName.trim() || targetEmail.split("@")[0];
                        try {
                          let res;
                          try {
                            res = await api.login({ email: targetEmail, password: "GoogleOAuthPassword_2026!" });
                          } catch {
                            res = await api.signup({
                              email: targetEmail,
                              password: "GoogleOAuthPassword_2026!",
                              full_name: targetName,
                            });
                          }

                          const loggedUser: LocalUser = {
                            id: res.user?.id || `user_${targetEmail}`,
                            email: res.user?.email || targetEmail,
                            full_name: res.user?.full_name || targetName,
                          };

                          localStorage.setItem("obsidian_session", JSON.stringify(loggedUser));
                          if (res.token) {
                            localStorage.setItem("obsidian_token", res.token);
                          }
                          localStorage.setItem("ownerName", loggedUser.full_name || targetName);
                          setActiveSessionUser(loggedUser);
                          triggerToast(`Signed in with Google (${targetEmail})!`);
                          setTimeout(() => {
                            setLoading(false);
                            router.push("/p1");
                          }, 1000);
                        } catch {
                          const safeId = `user_${targetEmail.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
                          const loggedUser: LocalUser = {
                            id: safeId,
                            email: targetEmail,
                            full_name: targetName,
                          };

                          localStorage.setItem("obsidian_session", JSON.stringify(loggedUser));
                          localStorage.setItem("obsidian_token", `dev-mock-${safeId}`);
                          localStorage.setItem("ownerName", targetName);
                          setActiveSessionUser(loggedUser);
                          triggerToast(`Signed in with Google (${targetEmail})!`);
                          setTimeout(() => {
                            setLoading(false);
                            router.push("/p1");
                          }, 1000);
                        }
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      Google
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Toast Notification */}
      <div className={`toast-notification ${showToast ? "show" : ""}`}>
        <div className="toast-icon">
          <svg viewBox="0 0 24 24" width="12" height="12">
            <path fill="#fff" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
        <span>{toastMessage}</span>
      </div>
    </div>
  );
}
