"use client";

import { AccountSidebar } from "@/components/account/ProfileSettings";
import AddressBook from "@/components/account/AddressBook";

export default function AddressPage() {
  return <div className="container account-page-layout"><AccountSidebar active="address" /><AddressBook /></div>;
}
