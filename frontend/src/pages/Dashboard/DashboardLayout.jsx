import { NavLink, Outlet } from 'react-router-dom'
import Button from '../../components/ui/Button.jsx'

export default function DashboardLayout() {
  return (
    <div className="min-h-screen grid grid-cols-12">
      <aside className="col-span-12 md:col-span-3 lg:col-span-2 border-r border-border p-4">
        <div className="flex items-center gap-2 px-2 py-2 mb-6">
          <div className="h-6 w-6 rounded-md bg-primary" />
          <span className="font-semibold">InfiniOffice</span>
        </div>
        <nav className="space-y-1">
          {navItems.map((n) => (
            <NavItem key={n.to} to={n.to} label={n.label} />
          ))}
        </nav>
      </aside>
      <main className="col-span-12 md:col-span-9 lg:col-span-10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <div className="flex items-center gap-3">
            <Button variant="secondary">Status: Online</Button>
            <Button>New Test Call</Button>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  )
}

function NavItem({ to, label }) {
  return (
    <NavLink
      to={`/app${to}`}
      className={({ isActive }) => `block rounded-md px-3 py-2 text-sm hover:bg-white/5 ${isActive ? 'bg-white/10' : ''}`}
    >
      {label}
    </NavLink>
  )
}

const navItems = [
  { to: '', label: 'Overview' },
  { to: '/calls', label: 'Call Logs' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/configuration', label: 'Configuration' },
  { to: '/scripts', label: 'Script Studio' },
  { to: '/integrations', label: 'Integrations' },
  { to: '/billing', label: 'Billing' },
  { to: '/settings', label: 'Settings' },
]


