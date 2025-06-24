import { redirect } from 'next/navigation'
import { stripe } from '@/lib/stripe/stripe'
import { PaymentStatusWatcher } from './payment-status-watcher'

export default async function Return({ searchParams }: { searchParams: Promise<{ session_id: string, eventSlug?: string }>   }) {
  const { session_id, eventSlug } = await searchParams

  if (!session_id)
    throw new Error('Please provide a valid session_id (`cs_test_...`)')

  const session = await stripe.checkout.sessions.retrieve(session_id, {
    expand: ['line_items', 'payment_intent']
  })

  const { status, customer_details } = session
  const customerEmail = customer_details?.email

  if (status === 'open') {
    return redirect('/')
  }

  // Instead of checking session status, we'll use the real-time watcher
  return (
    <PaymentStatusWatcher 
      sessionId={session_id}
      eventId={eventSlug}
      customerEmail={customerEmail}
    />
  )
}