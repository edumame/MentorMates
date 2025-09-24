// components/blog/LatestAside.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { blogContent } from "@/components/blog/Content";

function parseDate(d: string) {
    // Your dates are like "Dec 15, 2024"
    return new Date(d);
}

export function LatestAside({ currentSlug }: { currentSlug: string }) {
    const latest = blogContent
        .filter((p) => p.slug !== currentSlug)
        .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())
        .slice(0, 3);

    return (
        <section aria-labelledby="latest-heading" className="mt-10">
        <h2 id="latest-heading" className="mb-4 text-base font-semibold text-slate-900">
            Latest articles
        </h2>

        <ul className="space-y-4">
            {latest.map((post) => (
            <li key={post.slug}>
                <Link
                href={`/blog/${post.slug}`}
                className="group grid grid-cols-[96px,1fr] gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-sm"
                >
                <div className="relative h-24 w-24 overflow-hidden rounded-lg bg-slate-100">
                    {post.thumbnail ? (
                    <Image
                        src={post.thumbnail}
                        alt={post.title}
                        fill
                        className="object-cover"
                        sizes="96px"
                    />
                    ) : (
                    <div className="absolute inset-0 grid place-items-center text-xs text-slate-400">
                        No image
                    </div>
                    )}
                </div>

                <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">{post.category}</p>
                    <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:underline">
                    {post.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{post.excerpt}</p>
                    <p className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                    <span>{post.date}</span>
                    <span aria-hidden="true">•</span>
                    <span>{post.readTime}</span>
                    </p>
                </div>
                </Link>
            </li>
            ))}
        </ul>
        </section>
    );
}
