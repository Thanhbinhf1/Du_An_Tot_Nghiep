"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";

export default function StorefrontChrome({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname?.startsWith("/admin/");

  return (
    <>
      {!isAdmin && <Header />}
      {children}
      {!isAdmin && footer}
    </>
  );
}
