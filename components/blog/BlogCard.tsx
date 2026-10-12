import { blogContent } from "./Content";
import Image from "next/image";
import Link from "next/link";
import { BlogThumbnail } from "./BlogThumbnail";

export function BlogCard() {
    return (
        <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {blogContent.map((post, index) => (
            <Link
            key={index}
            href={`/blog/${post.slug}`}
            className="block h-full"
            >
            <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.02)] transition-all hover:-translate-y-0.5 hover:shadow-md">
                <BlogThumbnail thumbnail={post.thumbnail} title={post.title} priority={index < 3} />

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
    );
}
