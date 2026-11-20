import { createClient } from "npm:@supabase/supabase-js@2";

// "Give $3": a set amount split between a holder and the Community Fund (counts toward the launch goal).
// The payer adds the card fee on top. Paid sessions are handled by stripe-webhook (metadata kind "launch_give").
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
    if (s.launch_give_on === false) return json({ error: "This way of giving is turned off right now." }, 400);
    const body = await req.json();
    const site = Deno.env.get("SITE_URL") || req.headers.get("origin") || "https://usinit.com";
    const pct = Number(s.stripe_fee_pct ?? 2.9) / 100, fixed = Number(s.stripe_fee_fixed_cents ?? 30);
    const give = Number(s.launch_give_cents ?? 300), toHolder = Math.min(give, Number(s.launch_give_holder_cents ?? 200));
    const total = Math.ceil((give + fixed) / (1 - pct));
    const code = String(body.holder_code ?? "").trim();
    const { data: h } = await admin.from("holders").select("id,first_name").eq("holder_code", code).eq("status", "active").maybeSingle();
    if (!h) return json({ error: "We couldn't find that holder number." }, 404);
    const session = {
      mode: "payment",
      line_items: {
        0: { quantity: 1, price_data: { currency: "usd", unit_amount: give, product_data: { name: `Give $${give / 100}: $${toHolder / 100} to ${h.first_name}, $${(give - toHolder) / 100} to launch Us In It` } } },
        1: { quantity: 1, price_data: { currency: "usd", unit_amount: total - give, product_data: { name: "Card processing fee" } } },
      },
      metadata: { kind: "launch_give", holder_id: h.id, scan_id: body.scan_id ?? "", base_cents: give, holder_cents: toHolder, ref: String(body.ref ?? "").slice(0, 12) },
      success_url: `${site}/thanks?type=tip&name=${encodeURIComponent(h.first_name)}&sid={CHECKOUT_SESSION_ID}`,
      cancel_url: body.from === "give" ? `${site}/give` : `${site}/s/${code}`,
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
