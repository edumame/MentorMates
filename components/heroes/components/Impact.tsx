"use client";

export function Impact() {
    const stats = [
        {
        value: "95%",
        label: "Satisfaction Rate",
        },
        {
        value: "200+",
        label: "Projects Created",
        },
        {
        value: "10+",
        label: "Events Hosted",
        },
        {
        value: "1,000+",
        label: "Students Impacted",
        },
    ];

    return (
        <div className="mx-auto px-4 sm:px-8 lg:px-24 py-12 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center">
            {/* Left Side - Content */}
            <div className="space-y-6">
                <div className="space-y-4">
                <p className="text-sm font-medium tracking-wide">
                    Our Impact
                </p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                    Transforming Ideas into Reality
                </h2>
                <p className="text-base sm:text-md leading-relaxed">
                    MentorMates has successfully hosted over 10 events, empowering
                    thousands of students. Our platform has facilitated the creation
                    of more than 200 innovative projects.
                </p>
                </div>

                <button className="bg-[#4B89EF] text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors">
                Get Started
                </button>
            </div>

            {/* Right Side - Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 lg:border-l-2 lg:border-gray-200 lg:pl-8 text-center lg:text-left">
                {stats.map((stat, index) => (
                <div key={stat.label} className="space-y-2">
                    <div className="text-4xl sm:text-3xl lg:text-5xl font-bold text-gray-900">
                    {stat.value}
                    </div>
                    <div className="text-sm font-semibold text-gray-700">
                    {stat.label}
                    </div>
                </div>
                ))}
            </div>
            </div>
        </div>
        </div>
    );
}
