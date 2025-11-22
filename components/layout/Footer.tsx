"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import InstagramIcon from "@mui/icons-material/Instagram";
import XIcon from "@mui/icons-material/X";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/user/authentication/auth/AuthContext";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ACTIVE_BRAND } from "@/lib/config/brands";

export function Footer() {
  const { isAuthenticated, isLoading } = useAuth();
  const [firstUrl, setFirstUrl] = useState("");
  const [firstReferrer, setFirstReferrer] = useState("");
  const substackBase = ACTIVE_BRAND.urls.substack;
  const socialLinks = ACTIVE_BRAND.social;
  const brandName = ACTIVE_BRAND.name;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setFirstUrl(window.location.href);
    setFirstReferrer(document.referrer || "");
  }, []);

  // Hide footer when authenticated or while loading to avoid a flash
  if (isLoading || isAuthenticated) {
    return null;
  }

  return (
    <footer className="w-full bg-white">
      <div className="mx-auto w-full max-w-10xl px-4 md:px-10 lg:px-24 py-20">
        {/* Card */}
        <div className="rounded-xl border border-gray-200 px-[24px] md:p-[64px]">
          <div className="grid grid-cols-1 justify-around gap-10 md:grid-cols-2 py-12">
            {/* Brand + newsletter */}
              <div className="text-center md:text-left justify-center">
                <div className="flex justify-center md:justify-start items-center gap-2">
                  <BrandLogo placement="footer" priority />
                </div>

              <p className="mt-6 text-sm text-gray-600">
                Join our newsletter to stay up to date on features and releases.
              </p>

              {/* Substack subscribe form */}
                {substackBase ? (
                  <form
                    action={`${substackBase}/api/v1/free`}
                    method="post"
                    target="_blank"
                    className="mt-4 flex w-full max-w-xl gap-3 mx-auto md:mx-0 flex-col md:flex-row"
                  >
                <input
                  type="email"
                  name="email" // <-- Substack expects this name
                  placeholder="Enter your email"
                  required
                  className="h-11 w-full rounded-md border border-gray-300 px-4 text-sm outline-none focus:border-gray-400"
                />
                {/* optional tracking fields */}
                <input type="hidden" name="first_url" value={firstUrl} />
                <input
                  type="hidden"
                  name="first_referrer"
                  value={firstReferrer}
                />
                    <input type="hidden" name="utm_source" value="footer" />
                    {/* optional redirect after Substack processes the signup */}
                    <input
                      type="hidden"
                      name="redirect"
                      value={`${substackBase}/welcome`}
                    />
                    <Button type="submit" variant="defaultGray">
                      Subscribe
                    </Button>
                  </form>
                ) : (
                  <p className="mt-4 text-sm text-gray-600">
                    {brandName} updates coming soon. Check back for newsletter
                    signup.
                  </p>
                )}

              <p className="mt-3 text-xs text-gray-500">
                By subscribing you agree to our{" "}
                <Link href="/privacy" className="underline">
                  Privacy Policy
                </Link>{" "}
                and provide consent to receive updates from us.
              </p>
            </div>

            {/* Links */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-0 text-left">
              <div className="py-6 sm:py-0">
                <p className="text-sm font-semibold text-gray-900">
                  Hackathons
                </p>
                <ul className="mt-4 space-y-3 text-sm text-gray-700">
                  <li>
                    <Link href="/host" className="hover:text-gray-900">
                      Host a hackathon
                    </Link>
                  </li>
                  <li>
                    <Link href="/events" className="hover:text-gray-900">
                      Browse hackathons
                    </Link>
                  </li>
                  <li>
                    <Link href="/project" className="hover:text-gray-900">
                      Projects
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="py-6 sm:py-0">
                <p className="text-sm font-semibold text-gray-900">
                  MentorMates
                </p>
                <ul className="mt-4 space-y-3 text-sm text-gray-700">
                  <li>
                    <Link href="/about" className="hover:text-gray-900">
                      About us
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/join/opportunities"
                      className="hover:text-gray-900"
                    >
                      Join our team
                    </Link>
                  </li>
                  <li>
                    <Link href="/research" className="hover:text-gray-900">
                      Research
                    </Link>
                  </li>
                  <li>
                    <Link href="/blog" className="hover:text-gray-900">
                      Blog
                    </Link>
                  </li>
                  <li>
                    <Link href="/help" className="hover:text-gray-900">
                      Help
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
            {/* Socials */}
            <div className="order-1 md:order-2 flex items-center gap-5 text-gray-700 justify-start md:justify-end">
              {socialLinks.instagram && (
                <Link href={socialLinks.instagram} aria-label="Instagram" className="hover:text-black">
                  <InstagramIcon fontSize="medium" />
                </Link>
              )}
              {socialLinks.x && (
                <Link href={socialLinks.x} aria-label="X" className="hover:text-black">
                  <XIcon fontSize="medium" />
                </Link>
              )}
              {socialLinks.linkedin && (
                <Link href={socialLinks.linkedin} aria-label="LinkedIn" className="hover:text-black">
                  <LinkedInIcon fontSize="medium" />
                </Link>
              )}
            </div>

            <p className="order-2 md:order-1 text-xs md:text-sm text-gray-600">
              &copy; {currentYear} {brandName}. All rights reserved.
            </p>
          </div>
      </div>
    </footer>
  );
}
