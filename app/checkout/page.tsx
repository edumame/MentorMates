'use client'

import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider
} from '@stripe/react-stripe-js'
// "pure" does not inject Stripe.js on import, so an unreachable Stripe only
// surfaces through the handled loadStripe() promise below.
import { loadStripe } from '@stripe/stripe-js/pure'
import type { Stripe } from '@stripe/stripe-js'
import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { fetchClientSecret } from '../actions/stripe'
import { supabase } from '@/lib/supabase'

type CheckoutState =
  | { status: 'loading' }
  | { status: 'ready'; stripe: Stripe; clientSecret: string }
  | { status: 'unavailable' }
  | { status: 'error' }

let stripePromise: Promise<Stripe | null> | null = null
function getStripe() {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key) return Promise.resolve(null)
  stripePromise ||= loadStripe(key).catch(() => {
    // Allow a later retry (e.g. after a network blip).
    stripePromise = null
    return null
  })
  return stripePromise
}

function CheckoutMessage({
  title,
  description,
  backHref,
  backLabel,
}: {
  title: string
  description: string
  backHref: string
  backLabel: string
}) {
  return (
    <div role="alert" className="mx-auto mt-10 max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
      <Link href={backHref} className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
        {backLabel}
      </Link>
    </div>
  )
}

function CheckoutContent() {
  const searchParams = useSearchParams()
  const eventId = searchParams.get('eventId')
  const eventSlug = searchParams.get('eventSlug')
  const pricingTierId = searchParams.get('pricingTierId')
  // The heading uses the event's real name from the database; the eventName
  // query parameter is attacker-controllable and is not rendered (PUB-012).
  const [eventName, setEventName] = useState<string | null>(null)
  const [state, setState] = useState<CheckoutState>({ status: 'loading' })

  useEffect(() => {
    if (!eventId) return
    let active = true

    supabase
      .from('events')
      .select('event_name')
      .eq('event_id', eventId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setEventName(data?.event_name ?? null)
      })

    ;(async () => {
      const stripe = await getStripe()
      if (!stripe) {
        if (active) setState({ status: 'unavailable' })
        return
      }
      try {
        const clientSecret = await fetchClientSecret({ eventId, eventSlug, pricingTierId })
        if (active) setState({ status: 'ready', stripe, clientSecret })
      } catch (error) {
        console.error('Failed to start checkout:', error)
        if (active) setState({ status: 'error' })
      }
    })()

    return () => {
      active = false
    }
  }, [eventId, eventSlug, pricingTierId])

  if (!eventId) {
    return (
      <CheckoutMessage
        title="No event selected"
        description="Choose an event and a ticket to continue to checkout."
        backHref="/events"
        backLabel="Browse events"
      />
    )
  }

  const eventHref = `/events/${encodeURIComponent(eventSlug || eventId)}/overview`

  if (state.status === 'unavailable') {
    return (
      <CheckoutMessage
        title="Payments are temporarily unavailable"
        description="We couldn't connect to our payment provider. You have not been charged. Please try again later."
        backHref={eventHref}
        backLabel="Back to event"
      />
    )
  }

  if (state.status === 'error') {
    return (
      <CheckoutMessage
        title="We couldn't start checkout"
        description="The ticket may no longer be available, or checkout is temporarily unavailable. You have not been charged."
        backHref={eventHref}
        backLabel="Back to event"
      />
    )
  }

  return (
    <div id="checkout" className='justify-center mt-2.5'>
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">
          {eventName ? `Complete Registration for ${eventName}` : 'Complete Registration'}
        </h1>
      </div>
      {state.status === 'loading' ? (
        <p className="text-center text-sm text-gray-600" aria-live="polite">Loading checkout…</p>
      ) : (
        <EmbeddedCheckoutProvider
          stripe={state.stripe}
          options={{ clientSecret: state.clientSecret }}
        >
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      )}
    </div>
  )
}

export default function Checkout() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  )
}
