import { notFound } from "next/navigation";
import dynamic from "next/dynamic";

const articleMap: Record<string, React.ComponentType> = {
    "1": dynamic(() => import("@/components/blog/articles/1")),
    "2": dynamic(() => import("@/components/blog/articles/2")),
    // "3": dynamic(() => import("@/components/blog/articles/3")),
    // "4": dynamic(() => import("@/components/blog/articles/4")),
    // "5": dynamic(() => import("@/components/blog/articles/5")),
    // "6": dynamic(() => import("@/components/blog/articles/6")),
};

export default async function BlogArticlePage({
    params,
    }: {
    params: Promise<{ slug: string }>;
    }) {
    const { slug } = await params;
    // guard against encoded slugs like %2F
    const decodedSlug = decodeURIComponent(slug);
    const Component = articleMap[decodedSlug];

    if (!Component) return notFound();
    return <Component />;
}
