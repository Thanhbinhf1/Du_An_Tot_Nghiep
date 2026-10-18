"use client";

import { AccountSidebar, PasswordSettings } from "@/components/account/ProfileSettings";

export default function PasswordPage() {
  return <div className="container account-page-layout"><AccountSidebar active="password" /><PasswordSettings /></div>;
}
