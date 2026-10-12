import Image from "next/image";
import Link from "next/link";
import { LatestAside } from "@/components/blog/LatestAside";
import { CTAJoin } from "@/components/layout/CTAJoin";
import { Footer } from "@/components/layout/Footer";
import { blogContent } from "../Content";
import { LinkIcon, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

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
                    <a 
                        href="https://mp.weixin.qq.com/s/Jfts5L9DYGAgaIm3VLfCtQ" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-neutral-700 transition-colors"
                    >
                        Shaping Future Innovators: Tencent&apos;s AI Bootcamp Empowers the Next Generation
                    </a>
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
                            <Link
                                href="https://mp.weixin.qq.com/s/Jfts5L9DYGAgaIm3VLfCtQ" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                aria-label="Share" 
                                className="rounded-full hover:text-black hover:bg-neutral-100"
                            >
                                    <LinkIcon className="w-4 h-4" />
                            </Link>
                            <Button variant="ghost" aria-label="Bookmark" className="rounded-full">
                                <Star className="w-4 h-4 hover:fill-yellow-500 hover:text-yellow-500" />
                            </Button>
                        </div>
                    </div>  
                </div>
            </header>

            {/* Hero Image (group on stage) */}
            <div className="mx-auto mt-6 max-w-4xl px-4 sm:px-6 lg:px-8">
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-100 mb-4">
                    {/* Place your file at /public/blog/tencent01.jpg */}
                    <Image src="/blog/tencent-hero.jpg" alt="Tencent AI Bootcamp cohort group photo on stage" fill className="object-cover w-full h-full" />
                </div>
            </div>

            {/* Article Body */}
            <article className="prose prose-neutral mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 prose-h2:mt-10 prose-h2:mb-3 prose-li:marker:text-neutral-400">
                <h2>Five Days of Immersive Learning at the Heart of Shenzhen</h2>
                <p>
                    From July 14&mdash;18, 2025, the Tencent Binhai Tower in Shenzhen became a hub for youth innovation as 34 middle school students participated in the third session of the 2025 Youth Science and Technology Innovation Camp &mdash; the &quot;Future Smart Park&quot; AI Bootcamp. Hosted by the Shenzhen Institute of Education Sciences, this program combined corporate expertise, academic guidance, and project&mdash;based learning to prepare students for the AI&mdash;driven future.
                </p>
                <p>
                    As one of the co&mdash;organizers, Chinat Yu played a central role in the design and creation process, ensuring that the bootcamp not only delivered technical skills but also inspired students to think critically, collaborate effectively, and approach AI as a tool for solving real&mdash;world challenges. Yu&apos;s contributions spanned curriculum planning, activity design, and on&mdash;site facilitation, making sure each student had the resources, mentorship, and structure needed to succeed.
                </p>

                <h2>Top&mdash;Tier Mentorship Bridging Theory and Practice</h2>
                <p>
                    Students learned using <em>AI Playground</em>, a visual AI creation platform that allowed them to build interactive, machine learning&mdash;powered projects without requiring advanced coding skills. Industry leaders such as Tencent&apos;s AI Playground product head, Dan Jiarui, and operations lead, Yu Deyue, guided participants through AI fundamentals, brainstorming techniques, and project logic, helping them transform ideas into viable prototypes.
                </p>
                <p>
                    Yu&apos;s facilitation ensured that the program encouraged active exploration, enabling students to design with purpose while learning the fundamentals of AI model training, API integration, and creative problem&mdash;solving.
                </p>

                {/* Second Image: classroom wide shot */}
                <div className="not-prose mx-auto mt-8 mb-8 max-w-4xl">
                    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-100">
                        {/* Place your file at /public/blog/tencent02.jpg */}
                        <Image 
                            src="/blog/ai-coding-workshop.jpg" 
                            alt="Students prototyping with AI Playground during workshop" 
                            fill 
                            className="object-cover w-full h-full" 
                        />
                    </div>
                </div>

                <h2>Project Highlights: Young Innovators in Action</h2>
                <p>
                    Over the five days, teams worked intensively on topics under &quot;Smart Education&quot; and &quot;Smart Mobility&quot;, applying AI to address everyday challenges. Final presentations showcased:
                </p>
                <ul>
                    <li><strong>Gogogo</strong> — an intelligent travel planning system using multi&mdash;constraint algorithms for personalized itineraries and smart navigation.</li>
                    <li>AI&mdash;powered learning assistants tailored to individual student needs.</li>
                    <li>Smart campus systems integrating IoT and AI for safety and efficiency.</li>
                </ul>
                <p>
                    Students demonstrated proficiency in integrating large model plugins, third&mdash;party services, and machine learning models &mdash; skills often seen at university&mdash;level competitions.
                </p>

                <h2>Impact by the Numbers</h2>
                <ul>
                    <li>34 middle school participants</li>
                    <li>8 mentor&mdash;led teams</li>
                    <li>100% of students completed functional AI prototypes</li>
                    <li>Personalized growth portfolios created for each participant, assessing skills from critical thinking to collaboration</li>
                </ul>

                <h2>Innovative Talent Development Model</h2>
                <p>
                    This bootcamp&apos;s &quot;one mentor per team&quot; model paired each student group with a dedicated teacher, enabling personalized guidance and evaluation. The approach not only strengthened technical understanding but also cultivated leadership, communication, and teamwork — all key skills for future innovators.
                </p>

                <h2>Why This Matters</h2>
                <p>
                    The &quot;Future Smart Park&quot; AI Bootcamp represents a successful government&mdash;enterprise collaboration that delivers on national education goals while inspiring a generation of tech&mdash;savvy, socially conscious students. For Tencent, it&apos;s proof that corporate resources can meaningfully advance youth STEM education. For the Shenzhen Institute of Education Sciences, it&apos;s a concrete step toward realizing the 2022&mdash;2025 Shenzhen Science and Technology Innovation Education Action Plan.
                </p>
                <p>
                    For Chinat Yu, this program was a powerful example of how thoughtful design, hands&mdash;on engagement, and tools like AI Playground can democratize AI learning for young students — sparking curiosity today that may translate into groundbreaking innovations tomorrow.
                </p>

                <h2>Call to Action</h2>
                <p>
                    If you&apos;re looking to create impactful, scalable AI learning programs for youth, the Tencent AI Bootcamp model offers a tested blueprint — combining expert mentorship, accessible tools, and project&mdash;based learning in a high&mdash;energy, collaborative environment.
                </p>
                <p className="not-prose">
                    <a
                        href="mailto:mentormates.ai"
                        className="inline-flex items-center justify-center rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                    >
                        Contact: mentormates.ai
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
