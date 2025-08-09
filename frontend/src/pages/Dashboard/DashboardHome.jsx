import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Card, CardContent } from '../../components/ui/Card.jsx'
import MetricCard from '../../components/ui/MetricCard.jsx'
import StatusIndicator from '../../components/ui/StatusIndicator.jsx'
import AudioVisualization from '../../components/ui/AudioVisualization.jsx'
import Button from '../../components/ui/Button.jsx'
import LoadingSpinner from '../../components/ui/LoadingSpinner.jsx'
import { useApi } from '../../hooks/useApi'
import { dashboard } from '../../lib/api'

export default function DashboardHome() {
  const location = useLocation()
  const incompleteSetup = location.state?.incompleteSetup
  const [liveCall, setLiveCall] = useState(false)
  
  // Load real data from API
  const { data: metrics, loading: metricsLoading, error: metricsError } = useApi(dashboard.getMetrics, []);
  const { data: recentCalls, loading: callsLoading } = useApi(dashboard.getRecentCalls, []);
  const { data: todaysBookings, loading: bookingsLoading } = useApi(dashboard.getTodayBookings, []);

  // Live call simulation (keep for demo purposes)
  useEffect(() => {
    const callInterval = setInterval(() => {
      setLiveCall(prev => !prev)
    }, 8000)

    return () => {
      clearInterval(callInterval)
    }
  }, [])

  return (
    <div className="space-y-8">
      {/* Incomplete Setup Warning */}
      {incompleteSetup && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-yellow-600 text-xl">⚠️</span>
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-800">Setup Incomplete</h3>
                <p className="text-sm text-yellow-700">
                  Your AI assistant isn't fully configured yet. Complete the onboarding process to start receiving calls.
                </p>
              </div>
              <Link to="/onboarding">
                <Button variant="outline" className="border-yellow-300 text-yellow-800 hover:bg-yellow-100">
                  Complete Setup
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
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
              latency={metrics?.avgLatency || 0}
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
        {metricsLoading ? (
          // Loading state
          Array.from({length: 4}).map((_, i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-muted rounded w-1/2 mb-1"></div>
              <div className="h-3 bg-muted rounded w-full"></div>
            </Card>
          ))
        ) : metricsError ? (
          // Error state
          <Card className="col-span-full p-6 border-red-200">
            <p className="text-red-600">Failed to load metrics: {metricsError.message}</p>
          </Card>
        ) : metrics ? (
          // Success state with real data
          <>
            <MetricCard
              title="Today's Calls"
              value={metrics?.todayCalls || 0}
              subvalue={`${(metrics?.todayChange || 0) > 0 ? '+' : ''}${metrics?.todayChange || 0} from yesterday`}
              trend={metrics?.todayTrend || 0}
              icon="📞"
              variant="info"
            />
            
            <MetricCard
              title="Booking Success Rate"
              value={`${metrics?.bookingRate || 0}%`}
              subvalue={`${(metrics?.bookingRate || 0) >= 85 ? 'Above' : 'Below'} target of 85%`}
              trend={metrics?.bookingTrend || 0}
              icon="🎯"
              variant={(metrics?.bookingRate || 0) >= 85 ? 'success' : 'warning'}
            />
            
            <MetricCard
              title="Avg Response Time"
              value={`${((metrics?.avgLatency || 0) / 1000).toFixed(1)}s`}
              subvalue="Target: <1.5s"
              trend={metrics?.latencyTrend || 0}
              icon="⚡"
              variant={(metrics?.avgLatency || 0) <= 1500 ? 'success' : 'warning'}
            />
            
            <MetricCard
              title="Est. Revenue"
              value={`$${(metrics?.revenue || 0).toLocaleString()}`}
              subvalue={`${(metrics?.revenueChange || 0) > 0 ? '+' : ''}$${metrics?.revenueChange || 0} today`}
              trend={metrics?.revenueTrend || 0}
              icon="💰"
              variant="success"
            />
          </>
        ) : (
          // No data state
          <Card className="col-span-full p-6">
            <p className="text-muted-foreground">No metrics available</p>
          </Card>
        )}
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-border/30">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              📊 Recent Call Activity
            </h3>
            <div className="space-y-4">
              {callsLoading ? (
                // Loading state for calls
                Array.from({length: 3}).map((_, i) => (
                  <div key={i} className="animate-pulse p-3 rounded-lg bg-background/50 border border-border/20">
                    <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </div>
                ))
              ) : recentCalls?.length ? (
                recentCalls.map((call, i) => (
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
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">No recent calls</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/30">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              📅 Today's Bookings
            </h3>
            <div className="space-y-4">
              {bookingsLoading ? (
                // Loading state for bookings
                Array.from({length: 3}).map((_, i) => (
                  <div key={i} className="animate-pulse p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-3/4"></div>
                  </div>
                ))
              ) : todaysBookings?.length ? (
                todaysBookings.map((booking, i) => (
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
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">No bookings today</p>
              )}
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

