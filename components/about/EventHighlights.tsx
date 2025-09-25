import Image from "next/image";

export function EventHighlights() {
    const eventImages = [
        { src: "/eventHighlights/event1.png", alt: "Event 1" },
        { src: "/eventHighlights/event2.png", alt: "Event 2" },
        { src: "/eventHighlights/event3.png", alt: "Event 3" },
        { src: "/eventHighlights/event4.png", alt: "Event 4" },
        { src: "/eventHighlights/event5.png", alt: "Event 5" },
        { src: "/eventHighlights/event6.png", alt: "Event 6" },
    ];

    return (
        <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
            <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Event Highlights</h2>
            <p className="text-sm">Explore our vibrant community through past event moments.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {eventImages.map((image, index) => (
                <div key={index} className="relative group overflow-hidden rounded-lg shadow-lg">
                <Image
                    src={image.src}
                    alt={image.alt}
                    width={300}
                    height={300}
                    className="w-full aspect-square object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity duration-300" />
                </div>
            ))}
            </div>
        </div>
        </section>
    );
};