import { BlogCard } from "./BlogCard";

export function BlogPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] px-4 pt-16">
            <div className="text-center max-w-2xl">
                <p className="text-sm font-medium mb-4">
                    Blog
                </p>
                <h1 className="text-5xl md:text-6xl font-semibold mb-6">
                    Welcome to Our Blog
                </h1>
                <p className="text-lg leading-relaxed">
                    Discover insights, updates, and success stories from MentorMates.
                </p>
            </div>
            <BlogCard />
        </div>
    )
}