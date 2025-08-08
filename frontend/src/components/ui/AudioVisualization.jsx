import { useEffect, useState } from 'react'
import { clsx } from 'clsx'

export default function AudioVisualization({ 
  isActive = false, 
  className,
  barCount = 12,
  height = 'h-8'
}) {
  const [bars, setBars] = useState(Array(barCount).fill(0))

  useEffect(() => {
    if (!isActive) {
      setBars(Array(barCount).fill(0))
      return
    }

    const interval = setInterval(() => {
      setBars(prev => prev.map(() => Math.random() * 100))
    }, 150)

    return () => clearInterval(interval)
  }, [isActive, barCount])

  return (
    <div className={clsx("flex items-end gap-1 justify-center", height, className)}>
      {bars.map((height, i) => (
        <div
          key={i}
          className={clsx(
            "bg-gradient-to-t from-primary to-primary/60 transition-all duration-150 ease-out rounded-sm",
            "w-1"
          )}
          style={{
            height: isActive ? `${Math.max(height, 10)}%` : '10%',
            animationDelay: `${i * 50}ms`
          }}
        />
      ))}
    </div>
  )
}