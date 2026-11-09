import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TheFoodRelationship",
  description: "Calories, nutrients, hydration, weight and fasting — tracked with AI.",
  manifest: "/manifest.json",
  applicationName: "TheFoodRelationship",
  appleWebApp: { capable: true, title: "FoodRelation", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a1410" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
