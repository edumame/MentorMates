export type Bullet = {
    icon?: { name: string };
    title: string;
    body: string;
};

export type ServiceSectionData = {
    id: string;
    eyebrow?: string;
    title: string;
    body: string;
    bullets?: Bullet[];
    cta?: { label: string; href: string };
    image: { src: string; alt: string };
    imageSide?: "left" | "right";
};

export const SERVICES_SECTIONS: ServiceSectionData[] = [
    {
        id: "create",
        eyebrow: "Create",
        title: "Empower Your Event with Tailored Solutions",
        body: "Our Innovation Suite offers unmatched flexibility and customization. Design your event to reflect your vision and engage participants effectively.",
        bullets: [
        {
            icon: { name: "inbox" },
            title: "Customization Options",
            body: "Choose from various templates to suit your event's theme and goals.",
        },
        {
            icon: { name: "support" },
            title: "Expert Support",
            body: "Our team is here to assist you every step of the way.",
        },
        ],
        cta: { label: "Book a demo", href: "https://docs.google.com/forms/d/e/1FAIpQLSdu89X2k657kx6wYSrVcZLP81J9OT-nkqe1zU7V2H73mM0XgA/viewform?usp=sharing&ouid=111944773401134137978" },
        image: { src: "/img/event.png", alt: "Event Management Platform" },
        imageSide: "right",
    },
    {
        id: "sponsor",
        eyebrow: "Sponsorship",
        title: "Unlock New Opportunities Through Sponsorship",
        body: "Partnering with us opens doors to innovative sponsorship opportunities. Enhance your brand visibility while supporting the next generation of creators.",
        bullets: [
        {
            title: "Partnership Opportunities",
            body: "Collaborate with us to create impactful events that resonate with your audience.",
        },
        {
            title: "Branding Exposure",
            body: "Showcase your brand prominently at events and engage with talented participants.",
        },
        ],
        cta: { label: "Book a demo", href: "https://docs.google.com/forms/d/e/1FAIpQLSdu89X2k657kx6wYSrVcZLP81J9OT-nkqe1zU7V2H73mM0XgA/viewform?usp=sharing&ouid=111944773401134137978" },
        image: { src: "/img/sponsorship.png", alt: "Sponsorship Opportunities" },
        imageSide: "left",
    },
    {
        id: "support",
        eyebrow: "Support",
        title: "Comprehensive Logistical Support for Your Events",
        body: "Our platform offers seamless event scheduling, ensuring that every aspect of your hackathon runs smoothly. With integrated communication tools and efficient resource management, you can focus on what matters most: fostering innovation and collaboration.",
        cta: { label: "Book a demo", href: "https://docs.google.com/forms/d/e/1FAIpQLSdu89X2k657kx6wYSrVcZLP81J9OT-nkqe1zU7V2H73mM0XgA/viewform?usp=sharing&ouid=111944773401134137978" },
        image: { src: "/img/logistics.png", alt: "Operations & Logistics" },
        imageSide: "right",
    },
];
