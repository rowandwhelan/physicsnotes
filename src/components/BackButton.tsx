"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function BackButton({ fallbackHref = "/" }: { fallbackHref?: string }) {
  const router = useRouter();

  function onClick() {
    try {
      if (typeof window !== "undefined" && window.history.length > 1) router.back();
      else router.push(fallbackHref);
    } catch {
      router.push(fallbackHref);
    }
  }

  return (
    <button onClick={onClick} className="btn" title="Go back">
      <ChevronLeft className="h-4 w-4" /> Back
    </button>
  );
}
