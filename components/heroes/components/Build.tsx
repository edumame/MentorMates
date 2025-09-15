"use client";

type Feature = {
    icon: string;
    title: string;
    description: string;
    variant?: "default" | "highlight";
};

const Icon = ({
    name,
    className = "",
    }: {
    name: string;
    className?: string;
    }) => (
    <span aria-hidden className={`material-symbols-outlined ${className}`}>
        {name}
    </span>
);

export function Build() {
    const features: Feature[] = [
        {
        icon: "group",
        title: "Reach Your Audience",
        description:
            "Connect with a diverse talent pool for recruitment, product feedback, and brand awareness, or empower your employees with internal events.",
        },
        {
        icon: "build",
        title: "Fuel Innovation",
        description:
            "Drive product adoption and generate new ideas by giving participants a hands-on opportunity to build and innovate.",
        },
        {
        icon: "mediation",
        title: "End-to-End Support",
        description:
            "Simplify hackathon management from start to finish, centralizing everything from event promotion to project submissions and judging.",
        },
    ];

    return (
        <section className="bg-[#eef4ff] py-20 px-4 sm:px-8 lg:px-24">
        <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            {/* Left — gradient panel with phone mock */}
            <div className="relative">
                <div className="mx-auto h-[520px] w-full max-w-[520px] rounded-[28px] bg-gradient-to-b from-orange-400 via-pink-400 to-pink-300 p-3 shadow-xl">
                <div className="flex h-full items-center justify-center rounded-[22px] bg-white">
                    {/* Replace with your real screenshot/mock */}
                    <div className="h-[92%] w-[92%] rounded-[28px] bg-gray-100 shadow-2xl ring-1 ring-black/5 flex items-center justify-center">
                    <span className="text-gray-500">Phone mock / image</span>
                    </div>
                </div>
                </div>
            </div>

            {/* Right — content */}
            <div className="space-y-10">
                <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl leading-tight">
                Build your next innovation event with MentorMates
                </h2>

                <div className="space-y-7">
                {features.map((f, i) => (
                    <div key={i} className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="pt-1 text-4xl">
                        <Icon
                            name={f.icon}
                            className="leading-none text-gray-900"
                        />
                    </div>

                    {/* Copy */}
                    <div>
                        <h3 className="mb-1.5 text-xl font-semibold text-gray-900">
                        {f.title}
                        </h3>
                        <p className="text-[15px] leading-7 text-gray-600">
                        {f.description}
                        </p>
                    </div>
                    </div>
                ))}
                </div>

                <div>
                <button className="rounded-xl bg-[#4B89EF] px-4 py-2 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700">
                    Start building
                </button>
                </div>
            </div>
            </div>
        </div>
        </section>
    );
}
