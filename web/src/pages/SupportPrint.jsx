import { Link } from 'react-router-dom'
import { SITE_URL } from '../lib/supabase'
import { SupportSign } from '../components/Printables'

// usinit.com/support/print: print the permanent Support QR sign.
export default function SupportPrint() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="no-print mb-4">
        <Link to="/support" className="font-bold underline">← Back to Support</Link>
        <h1 className="h1 mt-2">Print the Support QR</h1>
      </div>
      <SupportSign url={`${SITE_URL}/support`} />
    </div>
  )
}
