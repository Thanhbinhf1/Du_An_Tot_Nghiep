export type CollectionBannerVideos = {
  newArrivals?: string;
  featured?: string;
  sale?: string;
};

export type StorefrontHero = {
  title: string;
  accent: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
  collectionVideos?: CollectionBannerVideos;
};

export const defaultStorefrontHero: StorefrontHero = {
  title: "Mặc đẹp",
  accent: "theo cách bạn.",
  description: "Trang phục dễ mặc, dễ phối, từ ngày đi làm đến cuối tuần.",
  ctaLabel: "Mua sắm ngay",
  ctaHref: "/products",
  image: "/images/banner/fstyle-editorial.webp",
};

export function isVideoMediaUrl(url?: string | null): boolean {
  return Boolean(url && /\.(?:mp4|webm|mov)(?:\?.*)?$/i.test(url.trim()));
}
