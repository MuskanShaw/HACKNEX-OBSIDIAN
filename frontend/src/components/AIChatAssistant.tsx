"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  Sparkles,
  Send,
  X,
  HelpCircle,
  Package,
  Layers,
  ShoppingBag,
  TrendingUp,
  Store,
  ChevronRight,
} from "lucide-react";
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
  { label: "How do I manage inventory?", query: "How do I manage inventory?" },
  { label: "Explain my dashboard", query: "Explain my dashboard" },
  { label: "Suggest improvements", query: "Suggest improvements" },
  { label: "Website help", query: "How does this website work?" },
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
  const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
    };
  }, []);

  // Intelligent Local Response Generator based on actual P2 Dashboard Architecture
  const generateResponse = (
    query: string
  ): { text: string; actionHint?: Message["actionHint"] } => {
    const q = query.toLowerCase().trim();

    // ── Topic A: Website / Dashboard Help ──
    if (
      q.includes("how does this website work") ||
      q.includes("how do i use") ||
      q.includes("what can i do here") ||
      q.includes("explain my dashboard") ||
      q.includes("website help") ||
      q.includes("dashboard help") ||
      q.includes("walkthrough") ||
      q.includes("guide")
    ) {
      return {
        text:
          "The OBSIDIAN Dashboard gives you full autonomy over your digital commerce operations through 5 specialized command sections:\n\n" +
          "1. 📊 Overview: View real-time revenue analytics (Daily, Weekly, Monthly, Yearly), Average Order Value, Conversion Rate, and latest customer orders.\n\n" +
          "2. 📦 Products: Full catalog control. Create items, upload photos, set MRP vs Selling prices, and use quick +10 Restock buttons.\n\n" +
          "3. 💳 Orders: Live incoming customer orders. Inspect details and update fulfillment stages (Pending ➔ Processing ➔ Completed).\n\n" +
          "4. ⚙️ Settings: Configure store identity (Shop Name, Owner Name, Category, Address with Google Maps integration, Currency, Brand Logo & Banner), and switch Storefront Templates.\n\n" +
          "5. 🚀 Deployment: Instant storefront compilation, custom subdomain link, and a mobile QR code generator for buyer testing.",
        actionHint: onNavigateTab ? { label: "Go to Overview Tab", tab: "overview" } : undefined,
      };
    }

    // ── Topic B: Add Product Assistance ──
    if (
      q.includes("add product") ||
      q.includes("add a product") ||
      q.includes("create product") ||
      q.includes("how to add product") ||
      q.includes("how do i add") ||
      q.includes("new product") ||
      q.includes("upload product")
    ) {
      return {
        text:
          "To add a product to your catalog:\n\n" +
          "1. Open the Products section in the sidebar.\n" +
          "2. Click the '+ Add Product' button.\n" +
          "3. Fill in the product details:\n" +
          "   • Product Name: Title displayed on your public storefront.\n" +
          "   • Brand: Select from existing brands (Nike, Zara, Apple, Obsidian, etc.) or type a custom brand.\n" +
          "   • Category & Types: Assign tags and classification.\n" +
          "   • MRP & Selling Price: Enter base and discounted prices (discount % computes automatically).\n" +
          "   • Stock: Initial available quantity (defaults to 10).\n" +
          "   • Product Emoji: Visual badge representation (e.g. 🧥, ⌚, 👟).\n" +
          "   • Image: Provide a direct URL or upload an asset directly.\n" +
          "   • Description: Informative details for storefront buyers.\n" +
          "4. Click Save Product. It synchronizes immediately with your public store!",
        actionHint: onOpenAddProduct
          ? { label: "Open Add Product Modal", triggerModal: true }
          : onNavigateTab
          ? { label: "Go to Products Tab", tab: "products" }
          : undefined,
      };
    }

    // ── Topic C: Inventory Assistance ──
    if (
      q.includes("stock") ||
      q.includes("inventory") ||
      q.includes("how much stock") ||
      q.includes("low stock") ||
      q.includes("out of stock") ||
      q.includes("units") ||
      q.includes("inventory help") ||
      q.includes("manage inventory")
    ) {
      const totalProds = products.length;
      if (totalProds === 0) {
        return {
          text:
            "Your store currently has no products in inventory.\n\n" +
            "You can stock your shelves by heading to the Products tab and clicking '+ Add Product'. Once items are added, you can track units, get low-stock notifications, and restock with one click!",
          actionHint: onNavigateTab ? { label: "Go to Products Tab", tab: "products" } : undefined,
        };
      }

      const totalUnits = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
      const lowStockItems = products.filter((p) => p.stock > 0 && p.stock < 5);
      const outOfStockItems = products.filter((p) => p.stock <= 0);

      let stockReport =
        `Here is your live inventory telemetry:\n\n` +
        `• Catalog Items: ${totalProds} products\n` +
        `• Total Units in Stock: ${totalUnits} units\n` +
        `• Low Stock Alerts (< 5 units): ${lowStockItems.length} items\n` +
        `• Out of Stock (0 units): ${outOfStockItems.length} items\n\n`;

      if (lowStockItems.length > 0) {
        const names = lowStockItems.slice(0, 3).map((p) => `"${p.name}" (${p.stock} left)`).join(", ");
        stockReport += `⚠️ Attention Needed: ${names}${lowStockItems.length > 3 ? ` and ${lowStockItems.length - 3} more` : ""}.\n\n`;
      }

      stockReport += "💡 Pro-Tip: In the Products tab, each item has a quick '+10 Restock' action button to quickly replenish stock without opening the edit modal.";

      return {
        text: stockReport,
        actionHint: onNavigateTab ? { label: "View Products Tab", tab: "products" } : undefined,
      };
    }

    // ── Topic D: Product Suggestions / Ideas ──
    if (
      q.includes("what product should i add") ||
      q.includes("suggest products") ||
      q.includes("what should i sell") ||
      q.includes("product ideas") ||
      q.includes("recommend product") ||
      q.includes("product suggestions") ||
      q.includes("new item ideas")
    ) {
      const activeType = customBusinessType || businessType || "general retail";
      return {
        text:
          `Based on your store profile ("${shopName}", category: ${activeType}):\n\n` +
          `• Complementary Variants: Introduce accessories or matching companion pieces for your top-selling products.\n` +
          `• Signature Statement Piece: Add a high-visibility hero product at the top of your catalog with rich photography.\n` +
          `• Value Bundles: Group popular items into tiered packages to elevate your Average Order Value (AOV).\n` +
          `• Clear Pricing Spread: Use markdown pricing (MRP higher than Selling Price) so buyers see instant discount savings on the storefront.\n\n` +
          `*(Note: These are initial merchant suggestions. Live AI-driven predictive demand modeling will activate once the AI backend is connected!)*`,
        actionHint: onNavigateTab ? { label: "Explore Products", tab: "products" } : undefined,
      };
    }

    // ── Topic E: Store / Dashboard Suggestions & Improvements ──
    if (
      q.includes("how can i improve") ||
      q.includes("suggest improvements") ||
      q.includes("what should i improve") ||
      q.includes("suggestions") ||
      q.includes("store tips") ||
      q.includes("improve my store") ||
      q.includes("optimize store")
    ) {
      const suggestions: string[] = [];

      if (!logoUrl) {
        suggestions.push("🎨 Upload a Brand Logo in Settings to personalize your navigation header.");
      }
      if (!bannerUrl) {
        suggestions.push("🖼️ Add a Store Banner in Settings to give your public storefront visual depth.");
      }
      if (!shopAddress) {
        suggestions.push("📍 Set your Store Address in Settings with Google Maps geolocation for customer trust.");
      }
      if (products.length < 3) {
        suggestions.push(`📦 Expand your catalog: You currently have ${products.length} product(s). Adding 4–6 items creates a richer buyer experience.`);
      }

      const lowStockCount = products.filter((p) => p.stock < 5).length;
      if (lowStockCount > 0) {
        suggestions.push(`⚠️ Restock ${lowStockCount} product(s) marked with low-stock warnings.`);
      }

      suggestions.push("🚀 Scan your store's QR code in the Deployment tab to test the mobile checkout experience firsthand.");

      return {
        text:
          `Here are actionable recommendations to optimize "${shopName}":\n\n` +
          suggestions.map((s, idx) => `${idx + 1}. ${s}`).join("\n\n") +
          `\n\nFollowing these steps ensures your public storefront converts visitors into satisfied customers!`,
        actionHint: onNavigateTab ? { label: "Open Store Settings", tab: "settings" } : undefined,
      };
    }

    // ── Topic F: Orders Assistance ──
    if (
      q.includes("order") ||
      q.includes("fulfillment") ||
      q.includes("customer order") ||
      q.includes("orders help")
    ) {
      const totalOrders = orders.length;
      const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "processing").length;

      return {
        text:
          `Order Fulfillment Status for "${shopName}":\n\n` +
          `• Total Logged Orders: ${totalOrders}\n` +
          `• Active / Pending Fulfillment: ${pendingOrders}\n\n` +
          `In the Orders tab, you can inspect customer contact info, delivery addresses, and transition statuses: Pending ➔ Processing ➔ Completed.\n` +
          `When customers checkout from your public storefront or checkout page, their orders appear in this live table automatically.`,
        actionHint: onNavigateTab ? { label: "Go to Orders Tab", tab: "orders" } : undefined,
      };
    }

    // ── Topic G: Unknown / General Questions (Frontend Demo Guardrail) ──
    return {
      text:
        "I'm currently in frontend demo mode. I can help with your dashboard, products, inventory, and store management. Real AI-powered answers will be connected in the next stage.\n\n" +
        "Try asking:\n" +
        "• 'How do I add a product?'\n" +
        "• 'How much stock do I have?'\n" +
        "• 'Suggest improvements for my store'\n" +
        "• 'Explain my dashboard'",
    };
  };

  const handleSend = (textToSend?: string) => {
    const rawQuery = textToSend || inputVal;
    const trimmed = rawQuery.trim();
    if (!trimmed || isThinking) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: trimmed,
      timestamp: getFormattedTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    setIsThinking(true);

    // Simulated local response with smooth 550ms delay
    thinkingTimeoutRef.current = setTimeout(() => {
      const responseData = generateResponse(trimmed);
      const botMsg: Message = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text: responseData.text,
        timestamp: getFormattedTime(),
        actionHint: responseData.actionHint,
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsThinking(false);
    }, 550);
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
                <span className="obsidian-ai-header-badge">Demo</span>
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
                <div className="obsidian-ai-bubble-content">{m.text}</div>
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
