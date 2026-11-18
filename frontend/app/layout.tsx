import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "./uniqlo-global.css";
import "./storefront.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { WishlistProvider } from "@/lib/wishlist";

export const metadata: Metadata = {
  title: "F.Style Store",
  description: "Cửa hàng thời trang F.Style",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <Header />
        <WishlistProvider><main className="site-main">{children}</main></WishlistProvider>
        <Footer />
      </body>
    </html>
  );
}
