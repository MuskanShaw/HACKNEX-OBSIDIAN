import type { Metadata } from "next";
import CustomCursor from "@/components/CustomCursor";
import "./globals.css";

export const metadata: Metadata = {
  title: "OBSIDIAN — Where Form Meets Forever",
  description:
    "OBSIDIAN transforms your physical business into a fully functional, custom digital storefront. Not a template. A monument.",
  openGraph: {
    title: "OBSIDIAN",
    description: "Where Form Meets Forever.",
    siteName: "OBSIDIAN",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      style={{ scrollBehavior: "auto" }}
    >
      <body>
        <CustomCursor />
        {children}
      </body>
    </html>
  );
}
