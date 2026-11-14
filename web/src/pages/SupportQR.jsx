import { Link } from 'react-router-dom'
import { SITE_URL } from '../lib/supabase'
import { QRFullScreen } from '../components/ShareQR'

// usinit.com/qr opens straight to the big Support QR. Save it to your home screen.
export default function SupportQR() {
  return (
    <QRFullScreen
      url={`${SITE_URL}/support`}
      title="Support Us In It"
      extra={<Link to="/support" className="mt-2 font-bold underline">Open the Support page</Link>}
    />
  )
}
