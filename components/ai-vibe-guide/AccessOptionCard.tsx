"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

type AccessOptionCardProps = {
    title: string;
    price: string;
    points: string[];
    cta?: { href: string; label: string };
};

export function AccessOptionCard({
    title,
    price,
    points,
    cta,
    }: AccessOptionCardProps) {
    const isPaid = price === "$20";
    
    return (
        <Card className="h-[450px] rounded-2xl border border-gray-200 shadow-sm">
        <CardContent className="flex h-full flex-col p-5 sm:p-6 md:p-8">
            {/* Title */}
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            {title}
            </h3>

            {/* Price */}
            <div className={`mt-2 font-semibold tracking-tight text-gray-900 ${
                isPaid 
                    ? "text-4xl sm:text-5xl" 
                    : "text-2xl sm:text-3xl"
            }`}>
            {price}
            </div>

            {/* Divider */}
            <hr className="my-4 sm:my-6 border-gray-200" />

            {/* Includes */}
            <p className="text-xs sm:text-sm font-medium text-gray-700 mb-3">
            Includes:
            </p>

            {/* Checklist */}
            <ul className="space-y-3 mb-6">
            {points.map((p, i) => (
                <li key={i} className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 text-gray-900 shrink-0" />
                <span className="text-sm text-gray-700">{p}</span>
                </li>
            ))}
            </ul>

            {/* CTA (sticky to bottom) */}
            {cta && (
            <Link href={cta.href} className="mt-auto">
                <Button
                    className="w-full rounded-xl"
                    variant="default"
                >
                {cta.label}
                </Button>
            </Link>
            )}
        </CardContent>
        </Card>
    );
}
