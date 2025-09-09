"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Instagram, Facebook, Twitter, Linkedin, Youtube } from "lucide-react";

export function Footer() {
    return (
        <footer className="w-full bg-white">
        <div className="mx-auto w-full max-w-8xl px-4 md:px-10 lg:px-24 py-8 md:py-12">
            {/* Card */}
            <div className="rounded-xl border border-gray-200 p-6 md:p-10">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
                {/* Brand + newsletter */}
                <div className="text-center md:text-left">
                <div className="flex justify-center md:justify-start items-center gap-2">
                    <Image
                    src="/mentormate.png"
                    alt="MentorMates Logo"
                    width={200}
                    height={40}
                    priority
                    />
                </div>

                <p className="mt-6 text-sm text-gray-600">
                    Join our newsletter to stay up to date on features and releases.
                </p>

                {/* Inline on desktop, stacked on mobile */}
                <form className="mt-4 flex w-full max-w-xl gap-3 mx-auto md:mx-0 flex-col md:flex-row">
                    <input
                    type="email"
                    placeholder="Enter your email"
                    className="h-11 w-full rounded-md border border-gray-300 px-4 text-sm outline-none focus:border-gray-400"
                    />
                    <button
                    type="button"
                    className="h-11 rounded-md bg-gray-200 px-4 text-sm font-medium text-gray-800 hover:bg-gray-300"
                    >
                    Subscribe
                    </button>
                </form>

                <p className="mt-3 text-xs text-gray-500">
                    By subscribing you agree to our{" "}
                    <Link href="/privacy" className="underline">
                    Privacy Policy
                    </Link>{" "}
                    and provide consent to receive updates from us.
                </p>
                </div>

                {/* Links: three columns on sm+, stacked with dividers on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-0 text-left">
                <div className="py-6 sm:py-0">
                    <p className="text-sm font-semibold text-gray-900">Hackathons</p>
                    <ul className="mt-4 space-y-3 text-sm text-gray-700">
                    <li>
                        <Link href="/events" className="hover:text-gray-900">
                        Host a hackathon
                        </Link>
                    </li>
                    <li>
                        <Link href="/events" className="hover:text-gray-900">
                        Browse hackathons
                        </Link>
                    </li>
                    <li>
                        <Link href="/projects" className="hover:text-gray-900">
                        Projects
                        </Link>
                    </li>
                    </ul>
                </div>

                <div className="py-6 sm:py-0">
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

                <div className="py-6 sm:py-0">
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
            </div>

            {/* Bottom bar */}
            <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-t border-transparent pt-0">
            {/* Socials first on mobile, right-aligned on desktop */}
            <div className="order-1 md:order-2 flex items-center gap-5 text-gray-700 justify-start md:justify-end">
                <Link href="https://facebook.com" aria-label="Facebook" className="hover:text-black">
                    <Facebook className="h-5 w-5" />
                </Link>
                <Link href="https://instagram.com" aria-label="Instagram" className="hover:text-black">
                    <Instagram className="h-5 w-5" />
                </Link>
                <Link href="https://x.com" aria-label="X" className="hover:text-black">
                    <Twitter className="h-5 w-5" />
                </Link>
                <Link href="https://linkedin.com" aria-label="LinkedIn" className="hover:text-black">
                    <Linkedin className="h-5 w-5" />
                </Link>
                <Link href="https://youtube.com" aria-label="YouTube" className="hover:text-black">
                    <Youtube className="h-5 w-5" />
                </Link>
            </div>

            <p className="order-2 md:order-1 text-xs md:text-sm text-gray-600">
                &copy; 2025 MentorMates. All rights reserved.
            </p>
            </div>
        </div>
        </footer>
    );
}