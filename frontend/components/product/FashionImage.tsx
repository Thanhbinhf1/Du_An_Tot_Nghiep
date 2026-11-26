"use client";

import Image from "next/image";
import { useState } from "react";

type Props = { src?: string; alt: string; sizes: string; eager?: boolean; fallback?: string; onUnavailable?: () => void };

function FashionImageContent({ src, alt, sizes, eager, fallback, onUnavailable }: Props) {
  const [failed, setFailed] = useState(false);
  const image = src && (/^\/(?!\/)/.test(src) || /^https?:\/\//i.test(src)) ? src : "";
  if (!image || failed) return <span className="fashion-image-placeholder">{fallback ?? "Ảnh đang cập nhật"}</span>;
  return <Image src={image} alt={alt} sizes={sizes} fill loading={eager ? "eager" : "lazy"}
    unoptimized={/^https?:/i.test(image)} onError={() => { setFailed(true); onUnavailable?.(); }} />;
}

export default function FashionImage(props: Props) {
  return <FashionImageContent key={props.src} {...props} />;
}
