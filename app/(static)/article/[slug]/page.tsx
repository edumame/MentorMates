import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

const articleMap: Record<string, any> = {
  "1": dynamic(() => import("@/components/blog/articles/1")),
  "2": dynamic(() => import("@/components/blog/articles/2")),
  "3": dynamic(() => import("@/components/blog/articles/3")),
  "4": dynamic(() => import("@/components/blog/articles/4")),
  "5": dynamic(() => import("@/components/blog/articles/5")),
  "6": dynamic(() => import("@/components/blog/articles/6")),
};

export default function ArticlePage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug);
  const Component = articleMap[slug];
  if (!Component) return notFound();
  return <Component />;
}
