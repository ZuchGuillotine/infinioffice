import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { calls } from '../../lib/api'
import Button from '../../components/ui/Button.jsx'

export default function CallsPage() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    status: 'all',
    dateRange: '7d'
  })

  const { data: callsData, loading, error, refetch } = useApi(
    () => calls.list({ page, ...filters }),
    [page, filters]
  )

  function formatDuration(seconds) {
    if (!seconds) return '0:00'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  function formatDate(dateString) {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  if (loading) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Call Logs</h2>
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Caller</th>
                <th className="text-left p-3">Summary</th>
                <th className="text-left p-3">Duration</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-t border-border animate-pulse">
                  <td className="p-3"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                  <td className="p-3"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                  <td className="p-3"><div className="h-4 bg-gray-200 rounded w-48"></div></td>
                  <td className="p-3"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                  <td className="p-3"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Call Logs</h2>
        <div className="text-red-600 p-4 border border-red-200 rounded-md">
          Error loading calls: {error.message}
          <Button onClick={refetch} variant="outline" className="ml-2">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const callsList = callsData?.calls || []
  const totalPages = callsData?.totalPages || 1
  const totalCalls = callsData?.total || 0

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Call Logs</h2>
        <div className="flex gap-3 text-sm">
          <select 
            className="rounded border border-input px-3 py-1.5"
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
            <option value="failed">Failed</option>
          </select>
          <select 
            className="rounded border border-input px-3 py-1.5"
            value={filters.dateRange}
            onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {totalCalls > 0 && (
        <div className="text-sm text-muted-foreground mb-3">
          Showing {callsList.length} of {totalCalls} calls
        </div>
      )}

      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Caller</th>
              <th className="text-left p-3">Summary</th>
              <th className="text-left p-3">Duration</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {callsList.length > 0 ? (
              callsList.map((call) => (
                <tr key={call.id} className="border-t border-border hover:bg-secondary/30">
                  <td className="p-3">{formatDate(call.createdAt)}</td>
                  <td className="p-3">{call.callerNumber || 'Unknown'}</td>
                  <td className="p-3 max-w-xs truncate">
                    {call.summary || call.transcript || 'No summary available'}
                  </td>
                  <td className="p-3">{formatDuration(call.duration)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      call.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : call.status === 'failed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {call.status || 'unknown'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  <div>
                    <p>No calls found</p>
                    <p className="text-sm mt-1">
                      {filters.status !== 'all' || filters.dateRange !== 'all' 
                        ? 'Try adjusting your filters' 
                        : 'Call logs will appear here when you receive calls'
                      }
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-4">
          <Button 
            variant="outline" 
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {page} of {totalPages}
          </span>
          <Button 
            variant="outline" 
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}


