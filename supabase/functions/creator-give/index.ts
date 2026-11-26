import { createClient } from "npm:@supabase/supabase-js@2";

// Creator gift code: a follower gives a set amount ($3). $2 goes to the Community Fund, $1 to the creator.
// The payer adds the card fee on top. Paid sessions are handled by stripe-webhook (metadata kind "creator_gift").
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function form(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") out.push(...form(v as Record<string, unknown>, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) return json({ error: "Payments are not turned on yet." }, 503);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: rows } = await admin.from("settings").select("key,value");
    const s: Record<string, any> = Object.fromEntries((rows ?? []).map((r: any) => [r.key, r.value]));
    if (s.creator_gift_on === false) return json({ error: "This way of giving is turned off right now." }, 400);
    const body = await req.json();
    const site = Deno.env.get("SITE_URL") || req.headers.get("origin") || "https://usinit.com";
    const pct = Number(s.stripe_fee_pct ?? 2.9) / 100, fixed = Number(s.stripe_fee_fixed_cents ?? 30);
    const give = Number(s.creator_gift_cents ?? 300), toCreator = Math.min(give, Number(s.creator_gift_creator_cents ?? 100));
    const toFund = give - toCreator;
    const total = Math.ceil((give + fixed) / (1 - pct));
    const code = String(body.code ?? "").trim().toUpperCase();
    const { data: c } = await admin.from("creators").select("id,name,status").eq("gift_code", code).maybeSingle();
    if (!c || c.status !== "approved") return json({ error: "We couldn't find that gift code." }, 404);
    const session = {
      mode: "payment",
      line_items: {
        0: { quantity: 1, price_data: { currency: "usd", unit_amount: give, product_data: { name: `Give $${give / 100}: $${toFund / 100} to the Us In It Community Fund, $${toCreator / 100} to ${c.name}` } } },
        1: { quantity: 1, price_data: { currency: "usd", unit_amount: total - give, product_data: { name: "Card processing fee" } } },
      },
      metadata: { kind: "creator_gift", creator_id: c.id, base_cents: give, creator_cents: toCreator },
      success_url: `${site}/thanks?type=gift&sid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/g/${code}`,
    };
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form(session).join("&"),
    });
    const j = await r.json();
    if (!r.ok) return json({ error: j.error?.message ?? "Checkout failed." }, 400);
    return json({ url: j.url });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
