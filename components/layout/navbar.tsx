"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  const toggleMenu = () => setIsOpen(!isOpen);

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
        console.log("Setting returnUrl:", currentPath);
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
      window.location.href = "/";
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 bg-white/70 backdrop-blur-sm z-50">
        <div className="flex justify-between items-center p-4">
          {/* Logo and Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/mentormate.png"
                alt="Mentor Mate Logo"
                width={200}
                height={40}
                className="object-contain pl-2"
              />
            </Link>
            <Link
              href="/projects"
              className="text-base font-medium text-gray-700 hover:text-blue-600"
            >
              Projects
            </Link>
            <Link
              href="/events"
              className="text-base font-medium text-gray-700 hover:text-blue-600"
            >
              Host a hackathon
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-base font-medium text-gray-700 hover:text-blue-600 inline-flex items-center gap-1">
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
                  <Link href="/resources">Research</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/blog">Blog</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Logo */}
          <Link href="/" className="flex md:hidden items-center gap-2">
            <Image
              src="/mentormate.png"
              alt="Mentor Mate Logo"
              width={200}
              height={40}
              className="object-contain pl-2"
            />
          </Link>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
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
                  className="px-4 py-4 text-base font-medium text-red-600 hover:bg-red-50 rounded-xl"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="px-4 py-4 rounded-xl text-base"
                  onClick={handleLoginClick}
                >
                  Log in
                </Button>
                <Link href="/select-role">
                  <Button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-4 rounded-xl text-base">
                    Get started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMenu}
            className="text-gray-600 hover:text-gray-900 flex md:hidden"
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

        {/* Mobile Menu */}
        <div
          className={`${
            isOpen ? "block" : "hidden"
          } bg-white border-t border-gray-100 md:hidden`}
        >
          <div className="px-4 py-4 pb-4 space-y-3">
            <Link
              href="/projects"
              className="block px-4 py-4 text-base font-medium text-gray-700 hover:text-blue-600"
            >
              Projects
            </Link>
            <Link
              href="/events"
              className="block px-4 py-4 text-base font-medium text-gray-700 hover:text-blue-600"
            >
              Host a hackathon
            </Link>
            <Link
              href="/about"
              className="block px-4 py-4 text-base font-medium text-gray-700 hover:text-blue-600"
            >
              About us
            </Link>
            <Link
              href="/resources"
              className="block px-4 py-4 text-base font-medium text-gray-700 hover:text-blue-600"
            >
              Research
            </Link>
            <Link
              href="/blog"
              className="block px-4 py-4 text-base font-medium text-gray-700 hover:text-blue-600"
            >
              Blog
            </Link>
            {session ? (
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center gap-3 px-2 py-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session.user.user_metadata?.avatar_url} />
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
                  className="w-full mt-2 px-4 py-2 text-left text-base font-medium text-red-600 hover:bg-red-50"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 mt-2 px-4 py-4 rounded-xl text-base"
                  onClick={handleLoginClick}
                >
                  Log in
                </Button>
                <Link href="/select-role" className="flex-1 mt-2">
                  <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-4 rounded-xl text-base">
                    Get started
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
