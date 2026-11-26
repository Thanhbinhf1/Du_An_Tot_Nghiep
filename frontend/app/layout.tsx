import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/playfair-display";
import "./uniqlo-global.css";
import "./storefront.css";
import Footer from "@/components/layout/Footer";
import StorefrontChrome from "@/components/layout/StorefrontChrome";
import { STORE_LOGO, STORE_NAME } from "@/lib/store-brand";
import { WishlistProvider } from "@/lib/wishlist";

export const metadata: Metadata = {
  title: STORE_NAME,
  description: `Khám phá thời trang nam, nữ, trẻ em và gợi ý phối đồ tại ${STORE_NAME}.`,
  icons: {
    apple: STORE_LOGO,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" data-scroll-behavior="smooth">
      <body>
        <StorefrontChrome footer={<Footer />}>
          <WishlistProvider><main id="store-content" className="site-main" tabIndex={-1}>{children}</main></WishlistProvider>
        </StorefrontChrome>
      </body>
    </html>
  );
}
