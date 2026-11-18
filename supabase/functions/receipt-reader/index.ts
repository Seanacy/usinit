// Receipt reader: admin uploads a Cash App / Venmo payment screenshot for a waiting cash-out.
// AI reads amount, recipient, status and payment ID. A clean match marks the cash-out paid;
// anything else goes to "Needs review". AI never sends money — it only reads receipts.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const norm = (s: unknown) => String(s ?? "").trim().replace(/^[$@]/, "").toLowerCase();

const PROMPT = `This is a screenshot of a Cash App or Venmo payment receipt. Read it and answer with ONLY this JSON, no other text:
{"app":"cashapp"|"venmo"|"unknown","status":"completed"|"pending"|"failed"|"unknown","amount_cents":<integer or null>,"recipient_handle":"<$cashtag or @username exactly as shown, or null>","recipient_name":"<name shown or null>","payment_id":"<transaction ID / identifier shown, or null>","date":"<date shown or null>","readable":true|false}
Rules: amount_cents is the amount sent in cents (e.g. $20.00 -> 2000). Only fill a field if you can clearly read it on the screenshot; otherwise use null. If the image is not a payment receipt, set readable to false.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: isAdmin } = await userClient.rpc("is_admin");
    if (isAdmin !== true) return json({ error: "Admins only." }, 403);
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    const reqId = String(body.request_id ?? "");
    const mediaType = String(body.media_type ?? "image/png");
    const b64 = String(body.image_base64 ?? "");
    if (!reqId || !b64) return json({ error: "Missing request or picture." }, 400);
    if (!["image/png", "image/jpeg", "image/webp"].includes(mediaType)) return json({ error: "Use a PNG or JPG screenshot." }, 400);
    if (b64.length > 11_000_000) return json({ error: "That picture is too big. Use a normal screenshot." }, 400);

    const { data: r } = await db.from("cashout_requests").select("id,amount_cents,method,handle,status").eq("id", reqId).single();
    if (!r) return json({ error: "Cash-out not found." }, 404);
    if (!["waiting", "review"].includes(r.status)) return json({ error: `This cash-out is already ${r.status}.` }, 400);

    // Save the screenshot privately as proof.
    const ext = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
    const path = `${reqId}/${Date.now()}.${ext}`;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const up = await db.storage.from("receipts").upload(path, bytes, { contentType: mediaType });
    if (up.error) return json({ error: "Couldn't save the picture. Try again." }, 500);

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ result: "no_ai", receipt_path: path });

    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("RECEIPT_MODEL") || "claude-haiku-5-5",
        max_tokens: 400,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
          { type: "text", text: PROMPT },
        ] }],
      }),
    });
    if (!ai.ok) {
      await db.rpc("admin_cashout_set_review", { p_req: reqId, p_reason: "The receipt reader couldn't run. Check it yourself.", p_receipt_path: path });
      return json({ result: "review", reason: "The receipt reader couldn't run. Check it yourself.", receipt_path: path });
    }
    const out = await ai.json();
    const text = (out.content ?? []).map((c: any) => c.text ?? "").join("");
    let read: any = {};
    try { read = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch { read = { readable: false }; }

    const problems: string[] = [];
    if (!read.readable) problems.push("Couldn't read the picture");
    if (read.app && read.app !== "unknown" && read.app !== r.method) problems.push(`Receipt is from ${read.app === "cashapp" ? "Cash App" : "Venmo"}, but they asked for ${r.method === "cashapp" ? "Cash App" : "Venmo"}`);
    if (read.status !== "completed") problems.push(read.status === "pending" ? "Payment still shows as pending" : read.status === "failed" ? "Payment shows as failed" : "Couldn't tell if the payment went through");
    if (Number(read.amount_cents) !== r.amount_cents) problems.push(`Amount on receipt ${read.amount_cents ? "$" + (read.amount_cents / 100).toFixed(2) : "not found"}, cash-out is $${(r.amount_cents / 100).toFixed(2)}`);
    if (!read.recipient_handle) problems.push("Couldn't find who it was sent to");
    else if (norm(read.recipient_handle) !== norm(r.handle)) problems.push(`Sent to ${read.recipient_handle}, but they asked for ${r.handle}`);
    if (!read.payment_id) problems.push("No payment ID found on the receipt");

    if (problems.length) {
      const reason = problems.join(" · ");
      await db.rpc("admin_cashout_set_review", { p_req: reqId, p_reason: reason, p_receipt_path: path, p_ai: read });
      return json({ result: "review", reason, read, receipt_path: path });
    }
    const { error } = await db.rpc("admin_mark_cashout_paid", { p_req: reqId, p_payment_id: String(read.payment_id), p_receipt_path: path, p_ai: read });
    if (error) {
      await db.rpc("admin_cashout_set_review", { p_req: reqId, p_reason: error.message, p_receipt_path: path, p_ai: read });
      return json({ result: "review", reason: error.message, read, receipt_path: path });
    }
    return json({ result: "paid", read, receipt_path: path });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
