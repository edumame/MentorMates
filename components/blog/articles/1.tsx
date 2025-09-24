import Image from "next/image";
import Link from "next/link";
import { LatestAside } from "@/components/blog/LatestAside";
import { CTAJoin } from "@/components/layout/CTAJoin";
import { Footer } from "@/components/layout/Footer";
import { blogContent } from "../Content";

export default function Article1() {
    return (
        <div className="min-h-screen bg-white text-neutral-900">
        {/* Top Breadcrumbs */}
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-6 text-sm text-neutral-500">
            <nav className="flex items-center gap-2">
            <Link href="/blog" className="hover:text-neutral-800">Blog</Link>
            <span>{' > '}</span>
            <span className="text-neutral-800 font-medium">Insights</span>
            </nav>
        </div>

        {/* Title & Meta */}
        <header className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-4">
            <h1 className="text-3xl md:text-4xl font-semibold leading-tight tracking-tight">
                AI for Impact: Inspirit AI&apos;s Vibe Coding Training
            </h1>
            <div className="mt-4 flex items-center gap-3 text-sm text-neutral-500">
            <div className="flex items-start gap-3 w-full">
                <div className="relative h-10 w-10 rounded-full bg-neutral-200 flex-shrink-0">
                    <Image src={blogContent[0].authorAvatar} alt={blogContent[0].author} fill className="object-cover rounded-full" />
                </div>
                <div className="flex flex-col">
                    <span className="text-neutral-800 font-medium">{blogContent[0].author}</span>
                    <div className="text-neutral-500 text-sm">
                        <time dateTime={blogContent[0].date}>{blogContent[0].date}</time>
                        <span className="mx-1">·</span>
                        <span>{blogContent[0].readTime}</span>
                    </div>
                </div>
                <div className="ml-auto flex items-center gap-3 flex-end">
                    {/* Social icons placeholders */}
                    <button aria-label="Share" className="p-2 rounded-full hover:bg-neutral-100">🔗</button>
                    <button aria-label="Bookmark" className="p-2 rounded-full hover:bg-neutral-100">★</button>
                </div>
            </div>
            </div>
        </header>

        {/* Hero Image */}
        <div className="mx-auto mt-6 max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-100">
            {/* Replace src with your real hero image */}
            <Image src="/blog/inspirit01.jpg" alt="Inspirit AI team group photo from Vibe Coding training" fill className="object-cover w-full h-full mb-8" />
            </div>
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

            {/* Second Image */}
            <div className="not-prose mx-auto mt-8 mb-8 max-w-4xl">
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-100">
                    <Image 
                        src="/blog/inspirit02.jpg" 
                        alt="Participants engaged in hands-on AI coding session" 
                        fill 
                        className="object-cover w-full h-full" 
                    />
                </div>
            </div>

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
            Participants reported feeling &ldquo;more confident&rdquo; and &ldquo;excited to integrate AI into both operations and teaching.&rdquo;
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

        <div className="mt-16">
            <LatestAside currentSlug="1" />
            <CTAJoin />
            <Footer />
        </div>
        </div>
    );
}
