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
        author: "Team MentorMates",
        date: "Dec 15, 2024",
        readTime: "5 min read",
        authorAvatar: "/testimonials/avatarFallback.png",
        thumbnail: "/testimonials/avatarFallback.png",
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
    },
    {
        title: "Best Practices for Effective Mentorship",
        excerpt:
        "Tips and strategies for both mentors and mentees to build meaningful professional relationships.",
        category: "Mentorship",
        author: "Dr. Sarah Johnson",
        date: "Dec 5, 2024",
        readTime: "6 min read",
        authorAvatar: "/testimonials/avatarFallback.png",
        thumbnail: "/testimonials/avatarFallback.png",
        slug: "3",
    },
    {
        title: "Project Collaboration Tips",
        excerpt:
        "How to work effectively with teammates on hackathon projects and technical challenges.",
        category: "Collaboration",
        author: "Tech Lead",
        date: "Nov 28, 2024",
        readTime: "7 min read",
        authorAvatar: "/testimonials/avatarFallback.png",
        thumbnail: "/testimonials/avatarFallback.png",
        slug: "4",
    },
    {
        title: "Building Your Professional Network",
        excerpt:
        "Strategies for expanding your network and making valuable connections in the tech industry.",
        category: "Networking",
        author: "Career Advisor",
        date: "Nov 20, 2024",
        readTime: "9 min read",
        authorAvatar: "/testimonials/avatarFallback.png",
        thumbnail: "/testimonials/avatarFallback.png",
        slug: "5",
    },
    {
        title: "Event Hosting Guide",
        excerpt:
        "Everything you need to know about organizing successful hackathons and tech events.",
        category: "Events",
        author: "Event Team",
        date: "Nov 15, 2024",
        readTime: "10 min read",
        authorAvatar: "/testimonials/avatarFallback.png",
        thumbnail: "/testimonials/avatarFallback.png",
        slug: "6",
    },
];
