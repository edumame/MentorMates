"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
// keep stats stable so the effect deps don't thrash
const STATS = [
    { value: "95%", label: "Satisfaction Rate" },
    { value: "200+", label: "Projects Created" },
    { value: "10+", label: "Events Hosted" },
    { value: "1,000+", label: "Students Impacted" },
];

type CSSVarStyle = React.CSSProperties & { ["--value"]?: number };

export function Impact() {
    // Parse once: digits (for width), target number, and suffix (%, +, etc.)
    const parsed = useMemo(() => {
        return STATS.map((s) => {
        const digitsOnly = s.value.replace(/[^0-9]/g, "");
        return {
            label: s.label,
            target: Number(digitsOnly || "0"),
            minDigits: digitsOnly.length || 1,
            suffix: s.value.replace(/[0-9,]/g, "").trim(),
        };
        });
    }, []);

    const [curr, setCurr] = useState<number[]>(() => parsed.map(() => 0));

    // Simple one-time count-up animation (ease-out)
    useEffect(() => {
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
        const start = performance.now();
        const duration = 1200; // ms
        let raf = 0;

        const tick = (ts: number) => {
        const p = Math.min(1, (ts - start) / duration);
        const e = easeOut(p);
        setCurr(parsed.map((p) => Math.round(p.target * e)));
        if (p < 1) raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [parsed]); // parsed is memoized, so this still runs once

    return (
        <div className="mx-auto px-4 sm:px-8 lg:px-24 py-12 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center">
            {/* Left */}
            <div className="space-y-6">
                <div className="space-y-4">
                <p className="text-sm font-medium tracking-wide">Our Impact</p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-gray-900 leading-tight">
                    Transforming Ideas into Reality
                </h2>
                <p className="text-base sm:text-md leading-relaxed">
                    MentorMates has successfully hosted over 10 events, empowering thousands of
                    students. Our platform has facilitated the creation of more than 200 innovative
                    projects.
                </p>
                </div>

                <Button variant="default" className="px-6 py-3 rounded-lg font-semibold text-sm">
                Get Started
                </Button>
            </div>

            {/* Right - Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 lg:border-l-2 lg:border-gray-200 lg:pl-8 text-center lg:text-left">
                {parsed.map((p, i) => {
                const str = curr[i].toString().padStart(p.minDigits, "0");
                return (
                    <div key={p.label} className="space-y-2">
                    <div className="text-4xl sm:text-3xl lg:text-5xl font-bold text-gray-900">
                        {/* render each digit as a daisyUI countdown cell */}
                        <span className="inline-flex items-center gap-0.5">
                        {Array.from(str).map((ch, idx) => {
                            const countdownStyle: CSSVarStyle = { ["--value"]: Number(ch) };
                            return (
                            <span key={idx} className="countdown">
                                <span
                                style={countdownStyle}
                                aria-live="polite"
                                aria-label={ch}
                                >
                                {ch}
                                </span>
                            </span>
                            );
                        })}
                        </span>
                        {p.suffix && <span className="ml-1">{p.suffix}</span>}
                    </div>
                    <div className="text-sm font-semibold text-gray-700">{p.label}</div>
                    </div>
                );
                })}
            </div>
            </div>
        </div>
        </div>
    );
}
