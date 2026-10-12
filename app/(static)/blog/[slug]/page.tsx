import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import type { Metadata } from "next";
import { CaseStudyArticle } from "@/components/blog/CaseStudyArticle";
import { caseStudyBySlug } from "@/components/blog/case-studies";
import { blogContent } from "@/components/blog/Content";

const articleMap: Record<string, React.ComponentType> = {
    "1": dynamic(() => import("@/components/blog/articles/1")),
    "2": dynamic(() => import("@/components/blog/articles/2")),
    "3": dynamic(() => import("@/components/blog/articles/3")),
};

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const post = blogContent.find((item) => item.slug === decodeURIComponent(slug));

    return post
        ? { title: `${post.title} | MentorMates`, description: post.excerpt }
        : {};
}

export default async function BlogArticlePage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    // guard against encoded slugs like %2F
    const decodedSlug = decodeURIComponent(slug);
    const caseStudy = caseStudyBySlug.get(decodedSlug);
    if (caseStudy) return <CaseStudyArticle study={caseStudy} />;

    const Component = articleMap[decodedSlug];

    if (!Component) return notFound();
    return <Component />;
}
