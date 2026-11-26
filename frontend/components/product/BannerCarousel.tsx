"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import FashionImage from "./FashionImage";

export type BannerSlide = { src: string; alt: string; position?: string; product?: { name: string; href: string } };

export default function BannerCarousel({ slides, label, eager = false, className = "", children }: {
  slides: BannerSlide[]; label: string; eager?: boolean; className?: string; children?: ReactNode;
}) {
  const carousel = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState<boolean>();
  const [reducedMotion, setReducedMotion] = useState(true);
  const count = slides.length;
  const current = index % (count || 1);
  const isPaused = paused ?? reducedMotion;

  useEffect(() => {
    const node = carousel.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .25 });
    if (node) observer.observe(node);
    return () => { preference.removeEventListener("change", updatePreference); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!visible || isPaused || hovered || focused || count < 2) return;
    const timer = window.setInterval(() => { if (!document.hidden) setIndex((value) => (value + 1) % count); }, 5300);
    return () => window.clearInterval(timer);
  }, [visible, isPaused, hovered, focused, count]);

  const active = slides[current];
  if (!active) return null;
  function navigate(direction: number) {
    setIndex((value) => (value + direction + count) % count);
  }

  return <div ref={carousel} className={`banner-carousel ${className}`} role="region" aria-label={label}
    onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }} onPointerLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    }}>
    <div className={`banner-slide${active.product ? " banner-slide-product" : ""}`} key={active.src}
      style={active.position ? { "--banner-position": active.position } as React.CSSProperties : undefined}>
      <div className="banner-slide-photo">
        <FashionImage src={active.src} alt={active.alt} sizes={active.product ? "55vw" : "100vw"} eager={eager} />
      </div>
      {active.product && <div className="banner-slide-copy">
        <strong>{active.product.name}</strong>
        <Link href={active.product.href} className="home-text-link">Xem chi tiết <span aria-hidden="true">↗</span></Link>
      </div>}
    </div>
    {children}
    {count > 1 && <div className="banner-controls">
      <button type="button" aria-label={`Ảnh trước của ${label}`} onClick={() => navigate(-1)}>‹</button>
      <div className="banner-dots" aria-label="Chọn ảnh" role="group">
        {slides.map((slide, i) => <button type="button" key={slide.src} aria-label={`Ảnh ${i + 1} của ${label}`}
          aria-current={i === current ? "true" : undefined} onClick={() => setIndex(i)}><span /></button>)}
      </div>
      <button type="button" aria-label={`Ảnh tiếp theo của ${label}`} onClick={() => navigate(1)}>›</button>
      <button type="button" className="banner-pause" aria-label={`${isPaused ? "Tự động chuyển" : "Tạm dừng"} ảnh ${label}`} onClick={() => setPaused(!isPaused)}>
        {isPaused ? "▶" : "Ⅱ"}
      </button>
    </div>}
  </div>;
}
