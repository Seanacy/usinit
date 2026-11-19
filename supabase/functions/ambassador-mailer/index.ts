// Ambassador emails (Brevo). Runs every 15 minutes from pg_cron, or "test" from Admin.
// Emails: welcome, milestone (new badge), Monday update, 2-week nudge, fund low ("Boost time"), fund high.
// Rules: at most `week_cap` emails per Ambassador per 7 days (welcome doesn't count); only to
// Ambassadors with email_updates on (welcome always); every email has a one-click unsubscribe link.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mailer-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const SITE = "https://usinit.com";
const money = (c: number) => "$" + (Math.max(0, c || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

type Amb = { id: string; name: string; slug: string; ref: string; email: string; updates: boolean; token: string; joined: string;
  badges: string[]; progress: { pct: number; new_amb: boolean; brought: boolean; weeks_hit: number; weeks: number };
  last_active: string; sent7: number; keys: string[]; last_nudge: string | null };

function layout(a: Amb, body: string, footerAddress: string) {
  const unsub = `${SITE}/unsubscribe?t=${a.token}`;
  // Plain, personal-looking email (reads like a note, so Gmail is more likely to put it in Primary).
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111">
  <div style="max-width:560px;margin:0 auto;padding:20px 16px;font-size:16px;line-height:1.55">
    ${body}
    <p style="margin-top:24px">— Jermaine, Us In It</p>
    <p style="margin-top:28px;font-size:12px;color:#777;border-top:1px solid #eee;padding-top:12px">
      You're getting this because you're an Us In It Ambassador. Ambassadors are volunteers, not employees or owners.<br>
      <a href="${unsub}" style="color:#777">Unsubscribe from Ambassador emails</a><br>
      Us In It · Many Ways Up LLC${footerAddress ? " · " + esc(footerAddress) : " · Minneapolis, MN"}
    </p>
  </div></body></html>`;
}
const btn = (href: string, text: string) => `<p><a href="${href}" style="color:#c2410c">${esc(text)}</a></p>`;
const links = (a: Amb) => ({
  page: `${SITE}/ambassadors/${a.slug}`,
  support: `${SITE}/support?ref=${a.ref}`,
  business: `${SITE}/advertise?ref=${a.ref}`,
  holder: `${SITE}/holder?ref=${a.ref}`,
  friend: `${SITE}/ambassador?ref=${a.ref}`,
});
const goalLine = (p: Amb["progress"]) => `${p.pct}% — 👥 ${p.new_amb ? "✅" : "⬜"} 💚 ${p.brought ? "✅" : "⬜"} 🔗 ${p.weeks_hit}/${p.weeks}`;

function build(kind: string, a: Amb, d: any, extra: Record<string, unknown> = {}) {
  const L = links(a);
  const name = esc(a.name);
  switch (kind) {
    case "welcome":
      return { subject: `You're in, ${a.name} 🧡`, html:
        `<p>Hi ${name},</p>
        <p><b>Welcome to the Us In It Ambassadors!</b></p>
        <p>Your page: <a href="${L.page}">${L.page}</a></p>
        <p>Your links:<br>• <a href="${L.support}">Support link</a><br>• <a href="${L.business}">Business link</a><br>• <a href="${L.holder}">Holder sign-up link</a><br>• <a href="${L.friend}">Bring a friend</a></p>
        <p><b>This month's goal:</b> bring 1 new Ambassador, bring in 1 supporter or business, and share your link every week.</p>
        <p><b>Not a handout. A paycheck.</b> Thanks for being in it.</p>${btn(L.page, "See my page")}
        <p style="font-size:14px;color:#555">To make sure our updates don't get lost, move this email to your Primary tab, or add team@usinit.com to your contacts.</p>` };
    case "milestone": {
      const what = String(extra.what ?? "a new milestone");
      return { subject: `You just hit ${what} 🎉`, html:
        `<p>Hi ${name},</p>
        <p><b>You just hit ${esc(what)}!</b></p>
        <p>Your link is bringing in real money that pays real people on our streets.</p>${btn(L.page, "See my page")}` };
    }
    case "weekly": {
      const top = (d.top as string[]).length ? (d.top as string[]).map(esc).join(", ") : "Could be you next week!";
      return { subject: "This week on Us In It", html:
        `<p>Hi ${name},</p>
        <p>Here's where things stand this week.</p>
        <p><b>Community Fund:</b> ${money(d.fund_cents)}<br><b>Ad Fund:</b> ${money(d.ad_ready_cents)}<br><b>Paid to holders this week:</b> ${money(d.paid_week_cents)}</p>
        <p><b>Your goal bar:</b> ${goalLine(a.progress)}</p>
        <p><b>Top Ambassadors this week:</b> ${top}</p>
        <p>Share your link: <a href="${L.support}">${L.support}</a></p>${btn(L.page, "See my page")}` };
    }
    case "nudge":
      return { subject: `Still in it, ${a.name}?`, html:
        `<p>Hi ${name},</p>
        <p><b>Still in it?</b></p>
        <p>It's been a couple of weeks. One share can pay someone today.</p>
        <p>Here's your link: <a href="${L.support}">${L.support}</a></p>
        <p>Reply to this email if you need anything.</p>` };
    case "fund_low":
      return { subject: "Boost time ⚡ The Community Fund is low", html:
        `<p>Hi ${name},</p>
        <p><b>Boost time ⚡</b></p>
        <p>The Community Fund is at <b>${money(d.fund_cents)}</b>. When it's low, fewer scans get paid.</p>
        <p>Share your link today: <a href="${L.support}">${L.support}</a></p>` };
    case "fund_high":
      return { subject: `We did it 🙌 The Community Fund hit ${money(d.fund_cents)}`, html:
        `<p>Hi ${name},</p>
        <p><b>We did it 🙌</b></p>
        <p>Thanks to you, the Community Fund is at <b>${money(d.fund_cents)}</b>. That's about <b>${Math.floor((d.fund_cents || 0) / 50).toLocaleString()}</b> paid scans waiting for holders.</p>${btn(L.page, "See my page")}` };
  }
  throw new Error("unknown kind " + kind);
}

async function send(to: { email: string; name: string }, subject: string, html: string, unsubUrl: string) {
  const key = Deno.env.get("BREVO_API_KEY");
  if (!key) throw new Error("BREVO_API_KEY missing");
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "Us In It", email: "team@usinit.com" },
      replyTo: { email: "team@usinit.com", name: "Us In It" },
      to: [to], subject, htmlContent: html,
      // Plain-text copy too: emails with both look more like a personal note to Gmail.
      textContent: html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, "$2: $1").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim(),
      headers: { "List-Unsubscribe": `<${unsubUrl}>` },
    }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));

    // ---------- Admin: send yourself one of each email ----------
    if (body.action === "test") {
      const auth = req.headers.get("Authorization") ?? "";
      const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
      const { data: isAdmin } = await userClient.rpc("is_admin");
      const { data: u } = await userClient.auth.getUser();
      if (isAdmin !== true || !u?.user?.email) return json({ error: "Admins only." }, 403);
      const { data: d, error } = await db.rpc("amb_mail_data");
      if (error) throw error;
      const sample: Amb = { id: "test", name: "Frank", slug: "frank", ref: "FRNK42", email: u.user.email, updates: true,
        token: "00000000-0000-0000-0000-000000000000", joined: new Date().toISOString(), badges: [],
        progress: { pct: 42, new_amb: true, brought: false, weeks_hit: 1, weeks: 4 }, last_active: "", sent7: 0, keys: [], last_nudge: null };
      const kinds = ["welcome", "milestone", "weekly", "nudge", "fund_low", "fund_high"];
      for (const k of kinds) {
        const m = build(k, sample, d, { what: "your first supporter" });
        await send({ email: u.user.email, name: "Test" }, "[TEST] " + m.subject, layout(sample, m.html, d.footer_address), `${SITE}/unsubscribe`);
      }
      return json({ ok: true, sent: kinds.length, to: u.user.email });
    }

    // ---------- Scheduled run (pg_cron) ----------
    const { data: cfg } = await db.from("app_private_cfg").select("value").eq("key", "mailer_key").single();
    if (!cfg?.value || req.headers.get("x-mailer-key") !== cfg.value) return json({ error: "Not allowed." }, 403);

    // Server-side test: send one of each email to every admin's own email address.
    if (body.action === "test_admins") {
      const { data: admins } = await db.from("admins").select("user_id");
      const { data: d, error } = await db.rpc("amb_mail_data");
      if (error) throw error;
      const sent: string[] = [];
      for (const ad of admins ?? []) {
        const { data: u } = await db.auth.admin.getUserById(ad.user_id);
        const email = u?.user?.email;
        if (!email) continue;
        const sample: Amb = { id: "test", name: "Frank", slug: "frank", ref: "FRNK42", email, updates: true,
          token: "00000000-0000-0000-0000-000000000000", joined: new Date().toISOString(), badges: [],
          progress: { pct: 42, new_amb: true, brought: false, weeks_hit: 1, weeks: 4 }, last_active: "", sent7: 0, keys: [], last_nudge: null };
        for (const k of ["welcome", "milestone", "weekly", "nudge", "fund_low", "fund_high"]) {
          const m = build(k, sample, d, { what: "your first supporter" });
          await send({ email, name: "Test" }, "[TEST] " + m.subject, layout(sample, m.html, d.footer_address), `${SITE}/unsubscribe`);
        }
        sent.push(email.replace(/^(.).*(@.*)$/, "$1***$2"));
      }
      return json({ ok: true, sent_to: sent });
    }

    const { data: d, error } = await db.rpc("amb_mail_data");
    if (error) throw error;
    const ambs: Amb[] = d.ambassadors || [];
    const results: string[] = [];

    // Fund alert: fire once when the fund crosses into low or high, re-arm when it's back in the middle.
    let fundKind: string | null = null;
    if (d.fund_cents < d.low_cents && d.alert_state !== "low") { fundKind = "fund_low"; await db.rpc("amb_set_alert_state", { p_state: "low" }); }
    else if (d.fund_cents >= d.high_cents && d.alert_state !== "high") { fundKind = "fund_high"; await db.rpc("amb_set_alert_state", { p_state: "high" }); }
    else if (d.fund_cents >= d.low_cents && d.fund_cents < d.high_cents && d.alert_state !== "ok") await db.rpc("amb_set_alert_state", { p_state: "ok" });
    const today = String(d.now_chicago).slice(0, 10);

    for (const a of ambs) {
      const keys = new Set(a.keys);
      let sent7 = a.sent7;
      const todo: { kind: string; key: string; extra?: Record<string, unknown> }[] = [];

      if (!keys.has("welcome:" + a.id)) todo.push({ kind: "welcome", key: "welcome:" + a.id });
      if (a.updates) {
        if (fundKind) todo.push({ kind: fundKind, key: `${fundKind}:${today}:${a.id}` });
        const newBadges = (a.badges || []).filter((b) => b !== "Launch Team" && !keys.has(`badge:${b}:${a.id}`));
        if (newBadges.length) todo.push({ kind: "milestone", key: `badge:${newBadges[0]}:${a.id}`, extra: { what: newBadges[0], more: newBadges.slice(1) } });
        if (d.dow === 1 && d.hour >= d.weekly_hour) todo.push({ kind: "weekly", key: `weekly:${d.week_start}:${a.id}` });
        const quietDays = (Date.now() - new Date(a.last_active).getTime()) / 86400000;
        const nudgeDays = a.last_nudge ? (Date.now() - new Date(a.last_nudge).getTime()) / 86400000 : 999;
        if (quietDays >= 14 && nudgeDays >= 14) todo.push({ kind: "nudge", key: `nudge:${today}:${a.id}` });
      }

      for (const t of todo) {
        if (keys.has(t.key)) continue;
        if (t.kind !== "welcome" && sent7 >= d.week_cap) continue; // over this week's limit; try again later
        const m = build(t.kind, a, d, t.extra);
        const { data: logId } = await db.rpc("amb_mail_claim", { p_amb: a.id, p_kind: t.kind, p_key: t.key, p_subject: m.subject });
        if (!logId) continue; // already claimed by another run
        try {
          await send({ email: a.email, name: a.name }, m.subject, layout(a, m.html, d.footer_address), `${SITE}/unsubscribe?t=${a.token}`);
          await db.rpc("amb_mail_done", { p_id: logId, p_ok: true });
          if (t.kind !== "welcome") sent7++;
          // Other badges earned at the same time are covered by this email.
          for (const b of (t.extra?.more as string[] | undefined) ?? []) await db.rpc("amb_mail_claim", { p_amb: a.id, p_kind: "milestone", p_key: `badge:${b}:${a.id}`, p_subject: "(covered)", p_status: "skipped" });
          results.push(`${t.kind} → ${a.name}`);
        } catch (e) {
          await db.rpc("amb_mail_done", { p_id: logId, p_ok: false, p_error: String((e as Error).message).slice(0, 500) });
        }
      }
    }
    return json({ ok: true, sent: results.length, results });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
