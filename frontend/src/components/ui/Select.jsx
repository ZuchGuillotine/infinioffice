export default function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}


