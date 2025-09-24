import Image from "next/image";
import { CTAJoin } from "@/components/layout/CTAJoin";
import { Footer } from "@/components/layout/Footer";

// Blog Article Layout inspired by provided reference image
// Hero image should be placed in /public/images/blog/inspirit-ai-hero.jpg (replace src below if different)
// Thumbnail images in Related Posts can be swapped later

export default function Article1() {
    return (
        <div className="min-h-screen bg-white text-neutral-900">
        {/* Top Breadcrumbs */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-6 text-sm text-neutral-500">
            <nav className="flex items-center gap-2">
            <a href="/blog" className="hover:text-neutral-800">Blog</a>
            <span>·</span>
            <a href="/blog/insights" className="hover:text-neutral-800">Insights</a>
            </nav>
        </div>

        {/* Title & Meta */}
        <header className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-4">
            <h1 className="text-3xl md:text-4xl font-semibold leading-tight tracking-tight">
            AI for Impact: Inspirit AI&apos;s Vibe Coding Training
            </h1>
            <div className="mt-4 flex items-center gap-3 text-sm text-neutral-500">
            <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-neutral-200" />
                <span className="text-neutral-800">Chinat Yu</span>
            </div>
            <span>·</span>
            <time dateTime="2025-09-24">Sep 24, 2025</time>
            <span>·</span>
            <span>5 min read</span>
            <div className="ml-auto flex items-center gap-3">
                {/* Social icons placeholders */}
                <button aria-label="Share" className="p-2 rounded-full hover:bg-neutral-100">🔗</button>
                <button aria-label="Bookmark" className="p-2 rounded-full hover:bg-neutral-100">★</button>
            </div>
            </div>
        </header>

        {/* Hero Image */}
        <div className="mx-auto mt-6 max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-neutral-100">
            {/* Replace src with your real hero image */}
            <Image src="/images/blog/inspirit-ai-hero.jpg" alt="Inspirit AI team group photo from Vibe Coding training" fill className="object-cover" />
            </div>
            <p className="mt-2 text-center text-xs text-neutral-500">Inspirit AI team after an intensive AI Vibe Coding workshop.</p>
        </div>

        {/* Article Body */}
        <article className="prose prose-neutral mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 prose-h2:mt-10 prose-h2:mb-3 prose-li:marker:text-neutral-400">
            <p>
            In a focused, small-scale professional development session, twelve team members from Inspirit AI gathered for an intensive AI Vibe Coding workshop led by Chinat Yu. The goal: explore how emerging AI tools can enhance Inspirit AI&apos;s business operations and enrich the way they teach students worldwide.
            </p>

            <h2>A Tailored Corporate Learning Experience</h2>
            <p>
            The session was intentionally designed for a high-touch, high-relevance experience. With a small cohort, every participant received direct guidance and hands-on time to build, test, and iterate. The curriculum blended AI prototyping frameworks with real educational use cases—so what people learned in the room connected immediately to Inspirit AI&apos;s programs and operations.
            </p>

            <h2>Why This Session Was Unique</h2>
            <ul>
            <li><strong>Custom-Built Curriculum.</strong> Content tailored to Inspirit AI, combining rapid AI prototyping with real-world education scenarios.</li>
            <li><strong>Hands-On, High-Touch Format.</strong> A small cohort ensured interactive support and personally relevant feedback for each participant.</li>
            <li><strong>Business & Pedagogical Relevance.</strong> Beyond technical skills, the workshop explored how AI streamlines workflows, elevates student experiences, and inspires new program offerings.</li>
            </ul>

            <h2>What Participants Learned</h2>
            <ul>
            <li>How to use AI Vibe Coding tools to quickly prototype educational applications</li>
            <li>Strategies for integrating AI into teaching without alienating non-technical learners</li>
            <li>Ways to leverage AI to scale content creation and curriculum personalization</li>
            <li>Techniques for rapid iteration and testing of new educational product ideas</li>
            </ul>

            <h2>Workshop Outcomes</h2>
            <ul>
            <li>All twelve participants successfully built functional prototypes during the session.</li>
            <li>Multiple project ideas identified for further development, including:</li>
            </ul>
            <ul>
            <li>Interactive AI tutoring assistants for Inspirit AI&apos;s programs</li>
            <li>Automated lesson plan generators tailored to different student profiles</li>
            <li>AI-driven tools for analyzing and visualizing student learning data</li>
            </ul>
            <p>
            Participants reported feeling “more confident” and “excited to integrate AI into both operations and teaching.”
            </p>

            <h2>Why It Matters for Corporate Training</h2>
            <p>
            This workshop showed that even a small, focused corporate training can create immediate value when it aligns tools and techniques with the organization&apos;s mission, gives people time to experiment in a supportive setting, and bridges business impact with student learning outcomes.
            </p>

            <h2>Facilitation</h2>
            <p>
            As facilitator, Chinat Yu guided the team through practical exercises, live demos, and end&mdash;to&mdash;end project builds—ensuring everyone left with new technical capabilities, actionable ideas, and the confidence to implement them.
            </p>

            <h2>Want Training Like This?</h2>
            <p>
            If your team is ready to explore how AI can transform business processes and educational offerings, a tailored Vibe Coding training can deliver both inspiration and tangible results in a single session.
            </p>
            <p className="not-prose">
            <a
                href="mailto:mentormates.ai"
                className="inline-flex items-center justify-center rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
            >
                Contact us: mentormates.ai
            </a>
            </p>
        </article>

        {/* Related Posts */}
        <section className="mx-auto mt-12 max-w-5xl px-4 sm:px-6 lg:px-8">
            <h3 className="text-lg font-semibold">Related Posts</h3>
            <div className="mt-4 grid gap-6 md:grid-cols-3">
            {/* Card 1 */}
            <a href="#" className="group block overflow-hidden rounded-2xl border border-neutral-200 hover:shadow-md transition-shadow">
                <div className="relative h-40 w-full bg-neutral-100">
                <Image src="/images/blog/related-1.jpg" alt="Maximizing Hackathon Success" fill className="object-cover" />
                </div>
                <div className="p-4">
                <p className="text-xs text-neutral-500">Innovation</p>
                <h4 className="mt-1 text-sm font-medium group-hover:underline">Maximizing Hackathon Success</h4>
                <p className="mt-2 line-clamp-2 text-sm text-neutral-600">Gain strategies to supercharge your hackathon experiences—before, during, and after.</p>
                </div>
            </a>

            {/* Card 2 */}
            <a href="#" className="group block overflow-hidden rounded-2xl border border-neutral-200 hover:shadow-md transition-shadow">
                <div className="relative h-40 w-full bg-neutral-100">
                <Image src="/images/blog/related-2.jpg" alt="The Future of Game Jams" fill className="object-cover" />
                </div>
                <div className="p-4">
                <p className="text-xs text-neutral-500">Tech & Making</p>
                <h4 className="mt-1 text-sm font-medium group-hover:underline">The Future of Game Jams</h4>
                <p className="mt-2 line-clamp-2 text-sm text-neutral-600">Explore emerging tools in fast&mdash;paced, collaborative build events.</p>
                </div>
            </a>

            {/* Card 3 */}
            <a href="#" className="group block overflow-hidden rounded-2xl border border-neutral-200 hover:shadow-md transition-shadow">
                <div className="relative h-40 w-full bg-neutral-100">
                <Image src="/images/blog/related-3.jpg" alt="Pitch Competitions Explained" fill className="object-cover" />
                </div>
                <div className="p-4">
                <p className="text-xs text-neutral-500">Events</p>
                <h4 className="mt-1 text-sm font-medium group-hover:underline">Pitch Competitions Explained</h4>
                <p className="mt-2 line-clamp-2 text-sm text-neutral-600">Understand the essentials of successful pitches and how to prepare your team.</p>
                </div>
            </a>
            </div>
        </section>

        {/* CTA & Footer */}
        <div className="mt-16">
            <CTAJoin />
            <Footer />
        </div>
        </div>
    );
}
