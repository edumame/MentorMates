import Image from "next/image";
import Link from "next/link";
import { LatestAside } from "@/components/blog/LatestAside";
import { CTAJoin } from "@/components/layout/CTAJoin";
import { Footer } from "@/components/layout/Footer";
import { blogContent } from "../Content";

export default function Article2() {
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
                    Shaping Future Innovators: Tencent&apos;s AI Bootcamp Empowers the Next Generation
                </h1>
                <div className="mt-4 flex items-center gap-3 text-sm text-neutral-500">
                    <div className="flex items-start gap-3 w-full">
                        <div className="relative h-10 w-10 rounded-full bg-neutral-200 flex-shrink-0">
                            <Image src={blogContent[1].authorAvatar} alt={blogContent[1].author} fill className="object-cover rounded-full" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-neutral-800 font-medium">{blogContent[1].author}</span>
                            <div className="text-neutral-500 text-sm">
                                <time dateTime={blogContent[1].date}>{blogContent[1].date}</time>
                                <span className="mx-1">·</span>
                                <span>{blogContent[1].readTime}</span>
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

            {/* Hero Image (group on stage) */}
            <div className="mx-auto mt-6 max-w-4xl px-4 sm:px-6 lg:px-8">
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-100 mb-4">
                    {/* Place your file at /public/blog/tencent01.jpg */}
                    <Image src="/blog/inspirit01.jpg" alt="Tencent AI Bootcamp cohort group photo on stage" fill className="object-cover w-full h-full" />
                </div>
            </div>

            {/* Article Body */}
            <article className="prose prose-neutral mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 prose-h2:mt-10 prose-h2:mb-3 prose-li:marker:text-neutral-400">
                <p>
                    From July 14&mdash;18, 2025, Tencent Binhai Tower in Shenzhen became a hub for youth innovation as 34 middle school students participated in the third session of the Youth Science and Technology Innovation Camp &mdash; the &quot;Future Smart Park&quot; AI Bootcamp. Hosted by the Shenzhen Institute of Education Sciences with Tencent, the program blended expert mentorship, accessible tools, and project&mdash;based learning to prepare students for an AI&mdash;driven future.
                </p>

                <h2>Top&mdash;Tier Mentorship Bridging Theory and Practice</h2>
                <p>
                    Students learned with <em>AI Playground</em>, a visual AI creation platform that let them build interactive, machine&mdash;learning powered projects without advanced coding. Industry leaders guided participants through AI fundamentals, brainstorming, and product logic. As co&mdash;organizer and facilitator, Chinat Yu supported curriculum planning, activity design, and on&mdash;site coaching to ensure each student had the resources and structure to succeed.
                </p>

                {/* Second Image: classroom wide shot */}
                <div className="not-prose mx-auto mt-8 mb-8 max-w-4xl">
                    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-100">
                        {/* Place your file at /public/blog/tencent02.jpg */}
                        <Image 
                            src="/blog/inspirit02.jpg" 
                            alt="Students prototyping with AI Playground during workshop" 
                            fill 
                            className="object-cover w-full h-full" 
                        />
                    </div>
                </div>

                <h2>Project Highlights</h2>
                <ul>
                    <li><strong>Gogogo</strong> — an intelligent travel planning system using multi&mdash;constraint algorithms for personalized itineraries and smart navigation.</li>
                    <li>AI&mdash;powered learning assistants tailored to individual student needs.</li>
                    <li>Smart campus systems integrating IoT and AI for safety and efficiency.</li>
                </ul>
                <p>
                    By demo day, students could integrate large&mdash;model plugins, third&mdash;party services, and core ML models &mdash; skills typically seen at university&mdash;level competitions.
                </p>

                <h2>Impact by the Numbers</h2>
                <ul>
                    <li>34 middle school participants</li>
                    <li>8 mentor&mdash;led teams</li>
                    <li>100% of students completed functional AI prototypes</li>
                    <li>Personalized growth portfolios tracked critical thinking, creativity, and collaboration</li>
                </ul>

                <h2>An Innovative Talent Development Model</h2>
                <p>
                    The bootcamp&apos;s &quot;one mentor per team&quot; approach paired each student group with a dedicated teacher for personalized guidance and evaluation. The model strengthened technical understanding while cultivating leadership, communication, and teamwork — the core skills of future innovators.
                </p>

                <h2>Why This Matters</h2>
                <p>
                    The &quot;Future Smart Park&quot; AI Bootcamp shows how government&mdash;enterprise collaboration can scale high&mdash;quality STEM learning. For Tencent, it proves that corporate resources can meaningfully advance youth education. For the Shenzhen Institute of Education Sciences, it advances the city&apos;s Science & Technology Innovation Education Action Plan. For students, it sparks curiosity that can grow into real&mdash;world innovation.
                </p>

                <h2>Call to Action</h2>
                <p>
                    Looking to build impactful, scalable AI learning programs for youth? Use the Tencent AI Bootcamp playbook: expert mentorship, accessible tools, and project&mdash;based learning in a high&mdash;energy, collaborative environment.
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
                <LatestAside currentSlug="2" />
                <CTAJoin />
                <Footer />
            </div>
        </div>
    );
}
