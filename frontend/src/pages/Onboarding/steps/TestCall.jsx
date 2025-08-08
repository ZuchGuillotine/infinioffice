import Button from '../../../components/ui/Button.jsx'

export default function TestCall() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Make a Test Call</h2>
      <p className="text-muted-foreground">We will dial your admin number, play the greeting, and record feedback.</p>
      <div className="flex gap-3">
        <Button>Dial Me Now</Button>
        <Button variant="secondary" onClick={() => (window.location.href = '/app')}>Finish</Button>
      </div>
    </div>
  )
}


