import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { money, supabase } from '../lib/supabase'
import { Notice, Spinner } from '../components/Layout'

const STORES = { walmart: 'Walmart', target: 'Target' }
const blank = () => ({ name: '', note: '', url: '', price: '', image: '', uploading: false })

// usinit.com/gifttree/signup — open to anyone. /gifttree/signup/:code — private link from Us In It or a pastor
export default function GiftSignup() {
  const code = (useParams().code || '').toUpperCase()
  const [info, setInfo] = useState(null)
  const [store, setStore] = useState('')
  const [kid, setKid] = useState({ who: 'Girl', age: '' })
  const [parent, setParent] = useState({ name: '', phone: '' })
  const [items, setItems] = useState([blank()])
  const [consent, setConsent] = useState(false)
  const [inStore, setInStore] = useState(false)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

  useEffect(() => { supabase.rpc('gift_invite_check', { p_code: code }).then(({ data }) => setInfo(data || { ok: false })) }, [code])

  const set = (i, patch) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const total = items.reduce((s, x) => s + Math.round((Number(x.price) || 0) * 100), 0)

  async function pic(i, e) {
    const f = e.target.files?.[0]; if (!f) return
    set(i, { uploading: true }); setErr(null)
    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `giftreq/${code || 'public'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(path, f, { upsert: false })
    if (error) { set(i, { uploading: false }); return setErr('That picture did not upload. Use a JPG or PNG under 5 MB.') }
    set(i, { uploading: false, image: supabase.storage.from('photos').getPublicUrl(path).data.publicUrl })
  }

  async function submit(e) {
    e.preventDefault(); setErr(null)
    if (!kid.age) return setErr("Add the child's age.")
    setBusy(true)
    const { data, error } = await supabase.rpc('submit_gift_request', {
      p_code: code || null, p_parent_name: parent.name, p_parent_phone: parent.phone,
      p_child_label: `${kid.who}, ${kid.age}`, p_store: store,
      p_items: items.map((x) => ({ name: x.name, note: x.note, url: x.url.trim(), price_cents: Math.round((Number(x.price) || 0) * 100), image: x.image })),
      p_consent: consent, p_in_store: inStore,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    setDone(data)
  }

  if (!info) return <Spinner />
  if (done) return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-10 text-center">
      <p className="text-5xl">🎄</p>
      <h1 className="h1">Got it! Thank you.</h1>
      <p>We'll look at the list and call or text you. Once it's approved, it goes on the Gift Tree so people can help fill it. Have more kids? Go back and fill out one list for each child.</p>
      <Link to="/gifttree" className="btn-orange block w-full py-4">See the Gift Tree</Link>
    </div>
  )
  if (!info.ok) return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-10 text-center">
      <p className="text-5xl">🎄</p>
      <h1 className="h1">{info.public ? 'Sign-ups are closed right now' : "This link doesn't work"}</h1>
      <p>{info.public ? 'The Gift Tree is not taking wish lists right now. Check back soon.' : "It was already used, or it isn't a real sign-up link. Ask the person who sent it to you for a new one."}</p>
      <Link to="/gifttree" className="btn-outline block w-full py-3">See the Gift Tree</Link>
    </div>
  )

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <div className="text-center">
        <p className="text-5xl">🎄</p>
        <h1 className="h1">Gift Tree wish list</h1>
        <p className="mt-2">Make a wish list for your child. People in the community help fill it, and Us In It buys the gifts. You never pay anything.</p>
      </div>

      <div className="card space-y-3">
        <h2 className="h2">1. Pick one store</h2>
        <p className="text-sm">Every item has to come from this store. Only items sold <b>in the store</b> (not online only).</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(STORES).map(([k, v]) => <button key={k} type="button" onClick={() => setStore(k)} className={store === k ? 'btn-orange py-3' : 'btn-outline py-3'}>{v}</button>)}
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="h2">2. About your child</h2>
        <Notice>Do not put your child's name or photo anywhere on this form.</Notice>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">Boy or girl</span>
            <select className="input" value={kid.who} onChange={(e) => setKid({ ...kid, who: e.target.value })}><option>Girl</option><option>Boy</option><option>Child</option></select></label>
          <label className="block"><span className="label">Age</span>
            <input className="input" inputMode="numeric" maxLength={2} value={kid.age} onChange={(e) => setKid({ ...kid, age: e.target.value.replace(/[^0-9]/g, '') })} placeholder="7" /></label>
        </div>
      </div>

      {store && (
        <div className="card space-y-4">
          <h2 className="h2">3. Wish items (up to {info.max_items})</h2>
          <p className="text-sm">For each item: open the {STORES[store]} app or website, find the item, tap <b>Share</b>, tap <b>Copy link</b>, and paste it below. Then take a screenshot of the item and add it as the picture.</p>
          {items.map((x, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
              <div className="flex items-center justify-between"><p className="font-bold">Item {i + 1}</p>
                {items.length > 1 && <button type="button" className="text-sm font-bold underline" onClick={() => setItems(items.filter((_, j) => j !== i))}>Remove</button>}</div>
              <input className="input" placeholder="What is it? (like: Winter coat)" maxLength={80} value={x.name} onChange={(e) => set(i, { name: e.target.value })} />
              <input className="input" placeholder="Size or color (optional, like: size 8, blue)" maxLength={80} value={x.note} onChange={(e) => set(i, { note: e.target.value })} />
              <input className="input" placeholder={`Paste the ${STORES[store]} link`} value={x.url} onChange={(e) => set(i, { url: e.target.value })} />
              <input className="input" inputMode="decimal" placeholder="Price ($)" value={x.price} onChange={(e) => set(i, { price: e.target.value.replace(/[^0-9.]/g, '') })} />
              <label className="block text-sm"><span className="label">Picture of the item (not your child)</span>
                <input type="file" accept="image/*" onChange={(e) => pic(i, e)} disabled={x.uploading} /></label>
              {x.uploading && <p className="text-sm">Uploading…</p>}
              {x.image && <img src={x.image} alt="Item" className="max-h-32 rounded" />}
            </div>
          ))}
          {items.length < info.max_items && <button type="button" className="btn-outline w-full" onClick={() => setItems([...items, blank()])}>+ Add another item</button>}
          <p className={`font-bold ${total > info.max_cents ? 'text-red-600' : ''}`}>Total: {money(total)} of {money(info.max_cents)} max</p>
        </div>
      )}

      <div className="card space-y-3">
        <h2 className="h2">4. You (only Us In It sees this)</h2>
        <input className="input" placeholder="Your name" maxLength={80} value={parent.name} onChange={(e) => setParent({ ...parent, name: e.target.value })} />
        <input className="input" inputMode="tel" placeholder="Your phone number" maxLength={20} value={parent.phone} onChange={(e) => setParent({ ...parent, phone: e.target.value })} />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={inStore} onChange={(e) => setInStore(e.target.checked)} />Every item is sold in the store, not online only.</label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I'm this child's parent or guardian. I give Us In It permission to post this wish list on the Gift Tree (no name, no photo of my child).</label>
      </div>

      {err && <Notice kind="error">{err}</Notice>}
      <button className="btn-orange w-full py-4 text-lg" disabled={busy || !store || items.some((x) => x.uploading)}>{busy ? 'Sending…' : 'Send my wish list'}</button>
      <p className="muted text-center text-xs">One list per child. We look at every list and call or text you before anything goes on the tree. Sending a list does not promise gifts.</p>
    </form>
  )
}
