import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CTAJoin } from "@/components/layout/CTAJoin";
import { Footer } from "@/components/layout/Footer";
import { LatestAside } from "./LatestAside";
import type { CaseStudy } from "./case-studies";

export function CaseStudyArticle({ study }: { study: CaseStudy }) {
    return (
        <div className="min-h-screen bg-white text-neutral-900">
            <div className="mx-auto max-w-5xl px-4 pt-6 text-sm text-neutral-500 sm:px-6 lg:px-8">
                <nav aria-label="Breadcrumb" className="flex items-center gap-2">
                    <Link href="/blog" className="hover:text-neutral-800">Blog</Link>
                    <span aria-hidden="true">/</span>
                    <span className="font-medium text-neutral-800">{study.category}</span>
                </nav>
            </div>

            <header className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 lg:px-8">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">
                    {study.eyebrow}
                </p>
                <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
                    {study.title}
                </h1>
                <div className="mt-5 flex items-center gap-3 text-sm text-neutral-500">
                    <Image
                        src="/testimonials/avatarFallback.png"
                        alt="Mentor Mates"
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover"
                    />
                    <div>
                        <p className="font-medium text-neutral-800">Mentor Mates</p>
                        <p><time dateTime={study.date}>{study.date}</time> · {study.readTime}</p>
                    </div>
                </div>
            </header>

            <div className="mx-auto mt-8 max-w-5xl px-4 sm:px-6 lg:px-8">
                {study.thumbnail ? (
                    <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-neutral-100">
                        <Image
                            src={study.thumbnail}
                            alt={study.heroAlt}
                            fill
                            priority
                            sizes="(min-width: 1024px) 1024px, 100vw"
                            className="object-cover"
                        />
                    </div>
                ) : (
                    <div className="flex aspect-[16/9] items-end overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-400 p-8 text-white sm:p-12">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-100">Case study</p>
                            <p className="mt-3 max-w-2xl text-2xl font-semibold leading-tight sm:text-4xl">{study.eyebrow}</p>
                        </div>
                    </div>
                )}
            </div>

            <article className="prose prose-neutral mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 prose-h2:mb-3 prose-h2:mt-12 prose-li:marker:text-blue-500">
                <p className="lead mt-10 text-xl leading-8 text-neutral-700">{study.introduction}</p>

                <div className={`not-prose my-10 grid grid-cols-1 gap-3 ${study.stats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
                    {study.stats.map((stat) => (
                        <div key={`${stat.value}-${stat.label}`} className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                            <p className="text-2xl font-semibold text-blue-700">{stat.value}</p>
                            <p className="mt-1 text-sm leading-snug text-blue-950/70">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {study.sections.map((section) => (
                    <section key={section.heading}>
                        <h2>{section.heading}</h2>
                        {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                        {section.bullets && (
                            <ul>
                                {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                            </ul>
                        )}
                        {section.image && (
                            <div className="not-prose my-8">
                                <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-neutral-100">
                                    <Image
                                        src={section.image.src}
                                        alt={section.image.alt}
                                        fill
                                        sizes="(min-width: 1024px) 1024px, 100vw"
                                        className="object-cover"
                                    />
                                </div>
                            </div>
                        )}
                    </section>
                ))}

                {study.sources && study.sources.length > 0 && (
                    <section>
                        <h2>Explore the source</h2>
                        <ul className="not-prose space-y-2 p-0">
                            {study.sources.map((source) => (
                                <li key={source.href} className="list-none">
                                    <a
                                        href={source.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-900"
                                    >
                                        {source.label}<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <div className="not-prose mt-12 rounded-2xl bg-neutral-950 p-6 text-white sm:p-8">
                    <h2 className="text-2xl font-semibold">Bring this format to your community or team</h2>
                    <p className="mt-2 max-w-2xl text-neutral-300">
                        MentorMates designs hands-on hackathons and AI workshops that turn important problems into testable ideas.
                    </p>
                    <a
                        href="https://www.mentormates.ai/"
                        className="mt-5 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-100"
                    >
                        Talk to MentorMates
                    </a>
                </div>
            </article>

            <div className="mt-16">
                <LatestAside currentSlug={study.slug} />
                <CTAJoin />
                <Footer />
            </div>
        </div>
    );
}
