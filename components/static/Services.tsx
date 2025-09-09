import Image from "next/image";

const SERVICES_CARDS = [
    {
        title: "Empower Your Event with Tailored Solutions",
        description: "Transform your hackathon with our comprehensive event management platform. From registration to project submission, we streamline every aspect of your innovation event.",
        imageSrc: "/services/service1.png",
        imageAlt: "Event Management Platform",
        bgColor: "bg-orange-100"
    },
    {
        title: "Unlock New Opportunities Through Sponsorship",
        description: "Connect with leading companies and organizations looking to sponsor hackathons. Our platform facilitates meaningful partnerships that benefit both sponsors and participants.",
        imageSrc: "/services/service2.png", 
        imageAlt: "Sponsorship Opportunities",
        bgColor: "bg-green-100"
    },
    {
        title: "Comprehensive Logistical Support for Your Events",
        description: "From venue coordination to technical support, our team provides end-to-end logistical assistance to ensure your hackathon runs seamlessly from start to finish.",
        imageSrc: "/services/service3.png",
        imageAlt: "Event Logistics Support", 
        bgColor: "bg-pink-100"
    }
];

export function Services() {
    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 py-32 px-6">
                <div className="max-w-6xl mx-auto text-center">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                        Turn your organization to an innovation hub
                    </h1>
                    <div className="flex justify-center mb-8">
                        <div className="w-24 h-1 bg-blue-500 rounded-full"></div>
                    </div>
                </div>
            </div>

            {/* Services Cards Section */}
            <div className="py-16 px-6">
                <div className="max-w-4xl mx-auto space-y-12">
                    {SERVICES_CARDS.map((service, index) => (
                        <div 
                            key={index}
                            className={`${service.bgColor} rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8`}
                        >
                            <div className="flex-1 space-y-4">
                                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                                    {service.title}
                                </h2>
                                <p className="text-gray-700 text-lg leading-relaxed">
                                    {service.description}
                                </p>
                            </div>
                            <div className="flex-shrink-0">
                                <div className="relative w-64 h-80 md:w-72 md:h-96">
                                    <Image
                                        src={service.imageSrc}
                                        alt={service.imageAlt}
                                        fill
                                        className="object-contain"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
