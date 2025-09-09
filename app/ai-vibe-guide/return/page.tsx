import { stripe } from '@/lib/stripe/stripe'
import Link from 'next/link'

export default async function GuideReturn({ searchParams }: { searchParams: Promise<{ session_id: string }> }) {
  const { session_id } = await searchParams

  if (!session_id) {
    throw new Error('Please provide a valid session_id (`cs_test_...`)')
  }

  const session = await stripe.checkout.sessions.retrieve(session_id, {
    expand: ['payment_intent']
  })

  const { status, customer_details } = session
  const customerEmail = customer_details?.email

  const isComplete = status === 'complete'
  const isOpen = status === 'open'
  const isExpired = status === 'expired'

  return (
    <section className="mt-5 px-5">
      <div className="max-w-2xl mx-auto text-center">
        {isComplete && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-green-800 mb-2">Payment Successful!</h1>
            <p className="text-green-700">
              Thank you! We&apos;ll email instant access to {customerEmail ?? 'your email'} shortly.
            </p>
          </div>
        )}

        {(isOpen || isExpired) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-red-800 mb-2">Payment Not Completed</h1>
            <p className="text-red-700">
              {isOpen ? 'Your checkout is still open.' : 'Your checkout session expired.'} Please try again.
            </p>
          </div>
        )}

        <div className="mt-6">
          <Link href="/ai-vibe-guide" className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition duration-200">
            Back to Guide
          </Link>
        </div>
      </div>
    </section>
  )
}

