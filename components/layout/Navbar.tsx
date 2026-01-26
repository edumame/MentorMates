"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DISCORD_INVITE = "https://discord.gg/6pbUzK44eW";
const MENTOR_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeKK8E8B63Sl4J0fjJZKDz3QdWImSqkrwPym-_EN6K2kcizsw/viewform";

// Discord icon component
function DiscordIcon({
  className = "",
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden={title ? undefined : true}
      role="img"
      aria-label={title}
      className={`inline-block align-[-0.125em] h-[1em] w-[1em] ${className}`}
    >
      <path d="M14.82 4.26001C14.6214 4.6157 14.4444 4.98303 14.29 5.36001C12.7728 5.12006 11.2272 5.12006 9.70999 5.36001C9.55558 4.98303 9.3786 4.6157 9.17999 4.26001C7.75078 4.50421 6.3614 4.94155 5.04999 5.56001C2.70493 8.9443 1.64143 13.053 2.04999 17.15C3.57823 18.2989 5.29345 19.1751 7.11999 19.74C7.53591 19.1906 7.9071 18.6087 8.22999 18C7.63407 17.7803 7.06129 17.5023 6.51999 17.17C6.66845 17.0712 6.80889 16.9609 6.93999 16.84C8.51845 17.6003 10.248 17.9952 12 17.9952C13.752 17.9952 15.4815 17.6003 17.06 16.84C17.2 16.96 17.34 17.07 17.48 17.17C16.9358 17.4997 16.3635 17.7807 15.77 18.01C16.0795 18.6325 16.4408 19.228 16.85 19.79C18.6743 19.227 20.3865 18.3506 21.91 17.2C22.3284 13.1022 21.264 8.99019 18.91 5.61001C17.6133 4.97875 16.2377 4.52468 14.82 4.26001ZM8.67999 14.81C8.17958 14.7741 7.71254 14.5457 7.37691 14.1728C7.04129 13.7999 6.86319 13.3114 6.87999 12.81C6.86065 12.3079 7.03788 11.8181 7.37401 11.4446C7.71013 11.0711 8.17865 10.8435 8.67999 10.81C9.18133 10.8435 9.64986 11.0711 9.98598 11.4446C10.3221 11.8181 10.4993 12.3079 10.48 12.81C10.4993 13.3121 10.3221 13.8019 9.98598 14.1754C9.64986 14.5489 9.18133 14.7765 8.67999 14.81ZM15.32 14.81C14.8196 14.7741 14.3525 14.5457 14.0169 14.1728C13.6813 13.7999 13.5032 13.3114 13.52 12.81C13.5007 12.3079 13.6779 11.8181 14.014 11.4446C14.3501 11.0711 14.8187 10.8435 15.32 10.81C15.8223 10.841 16.2923 11.0679 16.6289 11.442C16.9656 11.816 17.1419 12.3073 17.12 12.81C17.1419 13.3128 16.9656 13.804 16.6289 14.1781C16.2923 14.5521 15.8223 14.779 15.32 14.81Z" />
    </svg>
  );
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  const isHome = pathname === "/";
  const hideLogoOnAuthPages = pathname === "/login";

  const toggleMenu = () => setIsOpen(!isOpen);
  const toggleResources = () => setResourcesOpen(!resourcesOpen);

  // Auto-close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
    setResourcesOpen(false);
  }, [pathname]);

  useEffect(() => {
    const fetchSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) {
        console.error("Error fetching session:", error);
        return;
      }
      setSession(session);
    };

    fetchSession();
  }, []);

  const handleLoginClick = () => {
    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      if (currentPath !== "/mentor") {
        localStorage.setItem("returnUrl", currentPath);
      }
    }
    router.push("/login");
  };

  const handleSignOutClick = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
    } else {
      setSession(null);
      localStorage.removeItem("returnUrl");
      router.push("/");
    }
  };

  return (
    <>
      <nav
        className={`fixed left-0 right-0 bg-white z-50 ${isHome ? "top-[var(--banner-h,0px)]" : "top-0"}`}
      >
        <div className="flex justify-between items-center py-4 px-4 sm:px-6 lg:px-10">
          {/* Logo and Desktop Menu */}
          {/* Desktop shows at lg+ to avoid wrapping on tablets/smaller laptops */}
          <div className="hidden lg:flex items-center gap-8">
            {!hideLogoOnAuthPages && (
              <Link href="/" className="flex items-center gap-2">
                <Image
                  src="/mentormate.png"
                  alt="Mentor Mate Logo"
                  width={200}
                  height={40}
                  className="object-contain pl-2"
                />
              </Link>
            )}

            <Link
              href="/events"
              className="text-base font-medium text-black hover:text-[#4B89EF] whitespace-nowrap"
            >
              Events
            </Link>
            <Link
              href="/host"
              className="text-base font-medium text-black hover:text-[#4B89EF] whitespace-nowrap"
            >
              Host a hackathon
            </Link>
            <Link
              href={MENTOR_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-medium text-black hover:text-[#4B89EF] whitespace-nowrap"
            >
              Become a Mentor
            </Link>

            {/* Discord (desktop) */}
            <Link
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-medium text-black hover:text-[#4B89EF] inline-flex items-center gap-2 whitespace-nowrap"
            >
              <DiscordIcon className="mr-1 h-[1.1em] w-[1.1em]" />
              Join discord community
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-base font-medium text-black hover:text-[#4B89EF] inline-flex items-center gap-1 whitespace-nowrap">
                  Resources
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                  <Link href="/about">About us</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/projects">Projects</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/research">Research</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/blog">Blog</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/help">Help</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Logo for <lg screens */}
          {!hideLogoOnAuthPages && (
            <Link href="/" className="flex lg:hidden items-center gap-2">
              <Image
                src="/mentormate.png"
                alt="Mentor Mate Logo"
                width={140}
                height={28}
                className="object-contain"
              />
            </Link>
          )}

          {/* Desktop Auth Buttons (lg+) */}
          <div className="hidden lg:flex items-center gap-3">
            {session ? (
              <>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session.user.user_metadata?.avatar_url} />
                  <AvatarFallback>
                    {session.user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={handleSignOutClick}
                  className="px-4 py-3 text-base font-medium text-red-600 hover:bg-red-50 rounded-xl whitespace-nowrap"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Button
                  variant="defaultGray"
                  className="px-3 py-2 rounded-lg text-sm xl:px-4 xl:py-3 xl:rounded-xl xl:text-base whitespace-nowrap"
                  onClick={handleLoginClick}
                >
                  Log in
                </Button>
                <Link href="/login">
                  <Button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm xl:px-4 xl:py-3 xl:rounded-xl xl:text-base whitespace-nowrap">
                    Get started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button (<lg only) */}
          <button
            onClick={toggleMenu}
            className="text-gray-600 hover:text-gray-900 flex lg:hidden"
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu (<lg only) */}
        <div
          className={`${isOpen ? "block" : "hidden"} bg-white lg:hidden min-h-screen`}
        >
          <div className="px-6 py-6 space-y-1">
            <Link
              href="/events"
              className="block py-4 text-lg font-medium text-black hover:text-[#4B89EF]"
            >
              Events
            </Link>
            <Link
              href="/host"
              className="block py-4 text-lg font-medium text-black hover:text-[#4B89EF]"
            >
              Host a hackathon
            </Link>
            <Link
              href={MENTOR_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block py-4 text-lg font-medium text-black hover:text-[#4B89EF]"
            >
              Become a Mentor
            </Link>

            {/* Discord (mobile) */}
            <Link
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="block py-4 text-lg font-medium text-black hover:text-[#4B89EF] inline-flex items-center gap-2"
            >
              <DiscordIcon className="mr-2 h-[1.2em] w-[1.2em]" />
              Join discord community
            </Link>

            {/* Resources Dropdown in Mobile */}
            <div className="py-4">
              <button
                onClick={toggleResources}
                className="w-full text-left text-lg font-medium text-black flex items-center justify-between hover:text-[#4B89EF]"
              >
                Resources
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform ${resourcesOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              <div
                className={`${resourcesOpen ? "block" : "hidden"} ml-4 mt-2 space-y-1`}
              >
                <Link
                  href="/about"
                  className="block py-3 text-base font-normal text-black hover:text-[#4B89EF]"
                >
                  About us
                </Link>
                <Link
                  href="/projects"
                  className="block py-3 text-base font-normal text-black hover:text-[#4B89EF]"
                >
                  Projects
                </Link>
                <Link
                  href="/research"
                  className="block py-3 text-base font-normal text-black hover:text-[#4B89EF]"
                >
                  Research
                </Link>
                <Link
                  href="/blog"
                  className="block py-3 text-base font-normal text-black hover:text-[#4B89EF]"
                >
                  Blog
                </Link>
                <Link
                  href="/help"
                  className="block py-3 text-base font-normal text-black hover:text-[#4B89EF]"
                >
                  Help
                </Link>
              </div>
            </div>

            {/* Mobile Auth Buttons */}
            <div className="pt-8 space-y-4">
              {session ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-2 py-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={session.user.user_metadata?.avatar_url}
                      />
                      <AvatarFallback>
                        {session.user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {session.user.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOutClick}
                    className="w-full px-4 py-3 text-center text-base font-medium text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Button
                    variant="outline"
                    className="w-full py-4 rounded-lg text-base font-medium"
                    onClick={handleLoginClick}
                  >
                    Log in
                  </Button>
                  <Link href="/login" className="block">
                    <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-lg text-base font-medium">
                      Get started
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
