import { createClient } from "npm:@supabase/supabase-js@2";

const enc = new TextEncoder();
async function verify(raw: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"];
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 600) return false;
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`${t}.${raw}`)));
  const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && s === hex);
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return new Response("not configured", { status: 503 });
  const raw = await req.text();
  if (secret && !(await verify(raw, req.headers.get("stripe-signature") ?? "", secret))) return new Response("bad signature", { status: 400 });
  // Never trust the posted body: re-fetch the event straight from Stripe with our secret key.
  let posted: any;
  try { posted = JSON.parse(raw); } catch { return new Response("bad body", { status: 400 }); }
  if (typeof posted?.id !== "string" || !posted.id.startsWith("evt_")) return new Response("bad event", { status: 400 });
  const evRes = await fetch(`https://api.stripe.com/v1/events/${posted.id}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!evRes.ok) return new Response("unknown event", { status: 400 });
  const event = await evRes.json();

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rows } = await db.from("settings").select("key,value");
  const s: Record<string, any> = Object.fromEntries((rows ?? []).map((r: any) => [r.key, r.value]));
  const pct = Number(s.stripe_fee_pct ?? 2.9) / 100, fixed = Number(s.stripe_fee_fixed_cents ?? 30);
  const stripeFee = (gross: number) => Math.round(gross * pct) + fixed;
  const dup = (e: any) => e && e.code === "23505";

  const obj = event.data.object;

  try {
    if (event.type === "checkout.session.completed" && (obj.payment_status === "paid" || obj.mode === "subscription")) {
      const m = obj.metadata ?? {};
      const gross = obj.amount_total ?? 0;
      const email = obj.customer_details?.email ?? null;
      const name = (obj.customer_details?.name ?? "").split(" ")[0] || null;

      if (m.kind === "tip") {
        // fee_on_top: payer covered the card fee, so the holder's share is based on the tip they chose
        const onTop = m.fee_on_top === "1";
        const base = onTop ? Number(m.base_cents) : gross;
        const fee = onTop ? gross - base : stripeFee(gross);
        const platform = Math.round((base * Number(s.tip_platform_pct ?? 10)) / 100);
        const holder = Math.max(0, base - (onTop ? 0 : fee) - platform);
        const { data: tip, error } = await db.from("tips").insert({ holder_id: m.holder_id, scan_id: m.scan_id || null, amount_cents: gross, fee_cents: fee, platform_cents: platform, holder_cents: holder, stripe_session_id: obj.id, status: "paid" }).select("id").single();
        if (!dup(error) && tip) {
          await db.from("holder_ledger").insert({ holder_id: m.holder_id, amount_cents: holder, kind: "tip", ref_id: tip.id });
          await db.from("platform_ledger").insert({ amount_cents: platform, source: "tip", ref_id: tip.id });
        }
      } else if (m.kind === "gift") {
        const onTop = m.fee_on_top === "1";
        const net = onTop ? Number(m.base_cents) : gross - stripeFee(gross);
        const fee = gross - net;
        const platform = Math.round((net * Number(s.fund_gift_fee_pct ?? 10)) / 100);
        const { error } = await db.from("community_fund_transactions").insert({ amount_cents: net - platform, source: "public_gift", gross_cents: gross, fee_cents: fee, platform_cents: platform, donor_name: m.donor_name || null, stripe_ref: obj.id });
        if (!dup(error)) await db.from("platform_ledger").insert({ amount_cents: platform, source: "gift_fee" });
      } else if (m.kind === "supporter") {
        if (obj.mode === "subscription") {
          await db.from("supporter_plans").update({ status: "active", email, first_name: name, stripe_session_id: obj.id, stripe_subscription_id: obj.subscription, stripe_customer_id: obj.customer }).eq("id", m.plan_id);
          const { data: plan } = await db.from("supporter_plans").select("weeks").eq("id", m.plan_id).single();
          const weeks = plan?.weeks ?? 8;
          const cancelAt = Math.floor(Date.now() / 1000) + (weeks - 1) * 7 * 86400 + 2 * 86400;
          await fetch(`https://api.stripe.com/v1/subscriptions/${obj.subscription}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: `cancel_at=${cancelAt}&proration_behavior=none`,
          });
        } else {
          const fee = stripeFee(gross), net = gross - fee;
          const platform = Math.round((net * Number(s.supporter_fee_pct ?? 0)) / 100);
          const { error } = await db.from("community_fund_transactions").insert({ amount_cents: net - platform, source: "supporter_plan", gross_cents: gross, fee_cents: fee, platform_cents: platform, donor_name: name, stripe_ref: obj.id });
          if (!dup(error)) {
            await db.from("supporter_plans").update({ status: "paid", email, first_name: name, stripe_session_id: obj.id, payments_made: 1 }).eq("id", m.plan_id);
            if (platform > 0) await db.from("platform_ledger").insert({ amount_cents: platform, source: "supporter_fee" });
          }
        }
      } else if (m.kind === "love_note") {
        const { error } = await db.rpc("stripe_note_paid", { p_note: m.note_id, p_session: obj.id, p_gross: gross });
        if (error) throw error;
      } else if (m.kind === "campaign") {
        const { error } = await db.rpc("stripe_campaign_paid", { p_campaign: m.campaign_id, p_cents: Number(m.credit_cents), p_session: obj.id, p_gross: gross });
        if (error) throw error;
      } else if (m.kind === "booking_deposit") {
        const { error } = await db.rpc("stripe_booking_paid", { p_booking: m.booking_id, p_session: obj.id, p_gross: gross });
        if (error) throw error;
      } else if (m.kind === "ad_deposit") {
        const credit = Number(m.credit_cents);
        const { error } = await db.from("advertiser_transactions").insert({ advertiser_id: m.advertiser_id, kind: "deposit", amount_cents: credit, fee_cents: Number(m.fee_cents ?? 0), stripe_session_id: obj.id });
        if (!dup(error)) await db.rpc("credit_advertiser", { p_adv: m.advertiser_id, p_cents: credit });
      }
    } else if (event.type === "invoice.paid") {
      const meta = obj.parent?.subscription_details?.metadata ?? obj.subscription_details?.metadata ?? obj.lines?.data?.[0]?.metadata ?? {};
      if (meta.kind === "supporter" && meta.plan_id && obj.amount_paid > 0) {
        const gross = obj.amount_paid, fee = stripeFee(gross), net = gross - fee;
        const platform = Math.round((net * Number(s.supporter_fee_pct ?? 0)) / 100);
        const { data: plan } = await db.from("supporter_plans").select("first_name,payments_made").eq("id", meta.plan_id).single();
        const { error } = await db.from("community_fund_transactions").insert({ amount_cents: net - platform, source: "supporter_plan", gross_cents: gross, fee_cents: fee, platform_cents: platform, donor_name: plan?.first_name ?? null, stripe_ref: obj.id });
        if (!dup(error)) {
          await db.from("supporter_plans").update({ payments_made: (plan?.payments_made ?? 0) + 1, status: "active" }).eq("id", meta.plan_id);
          if (platform > 0) await db.from("platform_ledger").insert({ amount_cents: platform, source: "supporter_fee" });
        }
      }
    } else if (event.type === "customer.subscription.deleted") {
      const planId = obj.metadata?.plan_id;
      if (planId) {
        const { data: plan } = await db.from("supporter_plans").select("weeks,payments_made").eq("id", planId).single();
        await db.from("supporter_plans").update({ status: (plan && plan.payments_made >= (plan.weeks ?? 0)) ? "completed" : "canceled" }).eq("id", planId);
      }
    }
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
