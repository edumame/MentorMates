import { BlogPage } from "@/components/blog/BlogPage";
import { CTAJoin } from "@/components/layout/CTAJoin";
import { Footer } from "@/components/layout/Footer";

export default function Blog() {
    return (
        <>
            <BlogPage />
            <CTAJoin />
            <Footer />
        </>
    );
}