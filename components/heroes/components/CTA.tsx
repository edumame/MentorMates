"use client";

export function CTA() {
    return (
        <div className="mx-auto pt-8">
            <div
                className="relative overflow-hidden"
                style={{
                    background: "linear-gradient(94deg, rgba(247, 246, 242, 0.90) -4.25%, rgba(66, 134, 244, 0.90) 52.72%, rgba(247, 246, 242, 0.90) 107.67%), linear-gradient(99deg, rgba(66, 134, 244, 0.90) 16.1%, rgba(52, 167, 83, 0.90) 92.77%)"
                }}
            >
                <div className="relative z-10 text-center py-24 px-8">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                        Join the Innovation Revolution
                    </h2>
                    
                    <p className="text-lg text-white/90 mb-8 max-w-4xl mx-auto">
                        Get involved today—sign up, sponsor an event, or reach out for more information!
                    </p>
                    
                    <button className="bg-white text-black px-8 py-2 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors shadow-lg">
                        Get started
                    </button>
                </div>
                
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 w-20 h-20 rounded-full bg-white/20"></div>
                    <div className="absolute top-32 right-20 w-16 h-16 rounded-full bg-white/15"></div>
                    <div className="absolute bottom-20 left-1/4 w-12 h-12 rounded-full bg-white/25"></div>
                    <div className="absolute bottom-32 right-1/3 w-8 h-8 rounded-full bg-white/20"></div>
                </div>
            </div>
        </div>
    );
}

