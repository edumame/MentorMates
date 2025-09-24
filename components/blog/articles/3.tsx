import Image from "next/image";
import Link from "next/link";
import { LatestAside } from "@/components/blog/LatestAside";
import { CTAJoin } from "@/components/layout/CTAJoin";
import { Footer } from "@/components/layout/Footer";
import { blogContent } from "../Content";
import { LinkIcon, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Article3() {
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
            Designing the Future: The YU Challenge at PolyU&apos;s School of Design
            </h1>
            <div className="mt-4 flex items-center gap-3 text-sm text-neutral-500">
            <div className="flex items-start gap-3 w-full">
                <div className="relative h-10 w-10 rounded-full bg-neutral-200 flex-shrink-0">
                <Image src={blogContent[2].authorAvatar} alt={blogContent[2].author} fill className="object-cover rounded-full" />
                </div>
                <div className="flex flex-col">
                <span className="text-neutral-800 font-medium">{blogContent[2].author}</span>
                <div className="text-neutral-500 text-sm">
                    <time dateTime={blogContent[2].date}>{blogContent[2].date}</time>
                    <span className="mx-1">·</span>
                    <span>{blogContent[2].readTime}</span>
                </div>
                </div>
                <div className="ml-auto flex items-center gap-3 flex-end">
                {/* Social icons placeholders */}
                <Link 
                    href="/" 
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

        {/* Hero Image */}
        <div className="mx-auto mt-6 max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-100">
            <Image src="/blog/YUChallenge01.jpg" alt="YU Challenge group at PolyU School of Design" fill className="object-cover w-full h-full" />
            </div>
        </div>

        {/* Article Body */}
        <article className="prose prose-neutral mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 prose-h2:mt-10 prose-h2:mb-3 prose-li:marker:text-neutral-400">
            <h2>A First for PolyU&apos;s School of Design</h2>
            <p>
            In a landmark collaboration, Chinat Yu partnered with the <strong>School of Design at The Hong Kong Polytechnic University (PolyU)</strong> to launch the first-ever hackathon in the school&apos;s history — the <strong>YU Challenge</strong>. This milestone event brought together more than <strong>50 participants</strong>, over <strong>10 mentors</strong>, and a shared mission to merge design thinking with rapid prototyping for real-world impact.
            </p>

            {/* Inline Image 02 */}
            <div className="not-prose mx-auto mt-8 mb-8 max-w-4xl">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-100">
                <Image src="/blog/YUChallenge02.jpg" alt="Teams ideating during the YU Challenge" fill className="object-cover w-full h-full" />
            </div>
            </div>

            <h2>Why This Hackathon Was Unique</h2>
            <ul>
            <li><strong>Institutional First</strong> — As the inaugural hackathon for PolyU&apos;s School of Design, the YU Challenge set a new precedent for experiential, project-based learning within the institution.</li>
            <li><strong>Cross-Disciplinary Approach</strong> — While rooted in design, the event welcomed participants from multiple disciplines, encouraging diverse perspectives and creative problem-solving.</li>
            <li><strong>Mentor-Powered Guidance</strong> — A network of more than 10 mentors—from design experts to industry practitioners—ensured every team received expert input and feedback throughout the process.</li>
            </ul>

            {/* Inline Image 03 */}
            <div className="not-prose mx-auto mt-8 mb-8 max-w-4xl">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-100">
                <Image src="/blog/YUChallenge03.jpg" alt="Mentors guiding teams at PolyU" fill className="object-cover w-full h-full" />
            </div>
            </div>

            <h2>The Experience</h2>
            <p>
            Over an intensive sprint, participants formed <strong>eight teams</strong> to tackle challenges in areas such as human-centered product design, digital experiences for social good, sustainable design solutions, and AI-integrated concepts. The event created a space to apply design training in fast-paced, collaborative settings, building prototypes that were both imaginative and feasible.
            </p>

            <h2>Impact by the Numbers</h2>
            <ul>
            <li><strong>50+ participants</strong></li>
            <li><strong>8 project teams</strong></li>
            <li><strong>10+ mentors</strong> from academia and industry</li>
            <li><strong>100%</strong> of participants created functional or conceptual prototypes</li>
            </ul>

            {/* 3-Image Gallery Row (04–06) */}
            <div className="not-prose grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 mb-2 max-w-4xl mx-auto">
            {["/blog/YUChallenge04.jpg","/blog/YUChallenge05.jpg","/blog/YUChallenge06.jpg"].map((src, i) => (
                <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-neutral-100">
                <Image src={src} alt={`YU Challenge highlight 0${i+4}`} fill className="object-cover" />
                </div>
            ))}
            </div>
            <p className="text-xs text-neutral-500 text-center">Workshop sprints, mentor feedback, and team presentations captured across the event.</p>

            <h2>Key Project Highlights</h2>
            <ul>
            <li><strong>Sustainable Smartwear</strong> integrating eco&mdash;friendly materials with IoT capabilities.</li>
            <li><strong>Urban Mindspace</strong> an app and service design to improve mental wellness in dense city environments.</li>
            <li><strong>Design for the Differently Abled</strong> — inclusive product concepts developed with direct user input.</li>
            </ul>

            <h2>Why It Matters for Institutional Partnerships</h2>
            <p>
            The YU Challenge demonstrated how a university can amplify its educational impact by integrating <strong>hackathon culture</strong> into programs, leveraging industry mentors for real&mdash;world relevance, and encouraging students to test ideas quickly.
            </p>
            <p>
            For PolyU&apos;s School of Design, this event was a statement: design education is not just about theory — it&apos;s about creating solutions that matter.
            </p>

            <h2>Chinat Yu&apos;s Role</h2>
            <p>
            As co&mdash;organizer and lead facilitator, Yu helped shape the format, recruit mentors, and guide participants through ideation and prototyping. His experience ensured the YU Challenge delivered both an inspiring atmosphere and tangible outcomes.
            </p>

            <h2>Call to Action</h2>
            <p>
            For institutions seeking to energize academic programs with hands&mdash;on, innovation&mdash;driven experiences, the YU Challenge model at PolyU&apos;s School of Design is a blueprint worth replicating.
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

        {/* Aside + CTA + Footer */}
        <div className="mt-16">
            <LatestAside currentSlug="3" />
            <CTAJoin />
            <Footer />
        </div>
        </div>
    );
}
