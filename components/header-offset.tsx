"use client";

import { useEffect } from "react";

// ヘッダーの高さを --header-h に入れる（ルームの固定バーがヘッダーの下に来るように）
export function HeaderOffset() {
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const set = () => document.documentElement.style.setProperty("--header-h", `${header.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);
  return null;
}
