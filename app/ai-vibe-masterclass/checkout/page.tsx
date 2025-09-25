"use client"

import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import React, { Suspense, useMemo } from 'react'
import { fetchMasterclassClientSecret } from '@/app/actions/stripe'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function CheckoutContent() {
  const options = useMemo(() => ({
    fetchClientSecret: async () => fetchMasterclassClientSecret()
  }), [])

  return (
    <div id="checkout" className='justify-center mt-2.5'>
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">Reserve Your Seat</h1>
        <p className="text-gray-600">AI Vibe Coding Masterclass</p>
      </div>
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={options}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}

export default function MasterclassCheckout() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  )
}

