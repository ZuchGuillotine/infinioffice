export default function CallsPage() {
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
            </tr>
          </thead>
          <tbody>
            {[1,2,3].map((i) => (
              <tr key={i} className="border-t border-border">
                <td className="p-3">2025-08-08 10:{i}2</td>
                <td className="p-3">+1 (555) 123-4567</td>
                <td className="p-3">Asked about availability, booked consultation</td>
                <td className="p-3">03:14</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


