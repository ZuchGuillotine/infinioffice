import { Link } from 'react-router-dom'
import Button from '../components/ui/Button.jsx'
import { Card, CardContent } from '../components/ui/Card.jsx'

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <GradientBackground />
      <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary" />
          <span className="font-semibold tracking-wide">InfiniOffice</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/pricing"><Button variant="ghost">Pricing</Button></Link>
          <Link to="/onboarding"><Button variant="ghost">Get Started</Button></Link>
          <Link to="/app"><Button>Sign In</Button></Link>
        </div>
      </nav>

      <header className="container mx-auto px-6 pt-20 pb-12 text-center">
        <h1 className="text-5xl md:text-6xl font-bold neon tracking-tight">
          The AI Voice Assistant for Real‑World Business
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Answer every after‑hours call. Book appointments. Capture revenue. A futuristic experience that feels effortless.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link to="/onboarding"><Button size="lg">Start Free Pilot</Button></Link>
          <a href="#features"><Button variant="secondary" size="lg">See How It Works</Button></a>
        </div>
      </header>

      <section id="features" className="container mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
        {features.map((f) => (
          <Card key={f.title}>
            <CardContent>
              <div className="text-primary mb-3">{f.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
              <p className="text-muted-foreground">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <footer className="container mx-auto px-6 py-12 text-center text-muted-foreground">
        © {new Date().getFullYear()} InfiniOffice
      </footer>
    </div>
  )
}

function GradientBackground() {
  return (
    <div className="absolute inset-0 -z-10">
      <div className="absolute -inset-[30%] rounded-full blur-3xl opacity-30" style={{
        background: 'conic-gradient(from 180deg at 50% 50%, #6366F1, #06B6D4, #22D3EE, #6366F1)'
      }} />
      <div className="grid-noise absolute inset-0 opacity-40" />
    </div>
  )
}

const features = [
  { title: 'Two‑Way Voice', desc: 'Ultra‑low latency STT‑LLM‑TTS pipeline for natural conversations.', icon: '🎙️' },
  { title: 'Calendar Booking', desc: 'Book appointments on Google or Outlook with conflict checks.', icon: '📅' },
  { title: 'After‑Hours Routing', desc: 'Smart escalation and hand‑off back to staff when needed.', icon: '🔔' },
]


