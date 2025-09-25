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
    <div id="checkout" className='px-4 sm:px-6 md:px-8 mt-4 sm:mt-6'>
      <div className="mx-auto w-full max-w-md sm:max-w-lg md:max-w-3xl">
        <div className="text-center mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold">Reserve Your Seat</h1>
          <p className="text-gray-600 text-sm sm:text-base">AI Vibe Coding Masterclass</p>
        </div>
        <EmbeddedCheckoutProvider
          stripe={stripePromise}
          options={options}
        >
          <div className="rounded-xl border border-gray-200 bg-white p-2 sm:p-4 overflow-hidden">
            <EmbeddedCheckout />
          </div>
        </EmbeddedCheckoutProvider>
      </div>
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

