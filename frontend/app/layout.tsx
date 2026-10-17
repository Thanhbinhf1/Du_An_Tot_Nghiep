import type { Metadata } from "next";
import "./uniqlo-global.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "UNIQLO – Demo cửa hàng thời trang",
  description: "Giao diện đồ án cửa hàng thời trang",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <Header />
        <main className="site-main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
