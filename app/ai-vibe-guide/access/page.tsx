import { stripe } from '@/lib/stripe/stripe'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function GuideAccess({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams

  if (!session_id) {
    return (
      <section className="mt-5 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <h1 className="text-2xl font-bold text-yellow-800 mb-2">Missing Session</h1>
            <p className="text-yellow-700">Please complete checkout to access the guide.</p>
          </div>
          <Link href="/ai-vibe-guide/checkout">
            <Button variant="default">Go to Checkout</Button>
          </Link>
        </div>
      </section>
    )
  }

  const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ['line_items'] })

  if (session.status !== 'complete') {
    return (
      <section className="mt-5 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h1 className="text-2xl font-bold text-red-800 mb-2">Access Not Available</h1>
            <p className="text-red-700">Your checkout is not completed. Please finish payment to access the guide.</p>
          </div>
          <Link href="/ai-vibe-guide/checkout">
            <Button variant="outline">Return to Checkout</Button>
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="px-5 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">2025 Ultimate AI Vibe Coding Guide</h1>
          <p className="text-gray-600 mt-2">Instant Access</p>
        </div>

        <article className="prose prose-gray max-w-none">
          <h2>Chapter 1: The AI Vibe Workflow</h2>
          <p>
            Set the vibe, scaffold with precision, tighten the loop, and codify patterns. This guide
            focuses on shipping working software fast with AI as a force multiplier.
          </p>

          <h2>Chapter 2: Environment & Tooling</h2>
          <p>
            Recommended stack, prompt hygiene, code review tactics, and repeatable flows that keep AI aligned
            with your ground truth.
          </p>

          <h2>Chapter 3: Shipping Patterns</h2>
          <p>
            Pragmatic templates for CRUD, auth, integrations, background jobs, and tests—designed for fast iteration.
          </p>
        </article>

        <div className="mt-10 text-sm text-gray-600 text-center">
          <p>Bookmark this page for quick access. We&apos;ll also email you a copy.</p>
          <div className="mt-4">
            <Link href="/ai-vibe-guide" className="text-blue-700 hover:underline">
              Back to Guide Overview
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

