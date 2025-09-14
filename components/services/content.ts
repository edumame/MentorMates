// components/services/content.ts

export type Bullet = {
    icon: string | null; // MaterialIcon name
    title: string;
    body: string;
};

export type ServiceSectionData = {
id: string;
eyebrow?: string;
title: string;
body: string;
bullets?: Bullet[]; // optional; renders in 2 cols on md+
cta?: { label: string; href: string };
image: { src: string; alt: string };
imageSide?: "left" | "right";
};

export const SERVICES_SECTIONS: ServiceSectionData[] = [
    {
        id: "create",
        eyebrow: "Create",
        title: "Empower Your Event with Tailored Solutions",
        body:
        "Our Innovation Suite offers unmatched flexibility and customization. Design your event to reflect your vision and engage participants effectively.",
        bullets: [
        {
            icon: "inbox_customize",
            title: "Customization Options",
            body: "Choose from various templates to suit your event’s theme and goals.",
        },
        {
            icon: "support",
            title: "Expert Support",
            body: "Our team is here to assist you every step of the way.",
        },
        ],
        cta: { label: "Book a demo", href: "/contact" },
        image: { src: "/services/service1.png", alt: "Event Management Platform" },
        imageSide: "right",
    },
    {
        id: "sponsor",
        eyebrow: "Sponsorship",
        title: "Unlock New Opportunities Through Sponsorship",
        body:
        "Partnering with us opens doors to innovative sponsorship opportunities. Enhance your brand visibility while supporting the next generation of creators.",
        bullets: [
        {
            icon: null,
            title: "Partnership Opportunities",
            body:
            "Collaborate with us to create impactful events that resonate with your audience.",
        },
        {
            icon: null,
            title: "Branding Exposure",
            body:
            "Showcase your brand prominently at events and engage with talented participants.",
        },
        ],
        cta: { label: "Book a demo", href: "/contact" },
        image: { src: "/services/service2.png", alt: "Sponsorship Opportunities" },
        imageSide: "left",
    },
    {
        id: "support",
        eyebrow: "Support",
        title: "Comprehensive Logistical Support for Your Events",
        body:
        "Our platform offers seamless event scheduling, ensuring that every aspect of your hackathon runs smoothly. With integrated communication tools and efficient resource management, you can focus on what matters most: fostering innovation and collaboration.",
        cta: { label: "Book a demo", href: "/contact" },
        image: { src: "/services/service3.png", alt: "Operations & Logistics" },
        imageSide: "right",
    },
];  