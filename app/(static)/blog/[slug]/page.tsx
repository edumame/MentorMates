import { notFound } from "next/navigation";
import dynamic from "next/dynamic";


const articleMap: Record<string, React.ComponentType<any>> = {
    "1": dynamic(() => import("@/components/blog/articles/1")),
    // "2": dynamic(() => import("@/components/blog/articles/2")),
    // "3": dynamic(() => import("@/components/blog/articles/3")),
    // "4": dynamic(() => import("@/components/blog/articles/4")),
    // "5": dynamic(() => import("@/components/blog/articles/5")),
    // "6": dynamic(() => import("@/components/blog/articles/6")),
};

export default function BlogArticlePage({
    params,
    }: {
    params: { slug: string };
    }) {
    // guard against encoded slugs like %2F
    const slug = decodeURIComponent(params.slug);
    const Component = articleMap[slug];

    if (!Component) return notFound();
    return <Component />;
}
