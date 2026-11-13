# Us In It (UsInIt.com)

Launch build: holder accounts + QR codes, scan-to-pay with Launch Openers, Community Fund + Founding Supporter plans, tips, business/event/political ads, admin.

- `web/` – React (Vite) + Tailwind website. Deploy on Vercel with **Root Directory = `web`**.
- `supabase/functions/` – Stripe checkout + webhook (Supabase Edge Functions).
- Database: Supabase project `tebmvynzkoxfmyyclbsj` ("Us In It").

Optional Vercel environment variable: `VITE_SITE_URL=https://usinit.com` (once the domain is connected, so QR codes use it).
