"use client";

import { AccountSidebar, ProfileEditForm } from "@/components/account/ProfileSettings";

export default function EditProfilePage() {
  return <div className="container account-page-layout"><AccountSidebar active="edit" /><ProfileEditForm /></div>;
}
