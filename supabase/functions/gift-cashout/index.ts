// Holder cash-out through Tremendous: no ID, bank, or phone needed.
// The holder gets a link and picks a gift card, a Visa card, or Cash App/Venmo/PayPal.
// Actions: cashout (logged-in holder) | health (key check, no details).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const BASE = (Deno.env.get("TREMENDOUS_BASE") || "https://testflight.tremendous.com") + "/api/v2";
// Product types holders can pick from (gift cards, prepaid Visa/Mastercard, and money apps).
const CASHAPP_NOTE = "Your Us In It earnings. Good for Cash App: pick Instant Debit Transfer and enter your Cash App Card number, or pick Bank Transfer and use the account and routing numbers in the Money tab of Cash App. Gift cards and Visa cards have no fee.";
const KEEP = new Set(["merchant_card", "visa_card", "mastercard", "cash_app", "venmo", "paypal", "ach", "instant_debit_transfer"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const key = Deno.env.get("TREMENDOUS_API_KEY");
    if (!key) return json({ error: "Cash-outs aren't turned on yet." }, 503);
    const tre = async (path: string, body?: unknown) => {
      const r = await fetch(`${BASE}/${path}`, {
        method: body ? "POST" : "GET",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out?.errors?.message ?? JSON.stringify(out?.errors ?? out).slice(0, 300));
      return out;
    };
    const products = async () => {
      const p = await tre("products?country=US&currency=USD");
      return (p.products ?? []).filter((x: any) => KEEP.has(x.category)).map((x: any) => x.id).slice(0, 500);
    };

    const body = await req.json().catch(() => ({}));

    if (body.action === "health") {
      const ids = await products();
      return json({ ok: true, products: ids.length });
    }

    if (body.action !== "cashout") return json({ error: "Unknown action." }, 400);
    const auth = req.headers.get("Authorization") ?? "";
    const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u } = await user.auth.getUser();
    if (!u?.user) return json({ error: "Please log in." }, 401);

    const { data: c, error } = await user.rpc("begin_gift_cashout");
    if (error) return json({ error: error.message }, 400);
    try {
      const ids = await products();
      if (!ids.length) throw new Error("No payout options available");
      const order = await tre("orders", {
        external_id: c.id,
        payment: { funding_source_id: "BALANCE" },
        reward: {
          value: { denomination: c.amount_cents / 100, currency_code: "USD" },
          delivery: { method: "LINK", meta: { message: CASHAPP_NOTE } },
          recipient: { name: `${c.first_name} (Us In It #${c.holder_code})` },
          products: ids,
        },
      });
      const rw = order?.order?.rewards?.[0] ?? {};
      let link = rw?.delivery?.link ?? null;
      if (!link && rw.id) {
        const g = await tre(`rewards/${rw.id}/generate_link`, {});
        link = g?.reward?.link ?? null;
      }
      if (!link) throw new Error("No link returned");
      await admin.rpc("finish_gift_cashout", { p_id: c.id, p_ok: true, p_order: order?.order?.id ?? null, p_reward: rw.id ?? null, p_link: link, p_error: null });
      return json({ ok: true, amount_cents: c.amount_cents, link });
    } catch (e) {
      await admin.rpc("finish_gift_cashout", { p_id: c.id, p_ok: false, p_order: null, p_reward: null, p_link: null, p_error: String((e as Error).message) });
      console.error("gift cashout failed", e);
      return json({ error: "The cash-out didn't go through, so your money is back in your balance. Try again later or ask Us In It." }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
