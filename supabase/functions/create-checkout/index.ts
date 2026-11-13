import { createClient } from "npm:@supabase/supabase-js@2";

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
    const body = await req.json();
    const site = Deno.env.get("SITE_URL") || req.headers.get("origin") || "https://usinit.com";
    const kind = body.kind as string;
    const pct = Number(s.stripe_fee_pct ?? 2.9) / 100, fixed = Number(s.stripe_fee_fixed_cents ?? 30);
    const withFee = (base: number) => Math.ceil((base + fixed) / (1 - pct)); // payer covers the card fee
    const feeLine = (base: number) => ({ quantity: 1, price_data: { currency: "usd", unit_amount: withFee(base) - base, product_data: { name: "Card processing fee" } } });
    const amt = Math.round(Number(body.amount_cents));
    let session: Record<string, unknown>;

    if (kind === "tip") {
      if (!(amt >= 100 && amt <= 50000)) return json({ error: "Tip must be between $1 and $500." }, 400);
      const { data: h } = await admin.from("holders").select("id,first_name").eq("holder_code", body.holder_code).eq("status", "active").single();
      if (!h) return json({ error: "Holder not found." }, 404);
      session = {
        mode: "payment",
        line_items: s.tip_fee_model === "added_on_top"
          ? { 0: { quantity: 1, price_data: { currency: "usd", unit_amount: amt, product_data: { name: `Tip for ${h.first_name}` } } }, 1: feeLine(amt) }
          : { 0: { quantity: 1, price_data: { currency: "usd", unit_amount: amt, product_data: { name: `Tip for ${h.first_name}` } } } },
        metadata: { kind: "tip", holder_id: h.id, scan_id: body.scan_id ?? "", base_cents: amt, fee_on_top: s.tip_fee_model === "added_on_top" ? "1" : "0" },
        success_url: `${site}/thanks?type=tip&name=${encodeURIComponent(h.first_name)}`,
        cancel_url: `${site}/s/${body.holder_code}`,
      };
    } else if (kind === "gift") {
      if (!(amt >= 100 && amt <= 500000)) return json({ error: "Gift must be between $1 and $5,000." }, 400);
      session = {
        mode: "payment",
        line_items: s.gift_fee_on_top !== false
          ? { 0: { quantity: 1, price_data: { currency: "usd", unit_amount: amt, product_data: { name: "Us In It Community Fund gift" } } }, 1: feeLine(amt) }
          : { 0: { quantity: 1, price_data: { currency: "usd", unit_amount: amt, product_data: { name: "Us In It Community Fund gift" } } } },
        metadata: { kind: "gift", donor_name: String(body.donor_name ?? "").slice(0, 40), base_cents: amt, fee_on_top: s.gift_fee_on_top !== false ? "1" : "0" },
        success_url: `${site}/thanks?type=gift`,
        cancel_url: `${site}/fund`,
      };
    } else if (kind === "supporter") {
      const weekly: number[] = s.supporter_weekly_amounts ?? [500, 1000, 2000, 5000];
      const once: number[] = s.supporter_onetime_amounts ?? [5000, 10000, 20000];
      const ref = String(body.ref ?? "").slice(0, 40);
      if (body.plan_type === "weekly") {
        const weeks = Number(body.weeks);
        if (!weekly.includes(amt) || ![4, 8].includes(weeks)) return json({ error: "Pick an amount and a length." }, 400);
        const { data: plan } = await admin.from("supporter_plans").insert({ plan_type: "weekly", amount_cents: amt, weeks, referral_code: ref || null }).select("id").single();
        session = {
          mode: "subscription",
          line_items: { 0: { quantity: 1, price_data: { currency: "usd", unit_amount: amt, recurring: { interval: "week" }, product_data: { name: `Us In It Founding Supporter: $${amt / 100}/week for ${weeks} weeks` } } } },
          metadata: { kind: "supporter", plan_id: plan!.id },
          subscription_data: { metadata: { kind: "supporter", plan_id: plan!.id, weeks } },
          success_url: `${site}/thanks?type=supporter`,
          cancel_url: `${site}/support`,
        };
      } else {
        if (!once.includes(amt)) return json({ error: "Pick an amount." }, 400);
        const { data: plan } = await admin.from("supporter_plans").insert({ plan_type: "one_time", amount_cents: amt, referral_code: ref || null }).select("id").single();
        session = {
          mode: "payment",
          line_items: { 0: { quantity: 1, price_data: { currency: "usd", unit_amount: amt, product_data: { name: "Us In It Founding Supporter (one-time)" } } } },
          metadata: { kind: "supporter", plan_id: plan!.id },
          success_url: `${site}/thanks?type=supporter`,
          cancel_url: `${site}/support`,
        };
      }
    } else if (kind === "ad_deposit") {
      const auth = req.headers.get("Authorization") ?? "";
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
      const { data: u } = await userClient.auth.getUser();
      if (!u?.user) return json({ error: "Please log in." }, 401);
      const { data: adv } = await admin.from("advertisers").select("id,business_name").eq("user_id", u.user.id).single();
      if (!adv) return json({ error: "Advertiser account not found." }, 404);
      if (!(amt >= 1000 && amt <= 1000000)) return json({ error: "Add between $10 and $10,000." }, 400);
      const onTop = s.advertiser_fee_on_top !== false;
      const total = onTop ? Math.ceil((amt + fixed) / (1 - pct)) : amt;
      const fee = total - amt;
      const items: Record<string, unknown> = {
        0: { quantity: 1, price_data: { currency: "usd", unit_amount: amt, product_data: { name: "Us In It ad balance" } } },
      };
      if (onTop && fee > 0) items[1] = { quantity: 1, price_data: { currency: "usd", unit_amount: fee, product_data: { name: "Card processing fee" } } };
      session = {
        mode: "payment",
        line_items: items,
        metadata: { kind: "ad_deposit", advertiser_id: adv.id, credit_cents: amt, fee_cents: fee },
        success_url: `${site}/advertise?paid=1`,
        cancel_url: `${site}/advertise`,
      };
    } else if (kind === "love_note") {
      const { data: n } = await admin.from("workplace_notes").select("id,price_cents,paid,buyer_email,workplace_id").eq("id", body.note_id).single();
      if (!n || n.paid) return json({ error: "This note is already paid or was not found." }, 400);
      const { data: w } = await admin.from("workplaces").select("name,slug").eq("id", n.workplace_id).single();
      session = {
        mode: "payment",
        customer_email: n.buyer_email ?? undefined,
        line_items: { 0: { quantity: 1, price_data: { currency: "usd", unit_amount: n.price_cents, product_data: { name: `Love Note at ${w?.name ?? "your workplace"}` } } }, 1: feeLine(n.price_cents) },
        metadata: { kind: "love_note", note_id: n.id },
        success_url: `${site}/thanks?type=note`,
        cancel_url: `${site}/w/${w?.slug ?? ""}`,
      };
    } else if (kind === "campaign") {
      const { data: c } = await admin.from("school_campaigns").select("id,display_name,parent_email,budget_cents,election_id,status").eq("id", body.campaign_id).single();
      if (!c || ["rejected", "removed"].includes(c.status)) return json({ error: "Campaign not found." }, 404);
      const { data: e } = await admin.from("school_elections").select("cap_cents,school_id").eq("id", c.election_id).single();
      const { data: sc } = await admin.from("schools").select("slug").eq("id", e!.school_id).single();
      const room = (e?.cap_cents ?? 0) - c.budget_cents;
      if (!(amt >= 500)) return json({ error: "The smallest payment is $5." }, 400);
      if (amt > room) return json({ error: `This election's spending cap leaves $${(room / 100).toFixed(2)} for this campaign.` }, 400);
      session = {
        mode: "payment",
        customer_email: c.parent_email ?? undefined,
        line_items: { 0: { quantity: 1, price_data: { currency: "usd", unit_amount: amt, product_data: { name: `School campaign: ${c.display_name}` } } }, 1: feeLine(amt) },
        metadata: { kind: "campaign", campaign_id: c.id, credit_cents: amt },
        success_url: `${site}/thanks?type=campaign`,
        cancel_url: `${site}/school/${sc?.slug ?? ""}`,
      };
    } else if (kind === "booking_deposit") {
      const { data: b } = await admin.from("bookings").select("id,page_id,service_name,deposit_cents,deposit_status,status,customer_email,starts_at").eq("id", body.booking_id).single();
      if (!b || b.deposit_cents <= 0 || b.deposit_status !== "not_collected" || b.status !== "requested") return json({ error: "This booking doesn't need a deposit right now." }, 400);
      const { data: pg } = await admin.from("booking_pages").select("slug,title").eq("id", b.page_id).single();
      session = {
        mode: "payment",
        customer_email: b.customer_email ?? undefined,
        expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
        line_items: { 0: { quantity: 1, price_data: { currency: "usd", unit_amount: b.deposit_cents, product_data: { name: `Deposit: ${b.service_name} with ${pg?.title ?? "your booking"}` } } } },
        metadata: { kind: "booking_deposit", booking_id: b.id },
        success_url: `${site}/thanks?type=booking`,
        cancel_url: `${site}/b/${pg?.slug ?? ""}`,
      };
    } else {
      return json({ error: "Unknown payment type." }, 400);
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form(session).join("&"),
    });
    const out = await res.json();
    if (!res.ok) return json({ error: out?.error?.message ?? "Payment setup failed." }, 400);
    return json({ url: out.url });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
