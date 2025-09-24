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
        title: "Getting Started with MentorMates",
        excerpt:
        "Learn how to make the most of our mentorship platform and connect with experienced professionals.",
        category: "Getting Started",
        author: "MentorMates",
        date: "Sep 24, 2025",
        readTime: "5 min read",
        authorAvatar: "/testimonials/avatarFallback.png",
        thumbnail: "/blog/inspirit-ai-hero.jpg",
        slug: "1",
    },
    {
        title: "Success Stories from Our Community",
        excerpt:
        "Discover how our mentees have achieved their goals through mentorship and collaboration.",
        category: "Success Stories",
        author: "Community Team",
        date: "Dec 10, 2024",
        readTime: "8 min read",
        authorAvatar: "/testimonials/avatarFallback.png",
        thumbnail: "/testimonials/avatarFallback.png",
        slug: "2",
    }
];
