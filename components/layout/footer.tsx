"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Instagram, Facebook, Twitter, Linkedin, Youtube } from "lucide-react";

export function Footer() {
    return (
        <footer className="w-full bg-white">
        <div className="mx-auto px-10 py-12 lg:px-24">
            {/* Newsletter + Columns */}
            <div className="rounded-2xl border border-gray-200 p-8 md:p-12">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
                {/* Brand + Newsletter */}
                <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                    <Image src="/mentormate.png" alt="Mentor Mate Logo" width={200} height={40} />
                </div>
                <p className="mt-6 text-sm text-gray-600">
                    Join our newsletter to stay up to date on features and releases.
                </p>
                <form className="mt-4 flex max-w-xl items-center gap-3">
                    <input
                    type="email"
                    placeholder="Enter your email"
                    className="h-11 w-full rounded-md border border-gray-300 px-4 text-sm outline-none focus:border-gray-400"
                    />
                    <button
                    type="button"
                    className="h-11 rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-black"
                    >
                    Subscribe
                    </button>
                </form>
                <p className="mt-3 text-xs text-gray-500">
                    By subscribing you agree to with our{" "}
                    <Link className="underline" href="/privacy">
                    Privacy Policy
                    </Link>{" "}
                    and provide consent to receive updates from us.
                </p>
                </div>

                {/* Column 1 */}
                <div>
                <p className="text-sm font-semibold text-gray-900">Hackathons</p>
                <ul className="mt-4 space-y-3 text-sm text-gray-700">
                    <li>
                    <Link href="/events" className="hover:text-gray-900">
                        Host a hackathon
                    </Link>
                    </li>
                    <li>
                    <Link href="/projects" className="hover:text-gray-900">
                        Projects
                    </Link>
                    </li>
                </ul>
                </div>

                {/* Column 2 */}
                <div>
                <p className="text-sm font-semibold text-gray-900">MentorMates</p>
                <ul className="mt-4 space-y-3 text-sm text-gray-700">
                    <li>
                    <Link href="/about" className="hover:text-gray-900">
                        About us
                    </Link>
                    </li>
                    <li>
                    <Link href="/resources" className="hover:text-gray-900">
                        Research
                    </Link>
                    </li>
                    <li>
                    <Link href="/blog" className="hover:text-gray-900">
                        Blog
                    </Link>
                    </li>
                </ul>
                </div>

                {/* Column 3 */}
                <div>
                <p className="text-sm font-semibold text-gray-900">Others</p>
                <ul className="mt-4 space-y-3 text-sm text-gray-700">
                    <li>
                    <Link href="/privacy" className="hover:text-gray-900">
                        Privacy Policy
                    </Link>
                    </li>
                    <li>
                    <Link href="/terms" className="hover:text-gray-900">
                        Terms of Service
                    </Link>
                    </li>
                </ul>
                </div>
            </div>
            </div>

            {/* Bottom bar */}
            <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-6 text-sm text-gray-600 md:flex-row">
            <p>&copy; 2025 MentorMates. All rights reserved.</p>
            <div className="flex items-center gap-5 text-gray-700">
                {/* Socials - simple icons */}
                <Link
                href="https://facebook.com"
                aria-label="Facebook"
                className="hover:text-black"
                >
                    <Facebook className="h-5 w-5" />
                </Link>
                <Link
                href="https://instagram.com"
                aria-label="Instagram"
                className="hover:text-black"
                >
                    <Instagram className="h-5 w-5" />
                </Link>
                <Link
                href="https://x.com"
                aria-label="X"
                className="hover:text-black"
                >
                    <Twitter className="h-5 w-5" />
                </Link>
                <Link
                href="https://linkedin.com"
                aria-label="LinkedIn"
                className="hover:text-black"
                >
                    <Linkedin className="h-5 w-5" />
                </Link>
                <Link
                href="https://youtube.com"
                aria-label="YouTube"
                className="hover:text-black"
                >
                    <Youtube className="h-5 w-5" />
                </Link>
            </div>
            </div>
        </div>
        </footer>
    );
}