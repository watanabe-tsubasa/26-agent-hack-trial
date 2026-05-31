"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Variant = "ghost" | "solid";

export function LogoutButton({ variant = "ghost" }: { variant?: Variant } = {}) {
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

  const styles =
    variant === "solid"
      ? "bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
      : "text-blue-200 hover:text-white transition-colors text-sm disabled:opacity-50";

  return (
    <button onClick={handleLogout} disabled={submitting} className={styles}>
      {submitting ? "..." : "ログアウト"}
    </button>
  );
}
