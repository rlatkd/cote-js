"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  // 하이드레이션 불일치 방지: 마운트 전에는 자리만 차지
  if (!mounted) {
    return <div className="h-9 w-9" aria-hidden />;
  }

  return (
    <button
      onClick={toggle}
      aria-label="테마 전환"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-elevated hover:text-fg"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
