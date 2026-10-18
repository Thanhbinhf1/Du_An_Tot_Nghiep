"use client";

import { AccountSidebar, AddressSettings } from "@/components/account/ProfileSettings";

export default function AddressPage() {
  return <div className="container account-page-layout"><AccountSidebar active="address" /><AddressSettings /></div>;
}
