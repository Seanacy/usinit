import { NavLink } from 'react-router-dom'

// Tabs at the top of the Fund pages: Community Fund and Ad Fund.
export default function FundTabs() {
  const tab = ({ isActive }) => `flex-1 rounded-xl py-3 text-center font-extrabold ${isActive ? 'bg-orange text-ink' : 'bg-neutral-100 dark:bg-neutral-800'}`
  return (
    <div className="mb-6 flex gap-2">
      <NavLink end to="/fund" className={tab}>Community Fund</NavLink>
      <NavLink to="/fund/ads" className={tab}>Ad Fund</NavLink>
    </div>
  )
}
