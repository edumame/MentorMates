import { data } from "@/lib/LearnData";

export function LearnLayout() {
    return (
        <div className="rounded-tl-2xl border-t border-l border-[#D8D8D8] bg-white [background:linear-gradient(203deg,rgba(219,234,254,0.25)_13.19%,rgba(255,255,255,0.00)_65.83%),#FFF] px-8 py-6 min-h-screen" style={{ minHeight: "100vh" }}>
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-semibold">Learn</h1>
                <div className="flex gap-2">
                    <button className="px-3 py-1 rounded-lg bg-gray-100 text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500">
                        All
                    </button>
                    <button className="px-3 py-1 rounded-lg bg-transparent text-gray-500 text-sm font-medium border border-transparent hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        Bookmark
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.map((item) => (
                    <div
                        key={item.id}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col"
                    >
                        <div className="relative w-full aspect-video bg-black rounded-t-xl overflow-hidden flex items-center justify-center">
                            <iframe
                                src={item.source}
                                title={item.title}
                                className="w-full h-full min-h-[120px] rounded-t-xl"
                                allowFullScreen
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-green-200 text-lg font-cursive font-semibold drop-shadow-md mb-2">
                                    Drinks &amp; Dialogue
                                </span>
                                <div className="flex items-center justify-center">
                                    <svg
                                        width="48"
                                        height="48"
                                        viewBox="0 0 48 48"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="drop-shadow-lg"
                                    >
                                        <circle cx="24" cy="24" r="24" fill="white" fillOpacity="0.85" />
                                        <polygon points="20,16 34,24 20,32" fill="#222" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                            <h2 className="text-base font-semibold mb-1">{item.title}</h2>
                            <p className="text-sm text-gray-600 mb-4">
                                {item.description}
                            </p>
                            <div className="flex items-center justify-between mt-auto">
                                <div className="flex items-center gap-1 text-gray-500 text-xs">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        className="inline-block"
                                    >
                                        <path
                                            d="M12 8V12L14.5 13.5M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                    20 min
                                </div>
                                <button
                                    type="button"
                                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                                    aria-label="Bookmark"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        className="text-gray-500"
                                    >
                                        <path
                                            d="M6 4C5.44772 4 5 4.44772 5 5V20.382C5 21.2678 6.07714 21.7132 6.70711 21.0822L12 15.7893L17.2929 21.0822C17.9229 21.7132 19 21.2678 19 20.382V5C19 4.44772 18.5523 4 18 4H6Z"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}