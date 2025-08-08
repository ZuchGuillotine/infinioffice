import { Card, CardContent } from '../../components/ui/Card.jsx'

export default function DashboardHome() {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card><CardContent><h3 className="text-sm text-muted-foreground">Routing</h3><div className="text-2xl font-semibold mt-1">Auto</div></CardContent></Card>
      <Card><CardContent><h3 className="text-sm text-muted-foreground">Today’s Calls</h3><div className="text-2xl font-semibold mt-1">12</div></CardContent></Card>
      <Card><CardContent><h3 className="text-sm text-muted-foreground">Avg Latency</h3><div className="text-2xl font-semibold mt-1">1.2s</div></CardContent></Card>
    </div>
  )
}


