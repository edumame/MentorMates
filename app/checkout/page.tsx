'use client'

import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

import { fetchClientSecret } from '../actions/stripe'
import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { EventRole } from '@/lib/types'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function CheckoutContent() {
  const searchParams = useSearchParams()
  const eventId = searchParams.get('eventId')
  const eventName = searchParams.get('eventName')
  const eventSlug = searchParams.get('eventSlug')
  const pricingTierId = searchParams.get('pricingTierId')

  useEffect(() => {
    const hydrateJoinIntent = async () => {
      if (!eventId) return;

      const pendingCheckoutRaw = localStorage.getItem('pendingEventCheckout');
      if (!pendingCheckoutRaw) return;

      let pendingCheckout: {
        eventId: string;
        eventSlug?: string;
        eventName?: string;
        pricingTierId?: string;
        role: EventRole;
        password?: string;
      } | null = null;

      try {
        pendingCheckout = JSON.parse(pendingCheckoutRaw);
      } catch (error) {
        console.error('Invalid pending checkout payload, clearing.', error);
        localStorage.removeItem('pendingEventCheckout');
        return;
      }

      if (!pendingCheckout || pendingCheckout.eventId !== eventId) {
        return;
      }

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('Failed to get session while hydrating join intent:', error);
        return;
      }

      if (!session?.user) {
        return;
      }

      const existingJoinIntentRaw = localStorage.getItem('joinEventIntent');
      if (existingJoinIntentRaw) {
        try {
          const parsedIntent = JSON.parse(existingJoinIntentRaw);
          if (
            parsedIntent?.eventId === pendingCheckout.eventId &&
            parsedIntent?.pricingTierId === pendingCheckout.pricingTierId &&
            parsedIntent?.userId === session.user.id
          ) {
            localStorage.removeItem('pendingEventCheckout');
            return;
          }
        } catch {
          // If parsing fails, we'll overwrite below.
        }
      }

      localStorage.setItem(
        'joinEventIntent',
        JSON.stringify({
          eventId: pendingCheckout.eventId,
          role: pendingCheckout.role,
          password: pendingCheckout.password,
          userId: session.user.id,
          pricingTierId: pendingCheckout.pricingTierId ?? pricingTierId ?? undefined,
        })
      );
      localStorage.removeItem('pendingEventCheckout');
    };

    hydrateJoinIntent();
  }, [eventId, pricingTierId]);

  const options = {
    fetchClientSecret: () => {
      if (eventId || eventName || eventSlug || pricingTierId) {
        return fetchClientSecret({
          eventId,
          eventName,
          eventSlug,
          pricingTierId
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