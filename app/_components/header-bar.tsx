"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleLogout = async () => {
    setSubmitting(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={submitting}
      className="text-blue-200 hover:text-white transition-colors text-sm disabled:opacity-50"
    >
      {submitting ? "..." : "ログアウト"}
    </button>
  );
}
