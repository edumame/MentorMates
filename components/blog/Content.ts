export interface BlogPost {
    title: string;
    excerpt: string;
    category: string;
    author: string;
    date: string;
    readTime: string;
    authorAvatar: string;
    thumbnail: string;
    slug: string;
}

export const blogContent: BlogPost[] = [
    {
        title: "AI for Impact: Inspirit AI's Vibe Coding Training",
        excerpt:
        "A small, high-touch workshop where Inspirit AI learned Vibe Coding to rapidly prototype teaching and operations tools—leaving with working demos and next steps.",
        category: "Insights",
        author: "Mentor Mates",
        date: "Sep 24, 2025",
        readTime: "5 min read",
        authorAvatar: "/testimonials/avatarFallback.png",
        thumbnail: "/blog/inspirit01.jpg",
        slug: "1",
    },
    {
        title: "Shaping Future Innovators: Tencent's AI Bootcamp Empowers the Next Generation",
        excerpt:
        "At Tencent Binhai Tower, 34 students built functional AI prototypes in a mentor-led bootcamp, showing how government–enterprise programs can scale high-quality STEM learning.",
        category: "Insights",
        author: "Mentor Mates",
        date: "Jul 18, 2025",
        readTime: "6 min read",
        authorAvatar: "/testimonials/avatarFallback.png",
        thumbnail: "/blog/tencent-hero.jpg",
        slug: "2",
    },
];  