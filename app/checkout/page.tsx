'use client'

import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

import { fetchClientSecret } from '../actions/stripe'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function CheckoutContent() {
  const searchParams = useSearchParams()
  const eventId = searchParams.get('eventId')
  const eventName = searchParams.get('eventName')
  const stripePriceId = searchParams.get('stripePriceId')

  const options = {
    fetchClientSecret: () => {
      if (eventId || eventName || stripePriceId) {
        return fetchClientSecret({
          eventId,
          eventName,
          stripePriceId
        });
      } else {
        return fetchClientSecret();
      }
    }
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