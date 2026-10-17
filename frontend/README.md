# UNIQLO-inspired frontend pages (Next.js App Router)

This package contains five route page files:

- `app/page.tsx` — homepage matching the long reference screenshot (hero, category grid, campaign banners, product strips, LifeWear Week).
- `app/cart/page.tsx` — cart.
- `app/checkout/page.tsx` — checkout.
- `app/wishlist/page.tsx` — wishlist/member area.
- `app/product/[id]/page.tsx` — product detail.

It also includes the shared header/footer, CSS, demo data and local image assets required by these pages.

## Install into an existing project

1. Back up your existing `frontend` directory.
2. Copy `app`, `components`, `data`, `types`, and `public` into your existing `frontend` directory and merge folders when prompted.
3. Keep your existing `package.json` and `tsconfig.json`.
4. Ensure `app/layout.tsx` imports `./globals.css` and renders the shared `Header` and `Footer`. The supplied layout does this; merge it with your existing layout if you need to retain metadata/fonts.
5. Run `npm run dev` from `frontend` and open `http://localhost:3000/`.

Important: `app/page.tsx` is the homepage route `/`. The wishlist is only `app/wishlist/page.tsx` and should appear at `/wishlist`, not at `/`.

Images are demo assets, not official UNIQLO photography. This is a UI starter; backend integration is not included.
