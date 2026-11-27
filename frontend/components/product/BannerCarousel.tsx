"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { isVideoMediaUrl } from "@/lib/storefront-content";
import FashionImage from "./FashionImage";

export type BannerSlide = {
  src: string;
  alt: string;
  position?: string;
  product?: {
    name: string;
    href: string;
    description?: string;
    price?: string;
    originalPrice?: string;
    badge?: string;
  };
};

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideo = isVideoMediaUrl(active?.src);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !isVideo) return;
    if (isPaused || !visible) {
      node.pause();
    } else {
      void node.play().catch(() => { /* Autoplay may be blocked by browser policy. */ });
    }
  }, [isPaused, visible, isVideo, active?.src]);

  if (!active) return null;
  function navigate(direction: number) {
    setIndex((value) => (value + direction + count) % count);
  }

  return (
    <div
      ref={carousel}
      className={`banner-carousel ${className}`}
      role="region"
      aria-label={label}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div
        className={`banner-slide${active.product ? " banner-slide-editorial" : ""}`}
        key={`${active.src}-${current}`}
        style={active.position ? { "--banner-position": active.position } as React.CSSProperties : undefined}
      >
        <div className="banner-slide-photo">
          {isVideo ? (
            <video
              ref={videoRef}
              className="banner-slide-video"
              src={active.src}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-label={active.alt}
            />
          ) : (
            <FashionImage src={active.src} alt={active.alt} sizes="100vw" eager={eager} />
          )}
        </div>
        {active.product && (
          <Link href={active.product.href} className="banner-editorial-overlay">
            <div className="banner-editorial-copy">
              {active.product.badge && <span className="banner-editorial-badge">{active.product.badge}</span>}
              <strong>{active.product.name}</strong>
              {active.product.description && <p className="banner-editorial-desc">{active.product.description}</p>}
              {active.product.price && (
                <div className="banner-editorial-price-row">
                  <span className={`banner-editorial-price${active.product.originalPrice ? " sale" : ""}`}>
                    {active.product.price}
                  </span>
                  {active.product.originalPrice && (
                    <del className="banner-editorial-original">{active.product.originalPrice}</del>
                  )}
                </div>
              )}
              <span className="banner-editorial-link">Xem chi tiết <span aria-hidden="true">↗</span></span>
            </div>
          </Link>
        )}
      </div>
      {children}
      {count > 1 && (
        <div className="banner-controls">
          <button type="button" aria-label={`Ảnh trước của ${label}`} onClick={() => navigate(-1)}>‹</button>
          <div className="banner-dots" aria-label="Chọn ảnh" role="group">
            {slides.map((slide, i) => (
              <button
                type="button"
                key={`${slide.src}-${i}`}
                aria-label={`Ảnh ${i + 1} của ${label}`}
                aria-current={i === current ? "true" : undefined}
                onClick={() => setIndex(i)}
              >
                <span />
              </button>
            ))}
          </div>
          <button type="button" aria-label={`Ảnh tiếp theo của ${label}`} onClick={() => navigate(1)}>›</button>
          <button
            type="button"
            className="banner-pause"
            aria-label={`${isPaused ? "Tự động chuyển" : "Tạm dừng"} ảnh ${label}`}
            onClick={() => setPaused(!isPaused)}
          >
            {isPaused ? "▶" : "Ⅱ"}
          </button>
        </div>
      )}
    </div>
  );
}
