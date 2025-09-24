import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

const articleMap: Record<string, any> = {
    "1": dynamic(() => import("@/components/blog/articles/1")),
    "2": dynamic(() => import("@/components/blog/articles/1")),
    "3": dynamic(() => import("@/components/blog/articles/1")),
    "4": dynamic(() => import("@/components/blog/articles/1")),
    "5": dynamic(() => import("@/components/blog/articles/1")),
    "6": dynamic(() => import("@/components/blog/articles/1")),
};

export default function BlogArticlePage({
    params,
    }: {
    params: { slug: string };
    }) {
    const Component = articleMap[params.slug];
    if (!Component) return notFound();
    return <Component />;
}
