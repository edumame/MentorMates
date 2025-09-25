// components/blog/LatestAside.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { blogContent } from "@/components/blog/Content";
import { Button } from "@/components/ui/button";

function parseDate(d: string) {
    return new Date(d);
}

export function LatestAside({ currentSlug }: { currentSlug: string }) {
    const latest = blogContent
        .filter((p) => p.slug !== currentSlug)
        .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())
        .slice(0, 3);

    return (
        <section className="mx-auto mt-12 max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
                <h3 className="text-xl md:text-3xl font-semibold">Related Posts</h3>
                <Button 
                    variant="defaultGray"
                    asChild
                >
                    <Link href="/blog">
                        View all
                    </Link>
                </Button>
            </div>
            <div className="mt-4 grid gap-6 md:grid-cols-3">
                {latest.map((post) => (
                    <Link
                        key={post.slug}
                        href={`/blog/${post.slug}`}
                        className="block h-full"
                    >
                        <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.02)] transition-all hover:-translate-y-0.5 hover:shadow-md">
                            {/* Image */}
                            <div className="relative aspect-[16/9] w-full bg-slate-100">
                                {post.thumbnail ? (
                                    <Image
                                        src={post.thumbnail}
                                        alt={post.title}
                                        fill
                                        sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                                        Placeholder Image
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex flex-1 flex-col p-5 md:p-6">
                                {/* Category */}
                                <span className="mb-2 block text-[13px] font-medium text-slate-500">
                                    {post.category}
                                </span>

                                {/* Title */}
                                <h3 className="text-[20px] font-semibold leading-tight text-slate-900 line-clamp-2">
                                    {post.title}
                                </h3>

                                {/* Excerpt */}
                                <p className="mt-2 text-[14px] leading-6 text-slate-600 line-clamp-2">
                                    {post.excerpt}
                                </p>

                                {/* Meta: avatar spans 2 rows; right side has two stacked rows */}
                                <div className="mt-5 grid grid-cols-[auto,1fr] grid-rows-2 items-center gap-x-3 gap-y-1">
                                    {/* Avatar (left col, spans both rows) */}
                                    <Image
                                        src={post.authorAvatar || "/testimonials/avatarFallback.png"}
                                        alt={`${post.author} avatar`}
                                        width={32}
                                        height={32}
                                        className="row-span-2 h-8 w-8 rounded-full object-cover"
                                    />

                                    {/* Row 1 (right col): Author */}
                                    <span className="text-xs text-slate-600">
                                        Authored by {post.author}
                                    </span>

                                    {/* Row 2 (right col): Date + read time */}
                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                        {/* calendar */}
                                        <span>{post.date}</span>
                                        <span aria-hidden="true">•</span>
                                        {/* clock */}
                                        <span>{post.readTime}</span>
                                    </div>
                                </div>
                            </div>
                        </article>
                    </Link>
                ))}
            </div>
        </section>
    );
}
