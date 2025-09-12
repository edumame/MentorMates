"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import React from "react";

type AccessOptionCardProps = {
    title: string;
    description?: string;
    points: string[];
    cta?: { href: string; label: string };
};

export function AccessOptionCard({
    title,
    description,
    points,
    cta,
    }: AccessOptionCardProps) {
    return (
        <Card>
        <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-2">{title}</h2>
            {description && <p className="text-gray-600 mb-4">{description}</p>}
            <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5 mb-4">
            {points.map((p, i) => (
                <li key={i}>{p}</li>
            ))}
            </ul>
            {cta && (
            <Link href={cta.href}>
                <Button variant="cta" className="h-10 px-5">
                {cta.label}
                </Button>
            </Link>
            )}
        </CardContent>
        </Card>
    );
}
