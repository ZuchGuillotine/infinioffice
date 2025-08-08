import { useState, useEffect } from 'react'
import { Card, CardContent } from '../../components/ui/Card.jsx'
import MetricCard from '../../components/ui/MetricCard.jsx'
import StatusIndicator from '../../components/ui/StatusIndicator.jsx'
import AudioVisualization from '../../components/ui/AudioVisualization.jsx'
import Button from '../../components/ui/Button.jsx'

export default function DashboardHome() {
  const [liveCall, setLiveCall] = useState(false)
  const [metrics, setMetrics] = useState({
    todayCalls: 28,
    avgLatency: 1240,
    bookingRate: 89,
    revenue: 2340
  })

  // Simulate live data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        todayCalls: prev.todayCalls + Math.floor(Math.random() * 2),
        avgLatency: 1200 + Math.floor(Math.random() * 200),
        bookingRate: 85 + Math.floor(Math.random() * 10)
      }))
    }, 5000)

    const callInterval = setInterval(() => {
      setLiveCall(prev => !prev)
    }, 8000)

    return () => {
      clearInterval(interval)
      clearInterval(callInterval)
    }
  }, [])

  return (
    <div className="space-y-8">
      {/* Agent Status Header */}
      <div className="glass-strong rounded-xl p-6 border border-primary/20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">AI Agent Control Center</h1>
            <p className="text-muted-foreground">Monitoring your voice assistant performance in real-time</p>
          </div>
          <div className="flex items-center gap-4">
            <StatusIndicator 
              status={liveCall ? 'processing' : 'online'} 
              latency={metrics.avgLatency}
            />
            <Button variant="outline" className="border-green-500/30 hover:border-green-500">
              🟢 Agent Online
            </Button>
          </div>
        </div>
        
        {liveCall && (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <AudioVisualization isActive={true} height="h-8" barCount={16} />
            <div>
              <p className="font-medium text-primary">Live Call in Progress</p>
              <p className="text-sm text-muted-foreground">Customer: (555) 123-4567 • Duration: 2:34</p>
            </div>
          </div>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-6">
        <MetricCard
          title="Today's Calls"
          value={metrics.todayCalls}
          subvalue="+3 from yesterday"
          trend={12}
          icon="📞"
          variant="info"
        />
        
        <MetricCard
          title="Booking Success Rate"
          value={`${metrics.bookingRate}%`}
          subvalue="Above target of 85%"
          trend={4}
          icon="🎯"
          variant="success"
        />
        
        <MetricCard
          title="Avg Response Time"
          value={`${(metrics.avgLatency / 1000).toFixed(1)}s`}
          subvalue="Target: <1.5s"
          trend={-5}
          icon="⚡"
          variant={metrics.avgLatency <= 1500 ? 'success' : 'warning'}
        />
        
        <MetricCard
          title="Revenue Captured"
          value={`$${metrics.revenue.toLocaleString()}`}
          subvalue="This month"
          trend={23}
          icon="💰"
          variant="success"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-border/30">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              📊 Recent Call Activity
            </h3>
            <div className="space-y-4">
              {recentCalls.map((call, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      call.status === 'booked' ? 'bg-green-500' : 
                      call.status === 'missed' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <div>
                      <p className="font-medium">{call.phone}</p>
                      <p className="text-sm text-muted-foreground">{call.time} • {call.duration}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium capitalize">{call.status}</p>
                    <p className="text-xs text-muted-foreground">{call.service}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/30">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              📅 Today's Bookings
            </h3>
            <div className="space-y-4">
              {todaysBookings.map((booking, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div>
                    <p className="font-medium">{booking.service}</p>
                    <p className="text-sm text-muted-foreground">{booking.time} with {booking.provider}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-primary">{booking.customer}</p>
                    <p className="text-xs text-muted-foreground">{booking.phone}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-border/30">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto p-4 flex flex-col gap-2">
              <span className="text-xl">📝</span>
              <span>Edit Scripts</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col gap-2">
              <span className="text-xl">📅</span>
              <span>Manage Calendar</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col gap-2">
              <span className="text-xl">📊</span>
              <span>View Reports</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col gap-2">
              <span className="text-xl">⚙️</span>
              <span>Settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const recentCalls = [
  { phone: '(555) 123-4567', time: '2:34 PM', duration: '3:45', status: 'booked', service: 'HVAC Repair' },
  { phone: '(555) 987-6543', time: '2:18 PM', duration: '2:12', status: 'callback', service: 'Consultation' },
  { phone: '(555) 456-7890', time: '1:52 PM', duration: '4:33', status: 'booked', service: 'Emergency Service' },
  { phone: '(555) 234-5678', time: '1:31 PM', duration: '1:28', status: 'missed', service: 'Quote Request' },
]

const todaysBookings = [
  { service: 'AC Repair', time: '3:00 PM', provider: 'Tech A', customer: 'John D.', phone: '(555) 123-4567' },
  { service: 'Furnace Check', time: '4:30 PM', provider: 'Tech B', customer: 'Sarah M.', phone: '(555) 987-6543' },
  { service: 'Emergency Call', time: '6:00 PM', provider: 'Tech A', customer: 'Mike R.', phone: '(555) 456-7890' },
]
