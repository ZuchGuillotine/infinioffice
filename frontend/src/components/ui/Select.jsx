import { clsx } from 'clsx'

export default function Select({ className, children, ...props }) {
  return (
    <select
      className={clsx(
        "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}


