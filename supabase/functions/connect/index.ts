// Stripe Connect for payees (holders, creators, businesses/nonprofits).
// Actions: status | onboard | dashboard | cashout. The caller must be logged in.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

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

const PAGES: Record<string, string> = { holder: "/holder", creator: "/creator", business: "/advertise" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) return json({ error: "Payments are not turned on yet." }, 503);
    const stripe = async (path: string, body?: Record<string, unknown>, idem?: string) => {
      const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
      if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
      if (idem) headers["Idempotency-Key"] = idem;
      const r = await fetch(`https://api.stripe.com/v1/${path}`, { method: body ? "POST" : "GET", headers, body: body ? form(body).join("&") : undefined });
      const out = await r.json();
      if (!r.ok) throw new Error(out?.error?.message ?? "Stripe error");
      return out;
    };

    const auth = req.headers.get("Authorization") ?? "";
    const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u } = await user.auth.getUser();
    if (!u?.user) return json({ error: "Please log in." }, 401);

    const body = await req.json();
    const kind = String(body.kind);
    if (!PAGES[kind]) return json({ error: "Unknown account type." }, 400);
    const { data: owner } = await user.rpc("payout_owner", { p_kind: kind });
    if (!owner) return json({ error: "Your account isn't approved for cash-outs yet." }, 403);
    const site = Deno.env.get("SITE_URL") || req.headers.get("origin") || "https://usinit.com";

    const { data: acct } = await admin.from("payout_accounts").select("*").eq("owner_kind", kind).eq("owner_id", owner).maybeSingle();

    async function refresh(id: string) {
      const a = await stripe(`accounts/${id}`);
      const enabled = !!a.payouts_enabled && a.capabilities?.transfers === "active";
      await admin.rpc("set_payout_account", { p_kind: kind, p_owner: owner, p_account: id, p_enabled: enabled });
      return enabled;
    }

    if (body.action === "status") {
      if (acct) await refresh(acct.stripe_account_id);
      const { data } = await user.rpc("my_payout_status", { p_kind: kind });
      return json(data);
    }

    if (body.action === "onboard") {
      let id = acct?.stripe_account_id;
      if (!id) {
        const a = await stripe("accounts", {
          country: "US",
          email: u.user.email ?? undefined,
          business_type: kind === "business" ? undefined : "individual",
          controller: { fees: { payer: "application" }, losses: { payments: "application" }, stripe_dashboard: { type: "express" }, requirement_collection: "stripe" },
          capabilities: { transfers: { requested: true } },
          metadata: { usinit_kind: kind, usinit_owner: owner },
        }, `acct-${kind}-${owner}`);
        id = a.id;
        await admin.rpc("set_payout_account", { p_kind: kind, p_owner: owner, p_account: id, p_enabled: false });
      }
      const link = await stripe("account_links", {
        account: id, type: "account_onboarding",
        refresh_url: `${site}${PAGES[kind]}?stripe=refresh`, return_url: `${site}${PAGES[kind]}?stripe=done`,
      });
      return json({ url: link.url });
    }

    if (body.action === "dashboard") {
      if (!acct) return json({ error: "Set up Stripe first." }, 400);
      const l = await stripe(`accounts/${acct.stripe_account_id}/login_links`, {});
      return json({ url: l.url });
    }

    if (body.action === "cashout") {
      if (!acct) return json({ error: "Set up Stripe first." }, 400);
      if (!(await refresh(acct.stripe_account_id))) return json({ error: "Stripe still needs a few details from you. Tap 'Finish Stripe setup'." }, 400);
      const { data: c, error } = await user.rpc("begin_stripe_cashout", { p_kind: kind });
      if (error) return json({ error: error.message }, 400);
      try {
        const t = await stripe("transfers", {
          amount: c.send_cents, currency: "usd", destination: c.account,
          description: "Us In It cash-out", metadata: { usinit_cashout: c.id, usinit_kind: kind },
        }, `cashout-${c.id}`);
        await admin.rpc("finish_stripe_cashout", { p_id: c.id, p_transfer: t.id, p_ok: true });
        return json({ ok: true, amount_cents: c.send_cents, fee_cents: c.fee_cents });
      } catch (e) {
        await admin.rpc("finish_stripe_cashout", { p_id: c.id, p_transfer: null, p_ok: false, p_error: String((e as Error).message) });
        console.error("transfer failed", e);
        return json({ error: "The cash-out didn't go through, so your money is back in your balance. Us In It has been told." }, 400);
      }
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
