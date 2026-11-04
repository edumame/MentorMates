'use client'

import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

import { fetchClientSecret } from '../actions/stripe'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { EventRole } from '@/lib/types'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function CheckoutContent() {
  const searchParams = useSearchParams()
  const eventId = searchParams.get('eventId')
  const eventName = searchParams.get('eventName')
  const eventSlug = searchParams.get('eventSlug')
  const pricingTierId = searchParams.get('pricingTierId')
  const role = searchParams.get('role') as EventRole | null
  const [checkoutFailed, setCheckoutFailed] = useState(false)

  const options = {
    fetchClientSecret: async () => {
      try {
        if (eventId || eventName || eventSlug || pricingTierId) {
          return await fetchClientSecret({
            eventId,
            eventName,
            eventSlug,
            pricingTierId,
            role
          });
        }
        return await fetchClientSecret();
      } catch (error) {
        setCheckoutFailed(true);
        throw error;
      }
    }
  }

  // Server action messages are hidden in production, so this cannot name the cause.
  if (checkoutFailed) {
    return (
      <div role="alert" className='text-center mt-2.5'>
        <h1 className="text-2xl font-bold">Checkout unavailable</h1>
        <p className="mt-2">
          We could not start checkout. The event may be full or this ticket may no longer be available. You have not been charged.
        </p>
      </div>
    )
  }

  return (
    <div id="checkout" className='justify-center mt-2.5'>
      {eventName && (
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold">Complete Registration for {eventName}</h1>
        </div>
      )}
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={options}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
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