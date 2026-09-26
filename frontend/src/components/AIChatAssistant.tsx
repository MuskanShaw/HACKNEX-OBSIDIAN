"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  Sparkles,
  Send,
  X,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import "./AIChatAssistant.css";

export interface AIChatProduct {
  id: number | string;
  name: string;
  price: number;
  stock: number;
  category?: string;
  brand?: string;
  mrp?: number;
  sellingPrice?: number;
  status?: string;
  emoji?: string;
  image?: string;
}

export interface AIChatOrder {
  id: number | string;
  customerName: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  status: "completed" | "pending" | "processing";
  date: string;
}

export interface AIChatAssistantProps {
  products?: AIChatProduct[];
  orders?: AIChatOrder[];
  shopName?: string;
  ownerName?: string;
  businessType?: string;
  customBusinessType?: string;
  currency?: string;
  logoUrl?: string;
  bannerUrl?: string;
  shopAddress?: string;
  activeTab?: string;
  onNavigateTab?: (tab: "overview" | "products" | "orders" | "settings" | "deployment") => void;
  onOpenAddProduct?: () => void;
}

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  actionHint?: {
    label: string;
    tab?: "overview" | "products" | "orders" | "settings" | "deployment";
    triggerModal?: boolean;
  };
}

const QUICK_ACTIONS = [
  { label: "Help me add a product", query: "How do I add a product?" },
  { label: "Check my low stock", query: "Which products are low in stock?" },
  { label: "How do I manage inventory?", query: "How do I manage inventory?" },
  { label: "Explain my dashboard", query: "Explain my dashboard" },
  { label: "Product suggestions", query: "What product suggestions or improvements do you have for my store?" },
];

function getFormattedTime(): string {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AIChatAssistant({
  products = [],
  orders = [],
  shopName = "OBSIDIAN Store",
  ownerName = "Store Owner",
  businessType = "clothing",
  customBusinessType = "",
  currency = "₹",
  logoUrl = "",
  bannerUrl = "",
  shopAddress = "",
  activeTab = "settings",
  onNavigateTab,
  onOpenAddProduct,
}: AIChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Hi! I'm your Obsidian AI Assistant 👋\nHow can I help you?",
      timestamp: getFormattedTime(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to newest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isThinking, isOpen]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Infer contextual navigation shortcut based on assistant guidance
  const inferActionHint = (replyText: string): Message["actionHint"] | undefined => {
    const lower = replyText.toLowerCase();
    if (
      (lower.includes("add a product") || lower.includes("'+ add product'") || lower.includes("add product modal")) &&
      onOpenAddProduct
    ) {
      return { label: "Open Add Product Modal", triggerModal: true };
    }
    if (lower.includes("products tab") || lower.includes("products section") || lower.includes("catalog")) {
      if (onNavigateTab) return { label: "Go to Products Tab", tab: "products" };
    }
    if (lower.includes("overview tab") || lower.includes("analytics") || lower.includes("overview section")) {
      if (onNavigateTab) return { label: "Go to Overview Tab", tab: "overview" };
    }
    if (lower.includes("orders tab") || lower.includes("orders section") || lower.includes("fulfillment")) {
      if (onNavigateTab) return { label: "Go to Orders Tab", tab: "orders" };
    }
    if (lower.includes("settings tab") || lower.includes("settings section") || lower.includes("store details")) {
      if (onNavigateTab) return { label: "Go to Settings Tab", tab: "settings" };
    }
    if (lower.includes("deployment tab") || lower.includes("qr code") || lower.includes("custom domain")) {
      if (onNavigateTab) return { label: "Go to Deployment Tab", tab: "deployment" };
    }
    return undefined;
  };

  const handleSend = async (textToSend?: string) => {
    const rawQuery = textToSend || inputVal;
    const trimmed = rawQuery.trim();
    if (!trimmed || isThinking) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: trimmed,
      timestamp: getFormattedTime(),
    };

    // Append user message immediately
    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    setIsThinking(true);

    // Prepare bounded conversation memory (latest 14 turns)
    const conversation = messages
      .filter((m) => m.id !== "welcome")
      .slice(-14)
      .map((m) => ({
        role: (m.sender === "assistant" ? "assistant" : "user") as "assistant" | "user",
        content: m.text,
      }));

    // Package live dashboard context for Gemini
    const context = {
      store: {
        name: shopName,
        ownerName,
        businessType: customBusinessType || businessType,
        currency,
        address: shopAddress,
        activeTab,
      },
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        sellingPrice: p.sellingPrice ?? p.price,
        mrp: p.mrp ?? p.price,
        stock: Number(p.stock) || 0,
        category: p.category,
        brand: p.brand,
        status: p.status,
      })),
      inventory: products.map((p) => ({
        name: p.name,
        stock: Number(p.stock) || 0,
        status:
          (Number(p.stock) || 0) <= 0
            ? "out_of_stock"
            : (Number(p.stock) || 0) < 5
            ? "low_stock"
            : "in_stock",
      })),
      orders: orders.map((o) => ({
        id: o.id,
        customerName: o.customerName,
        productName: o.productName,
        quantity: o.quantity,
        totalPrice: o.totalPrice,
        status: o.status,
        date: o.date,
      })),
    };

    try {
      // POST /api/ai/chat with Supabase bearer token handled inside api.sendChatMessage
      const response = await api.sendChatMessage({
        message: trimmed,
        conversation,
        context,
      });

      const replyText =
        response.message || response.reply || "I'm here to help with your store.";

      const botMsg: Message = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text: replyText,
        timestamp: getFormattedTime(),
        actionHint: inferActionHint(replyText),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error("[OBSIDIAN AI] Chat request error:", err);

      // Section 14 explicit error handling mappings
      let errorText = "Sorry, I'm having trouble responding right now. Please try again.";

      if (err?.status === 401) {
        errorText = "Your session has expired. Please log in again.";
      } else if (err?.status === 429) {
        errorText = "Too many requests. Please wait a moment and try again.";
      } else if (
        err?.message?.includes("Failed to fetch") ||
        err?.name === "TypeError" ||
        (typeof navigator !== "undefined" && !navigator.onLine)
      ) {
        errorText = "Unable to connect to the AI assistant. Please check your connection.";
      }

      const botErrorMsg: Message = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text: errorText,
        timestamp: getFormattedTime(),
      };

      setMessages((prev) => [...prev, botErrorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleQuickAction = (query: string) => {
    handleSend(query);
  };

  const handleActionHintClick = (hint: NonNullable<Message["actionHint"]>) => {
    if (hint.triggerModal && onOpenAddProduct) {
      onOpenAddProduct();
      setIsOpen(false);
    } else if (hint.tab && onNavigateTab) {
      onNavigateTab(hint.tab);
    }
  };

  return (
    <>
      {/* ── Floating Launcher Button ── */}
      <button
        type="button"
        className={`obsidian-ai-launcher ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Close AI Assistant" : "Open Obsidian AI Assistant"}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X size={24} strokeWidth={2.2} />
        ) : (
          <Bot size={26} strokeWidth={2.2} />
        )}
        <span className="obsidian-ai-launcher-badge" aria-hidden="true" />
        <span className="obsidian-ai-tooltip" role="tooltip">
          {isOpen ? "Close Assistant" : "Obsidian AI Assistant"}
        </span>
      </button>

      {/* ── Chat Panel ── */}
      <div
        className={`obsidian-ai-panel ${isOpen ? "open" : "closed"}`}
        role="dialog"
        aria-label="Obsidian AI Assistant Chat"
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="obsidian-ai-header">
          <div className="obsidian-ai-header-left">
            <div className="obsidian-ai-avatar">
              <Sparkles size={18} />
              <span className="obsidian-ai-avatar-online" aria-label="Online" />
            </div>
            <div className="obsidian-ai-header-text">
              <h3>
                Obsidian AI Assistant
                <span className="obsidian-ai-header-badge">AI</span>
              </h3>
              <p>Your store assistant</p>
            </div>
          </div>
          <div className="obsidian-ai-header-actions">
            <button
              type="button"
              className="obsidian-ai-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close assistant"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="obsidian-ai-messages" tabIndex={0} aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`obsidian-ai-msg-row ${m.sender}`}>
              {m.sender === "assistant" && (
                <div className="obsidian-ai-msg-avatar" aria-hidden="true">
                  <Bot size={14} />
                </div>
              )}
              <div className="obsidian-ai-bubble">
                <div className="obsidian-ai-bubble-content" style={{ whiteSpace: "pre-line" }}>
                  {m.text}
                </div>
                {m.actionHint && (
                  <button
                    type="button"
                    className="obsidian-ai-pill-btn"
                    style={{ marginTop: 8, background: "rgba(99, 102, 241, 0.12)", color: "#6366f1" }}
                    onClick={() => handleActionHintClick(m.actionHint!)}
                  >
                    <span>{m.actionHint.label}</span>
                    <ChevronRight size={13} />
                  </button>
                )}
                <span className="obsidian-ai-bubble-time">{m.timestamp}</span>
              </div>
            </div>
          ))}

          {/* Thinking Indicator */}
          {isThinking && (
            <div className="obsidian-ai-msg-row assistant">
              <div className="obsidian-ai-msg-avatar" aria-hidden="true">
                <Bot size={14} />
              </div>
              <div className="obsidian-ai-thinking" aria-label="Thinking">
                <span className="obsidian-ai-dot" />
                <span className="obsidian-ai-dot" />
                <span className="obsidian-ai-dot" />
                <span className="obsidian-ai-thinking-text">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Action Suggestion Chips */}
        <div className="obsidian-ai-suggestions-container">
          <div className="obsidian-ai-suggestions-title">
            <Sparkles size={11} /> Suggested questions
          </div>
          <div className="obsidian-ai-suggestions-pills">
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                type="button"
                className="obsidian-ai-pill-btn"
                onClick={() => handleQuickAction(action.query)}
                disabled={isThinking}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <form
          className="obsidian-ai-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <div className="obsidian-ai-input-wrap">
            <input
              ref={inputRef}
              type="text"
              className="obsidian-ai-input"
              placeholder="Ask your store assistant..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isThinking}
              aria-label="Ask your store assistant"
            />
          </div>
          <button
            type="submit"
            className="obsidian-ai-send-btn"
            disabled={!inputVal.trim() || isThinking}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </>
  );
}
