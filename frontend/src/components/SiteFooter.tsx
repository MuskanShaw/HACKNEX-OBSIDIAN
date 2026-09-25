import Link from "next/link";
import { content } from "@/data/content";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <span className="t-label footer-brand">{content.footer.left}</span>
      <nav className="footer-links" style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <Link href="/p1" data-cursor="link">
          Monument
        </Link>
        <Link href="/p2" data-cursor="link">
          Dashboard
        </Link>
        <a href="/p3.html" target="_blank" rel="noopener noreferrer" data-cursor="link">
          Customer Store ↗
        </a>
        <a href="/checkout.html" target="_blank" rel="noopener noreferrer" data-cursor="link">
          Checkout
        </a>
        <a href="/api/docs" target="_blank" rel="noopener noreferrer" data-cursor="link">
          Swagger API ↗
        </a>
        <Link href="/" data-cursor="link">
          Sign In
        </Link>
      </nav>
    </footer>
  );
}
