import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { deviceId, money, supabase } from '../lib/supabase'
import { Notice, Spinner } from '../components/Layout'
import { HostSign } from '../components/Printables'
import { ContentCard } from './Scan'

const STATUS = { requested: 'waiting for them to say yes', active: 'running', paused: 'paused', declined: 'they said no', ended: 'ended' }

// ---------- Public scan page for a host code: /n/:code ----------
export function PlugScan() {
  const { code } = useParams()
  const [res, setRes] = useState(undefined)
  useEffect(() => {
    supabase.rpc('process_plug_scan', { p_code: code, p_device: deviceId() }).then(({ data }) => setRes(data || { error: 'not_found' }))
  }, [code])
  if (res === undefined) return <Spinner label="Loading your message…" />
  if (res.error) return <div className="mx-auto max-w-md px-4 py-16 text-center"><h1 className="h2">We couldn't find that code.</h1><p className="muted mt-2">It may have been taken down.</p></div>
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <ContentCard content={res.content} scanId={null} />
      <p className="mt-6 text-center text-2xl font-extrabold">Thanks for scanning. 🧡</p>
      <p className="muted mt-2 text-center text-sm">Shared through Us In It, where local groups carry each other's messages.</p>
    </div>
  )
}

// ---------- Nonprofit apply form ----------
function Apply({ plug, onDone }) {
  const [f, setF] = useState({ kind: plug.org_kind || '', ein: plug.ein || '', proof: plug.proof || '' })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  async function send(e) {
    e.preventDefault(); setErr(null); setBusy(true)
    const { error } = await supabase.rpc('apply_nonprofit', { p_kind: f.kind, p_ein: f.ein, p_proof: f.proof })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone()
  }
  return (
    <form onSubmit={send} className="space-y-3">
      <p>Are you a nonprofit? Get verified to use <b>The Plug for Nonprofits</b>: other nonprofits carry your message, and you carry theirs. Hosts earn {money(plug.host_cents)} per scan.</p>
      <input className="input" placeholder="What you do, like food shelf or harm reduction" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} />
      <input className="input" placeholder="EIN (tax ID), like 12-3456789" value={f.ein} onChange={(e) => setF({ ...f, ein: e.target.value })} />
      <input className="input" placeholder="Link to your 501(c)(3) letter or state nonprofit listing" value={f.proof} onChange={(e) => setF({ ...f, proof: e.target.value })} />
      {err && <Notice kind="error">{err}</Notice>}
      <button className="btn-orange w-full" disabled={busy}>{busy ? 'Sending…' : 'Send for verification'}</button>
    </form>
  )
}

// ---------- Outreach message form ----------
function MessageForm({ adv, existing, onDone }) {
  const [f, setF] = useState({ headline: existing?.headline || '', body: existing?.body || '', image_url: existing?.image_url || '', button_text: existing?.button_text ?? 'Learn more', button_url: existing?.button_url || '' })
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  async function save(e) {
    e.preventDefault(); setErr(null)
    if (!f.headline.trim()) return setErr('Add a headline.')
    if (f.button_url && !/^https?:\/\//i.test(f.button_url)) return setErr('The button link must start with https://')
    const row = { headline: f.headline.trim(), body: f.body.trim() || null, image_url: f.image_url.trim() || null, button_text: f.button_text.trim() || null, button_url: f.button_url.trim() || null }
    const { error } = existing
      ? await supabase.from('ads').update(row).eq('id', existing.id)
      : await supabase.from('ads').insert({ ...row, advertiser_id: adv.id, ad_type: 'outreach' })
    if (error) return setErr(error.message)
    onDone()
  }
  return (
    <form onSubmit={save} className="space-y-3 rounded-xl border border-neutral-300 p-3 dark:border-neutral-600">
      <p className="font-bold">{existing ? 'Edit your message' : 'New outreach message'}</p>
      <input className="input" maxLength={60} placeholder="Headline, like Free naloxone kits" value={f.headline} onChange={set('headline')} />
      <input className="input" maxLength={150} placeholder="One line of text, like Pick one up at 123 Main St." value={f.body} onChange={set('body')} />
      <input className="input" placeholder="Image link (optional)" value={f.image_url} onChange={set('image_url')} />
      <div className="grid grid-cols-2 gap-2">
        <input className="input" maxLength={24} placeholder="Button text" value={f.button_text} onChange={set('button_text')} />
        <input className="input" placeholder="Button link https://…" value={f.button_url} onChange={set('button_url')} />
      </div>
      <p className="muted text-xs">Every message gets a quick approval before it runs. Changing the words sends it back for approval.</p>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-outline" onClick={onDone}>Cancel</button>
        <button className="btn-orange">{existing ? 'Save changes' : 'Send for approval'}</button>
      </div>
    </form>
  )
}

function downloadReport(rows, name) {
  const csv = ['Date,Scans,Paid scans,Paid ($)', ...rows.map((r) => `${r.day},${r.scans},${r.paid_scans},${(r.paid_cents / 100).toFixed(2)}`)].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `${name.replace(/[^a-z0-9]+/gi, '-')}-scan-report.csv`
  a.click()
}
async function report(id, name) {
  const { data } = await supabase.rpc('plug_report', { p_hosting: id })
  downloadReport(data || [], name)
}

// ---------- The Plug for Nonprofits panel on the business/org page ----------
export default function PlugPanel({ adv, ads, reloadAds }) {
  const [plug, setPlug] = useState(null)
  const [orgs, setOrgs] = useState([])
  const [msgForm, setMsgForm] = useState(null) // null | 'new' | ad
  const [ask, setAsk] = useState({ host: '', ad: '', note: '' })
  const [printing, setPrinting] = useState(null)
  const [give, setGive] = useState('')
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(null)
  const load = async () => {
    const { data } = await supabase.rpc('my_plug'); setPlug(data)
    if (data?.nonprofit_status === 'approved') { const { data: o } = await supabase.rpc('list_nonprofits'); setOrgs(o || []) }
  }
  useEffect(() => { load() }, [])
  if (!plug) return <Spinner />
  const run = async (fn, args, msg) => {
    setErr(null); setOk(null)
    const { error } = await supabase.rpc(fn, args)
    if (error) return setErr(error.message)
    if (msg) setOk(msg)
    load()
  }
  const outreach = (ads || []).filter((a) => a.ad_type === 'outreach')

  if (printing) return (
    <div>
      <button className="no-print mb-4 font-bold underline" onClick={() => setPrinting(null)}>← Back</button>
      <HostSign code={printing.code} from={printing.from} />
    </div>
  )

  return (
    <div className="card space-y-4">
      <h2 className="h2">The Plug for Nonprofits</h2>

      {plug.nonprofit_status === 'none' && <Apply plug={plug} onDone={load} />}
      {plug.nonprofit_status === 'pending' && <Notice>Thanks! Us In It is checking your nonprofit proof. You'll be able to use The Plug once you're verified.</Notice>}
      {plug.nonprofit_status === 'rejected' && <><Notice kind="error">We couldn't verify your nonprofit status. Check your EIN or proof link and send it again.</Notice><Apply plug={plug} onDone={load} /></>}

      {plug.nonprofit_status === 'approved' && (
        <>
          <p className="muted">Verified nonprofit. Other nonprofits carry your message for {money(plug.scan_cents)} per scan, from your balance. You earn {money(plug.host_cents)} for every scan of a message you carry.</p>
          {err && <Notice kind="error">{err}</Notice>}
          {ok && <Notice kind="ok">{ok}</Notice>}

          {/* Earnings as a host */}
          <div className="rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800">
            <p className="muted text-sm">Your host earnings</p>
            <p className="text-3xl font-extrabold">{money(plug.host_balance_cents)}</p>
            {plug.pending_cashout
              ? <p className="mt-1 text-sm font-bold">Cash-out of {money(plug.pending_cashout.amount_cents)} requested. Us In It will send it soon.</p>
              : <p className="muted mt-1 text-sm">You can cash out once you reach {money(plug.min_cashout_cents)}.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-black py-2" disabled={!!plug.pending_cashout || plug.host_balance_cents < plug.min_cashout_cents}
                onClick={() => run('plug_request_cashout', {}, 'Cash-out requested.')}>Request cash-out</button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">Give earnings to the Community Fund (pays people on our streets):</span>
              <input className="input w-24" inputMode="decimal" placeholder="$" value={give} onChange={(e) => setGive(e.target.value.replace(/[^0-9.]/g, ''))} />
              <button className="btn-outline py-2" onClick={() => run('plug_give_to_fund', { p_cents: Math.round(Number(give) * 100) }, 'Thank you! Your gift is in the Community Fund.').then(() => setGive(''))}>Give</button>
            </div>
          </div>

          {/* Messages others carry for you */}
          <div className="space-y-2">
            <h3 className="text-lg font-extrabold">Your outreach messages</h3>
            {outreach.length === 0 && !msgForm && <p className="muted text-sm">No messages yet.</p>}
            {outreach.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
                <span><b>{a.headline}</b> <span className="muted text-sm">· {a.status === 'pending' ? 'waiting for approval' : a.status}</span></span>
                <button className="btn-black py-2" onClick={() => setMsgForm(a)}>Edit</button>
              </div>
            ))}
            {msgForm
              ? <MessageForm adv={adv} existing={msgForm === 'new' ? null : msgForm} onDone={() => { setMsgForm(null); reloadAds() }} />
              : <button className="btn-outline w-full" onClick={() => setMsgForm('new')}>New outreach message</button>}
          </div>

          {/* Ask another nonprofit to carry your message */}
          {outreach.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-extrabold">Ask a nonprofit to carry your message</h3>
              <select className="input" value={ask.ad} onChange={(e) => setAsk({ ...ask, ad: e.target.value })}>
                <option value="">Pick your message…</option>
                {outreach.map((a) => <option key={a.id} value={a.id}>{a.headline}</option>)}
              </select>
              <select className="input" value={ask.host} onChange={(e) => setAsk({ ...ask, host: e.target.value })}>
                <option value="">Pick a nonprofit…</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}{o.kind ? ` (${o.kind})` : ''}</option>)}
              </select>
              {orgs.length === 0 && <p className="muted text-sm">No other verified nonprofits yet.</p>}
              <input className="input" maxLength={200} placeholder="Short note to them (optional)" value={ask.note} onChange={(e) => setAsk({ ...ask, note: e.target.value })} />
              <button className="btn-orange w-full" disabled={!ask.ad || !ask.host}
                onClick={() => run('request_hosting', { p_host: ask.host, p_ad: ask.ad, p_note: ask.note }, 'Request sent. They choose whether to carry it.').then(() => setAsk({ host: '', ad: '', note: '' }))}>Send request</button>
            </div>
          )}

          {/* Requests and codes you carry */}
          <div className="space-y-2">
            <h3 className="text-lg font-extrabold">Messages you carry for others</h3>
            {plug.hosting.length === 0 && <p className="muted text-sm">None yet. When another nonprofit asks you, it shows up here for you to say yes or no.</p>}
            {plug.hosting.map((h) => (
              <div key={h.id} className="space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
                <p><b>{h.from}</b>: "{h.headline}"{h.body ? ` ${h.body}` : ''}</p>
                {h.note && <p className="muted text-sm">Their note: {h.note}</p>}
                <p className="text-sm font-bold">{STATUS[h.status]}{h.status !== 'requested' ? ` · ${h.scans_today} scans today · ${h.scans_total} total · you earned ${money(h.earned_cents)}` : ''}</p>
                {h.status === 'active' && !h.approved && <p className="muted text-sm">Their message is waiting for approval. Scans show it once approved.</p>}
                <div className="flex flex-wrap gap-2">
                  {h.status === 'requested' && <><button className="btn-orange py-2" onClick={() => run('respond_hosting', { p_id: h.id, p_action: 'accept' }, 'You said yes. Print the code below and post it.')}>Yes, carry it</button><button className="btn-outline py-2" onClick={() => run('respond_hosting', { p_id: h.id, p_action: 'decline' })}>No thanks</button></>}
                  {(h.status === 'active' || h.status === 'paused') && <button className="btn-black py-2" onClick={() => setPrinting(h)}>Print the code</button>}
                  {h.status === 'active' && <button className="btn-outline py-2" onClick={() => run('respond_hosting', { p_id: h.id, p_action: 'pause' })}>Pause</button>}
                  {h.status === 'paused' && <button className="btn-orange py-2" onClick={() => run('respond_hosting', { p_id: h.id, p_action: 'resume' })}>Resume</button>}
                  {['active', 'paused'].includes(h.status) && <button className="btn-outline py-2" onClick={() => confirm('Stop carrying this message for good?') && run('respond_hosting', { p_id: h.id, p_action: 'end' })}>End</button>}
                  {h.status !== 'requested' && <button className="btn-outline py-2" onClick={() => report(h.id, `${h.from} at us`)}>Download report</button>}
                </div>
              </div>
            ))}
          </div>

          {/* Where your messages are carried */}
          <div className="space-y-2">
            <h3 className="text-lg font-extrabold">Where your messages are carried</h3>
            {plug.sent.length === 0 && <p className="muted text-sm">None yet.</p>}
            {plug.sent.map((h) => (
              <div key={h.id} className="space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
                <p><b>{h.host}</b>: "{h.headline}"</p>
                <p className="text-sm font-bold">{STATUS[h.status]}{h.status !== 'requested' && h.status !== 'declined' ? ` · ${h.scans_today} scans today · ${h.scans_total} total · cost ${money(h.spent_cents)}` : ''}</p>
                <div className="flex flex-wrap gap-2">
                  {['requested', 'active', 'paused'].includes(h.status) && <button className="btn-outline py-2" onClick={() => confirm('Stop this for good?') && run('respond_hosting', { p_id: h.id, p_action: 'end' })}>End</button>}
                  {!['requested', 'declined'].includes(h.status) && <button className="btn-outline py-2" onClick={() => report(h.id, `${h.host} for us`)}>Download report (for grant reports)</button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
