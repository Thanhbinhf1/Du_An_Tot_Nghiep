export type StorefrontHero = {
  title: string;
  accent: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
};

export const defaultStorefrontHero: StorefrontHero = {
  title: "Mặc đẹp",
  accent: "theo cách bạn.",
  description: "Trang phục dễ mặc, dễ phối, từ ngày đi làm đến cuối tuần.",
  ctaLabel: "Mua sắm ngay",
  ctaHref: "/products",
  image: "/images/banner/fstyle-editorial.webp",
};
