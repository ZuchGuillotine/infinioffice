import { NavLink, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Button from '../../components/ui/Button.jsx'
import { useApi } from '../../hooks/useApi'
import { organizations } from '../../lib/api'

export default function DashboardLayout() {
  const { data: organization, loading: orgLoading } = useApi(organizations.get, []);
  return (
    <div className="min-h-screen grid grid-cols-12 bg-gradient-to-br from-background via-background to-secondary/10">
      <aside className="col-span-12 md:col-span-3 lg:col-span-2 border-r border-border/40 p-4 sticky top-0 h-screen hidden md:block">
        <div className="flex items-center gap-2 px-2 py-3 mb-6 gradient-ring rounded-lg">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-primary to-accent" />
          <span className="font-semibold tracking-wide">InfiniOffice</span>
        </div>
        <nav className="space-y-1">
          {navItems.map((n) => (
            <NavItem key={n.to} to={n.to} label={n.label} />
          ))}
        </nav>
        <div className="mt-8 p-4 rounded-lg neo-inset text-sm text-muted-foreground">
          Realtime SLO: <span className="text-green-400 font-medium">≤ 1.5s</span>
        </div>
      </aside>
      <main className="col-span-12 md:col-span-9 lg:col-span-10 p-6">
        <div className="glass-strong rounded-xl p-4 border border-primary/20 flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            {organization?.twilioNumber && (
              <p className="text-sm text-muted-foreground mt-1">
                InfiniOffice Number: <span className="text-primary font-medium">{organization.twilioNumber}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="glass">Status: Online</Button>
            <Button variant="gradient">New Test Call</Button>
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
      className={({ isActive }) => `block rounded-md px-3 py-2 text-sm transition-colors neo ${isActive ? 'ring-1 ring-primary/30 bg-primary/10' : 'hover:bg-white/5'}`}
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


