import { redirect } from 'next/navigation'
import { stripe } from '@/lib/stripe/stripe'
import { PostPaymentJoin } from './post-payment-join'

export default async function Return({ searchParams }: { searchParams: Promise<{ session_id: string, eventId?: string }>   }) {
  const { session_id, eventId } = await searchParams

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

  if (status === 'complete') {
    return (
      <section id="success" className="mt-5 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-green-800 mb-2">Payment Successful!</h1>
            <p className="text-green-700">
              We appreciate your business! A confirmation email will be sent to{' '}
              {customerEmail}.
            </p>
          </div>
          
          {eventId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-blue-800 mb-2">Complete Your Event Registration</h2>
              <p className="text-blue-700 mb-4">
                Your payment has been processed successfully. Click the button below to complete your event registration.
              </p>
              <PostPaymentJoin eventId={eventId} />
            </div>
          )}
          
          <div className="mt-6 text-sm text-gray-600">
            <p>If you have any questions, please email{' '}
              <a href="mailto:orders@example.com" className="text-blue-600 hover:underline">
                orders@example.com
              </a>.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return redirect('/')
}