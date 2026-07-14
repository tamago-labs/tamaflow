import { Share2 } from 'lucide-react'
import PlaceholderPage from './PlaceholderPage'

export function ShareablePage() {
  return (
    <PlaceholderPage
      title='Shareable'
      description='Generate a one-tap share link for any flow, chat, or session. Audience-scoped by wallet.'
      icon={Share2}
    />
  )
}

export default ShareablePage
