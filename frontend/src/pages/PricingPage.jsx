import Button from '../components/ui/Button.jsx'

export default function PricingPage() {
  const tiers = [
    { name: 'Starter', price: '$299/mo', detail: 'Up to 250 calls · Ideal for small teams', cta: 'Start Pilot' },
    { name: 'Growth', price: '$899/mo', detail: 'Up to 999 calls · For scaling operations', cta: 'Start Pilot' },
    { name: 'Custom', price: 'Volume pricing', detail: 'Discounted high‑volume plans', cta: 'Contact Sales' },
  ]
  return (
    <div className="container mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold text-center mb-4">Simple, Transparent Pricing</h1>
      <p className="text-center text-muted-foreground mb-10">Choose a plan that fits your call volume.</p>
      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {tiers.map(t => (
          <div key={t.name} className="glass rounded-xl p-6 text-center">
            <div className="text-sm text-muted-foreground">{t.name}</div>
            <div className="text-3xl font-semibold mt-2">{t.price}</div>
            <div className="text-sm text-muted-foreground mt-2">{t.detail}</div>
            <Button className="mt-6 w-full">{t.cta}</Button>
          </div>
        ))}
      </div>
    </div>
  )
}


