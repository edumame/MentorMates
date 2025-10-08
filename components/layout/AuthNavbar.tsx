"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu, Close, NotificationsNone } from "@mui/icons-material";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdmin } from "@/lib/hooks/use-admin";
import posthog from "posthog-js";

export function AuthNavbar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const isAdmin = useAdmin();

  // fetch & subscribe to session
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setSession(session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = () => {
    if (typeof window !== "undefined") {
      const returnUrl = window.location.pathname;
      if (returnUrl !== "/mentor") localStorage.setItem("returnUrl", returnUrl);
    }
    router.push("/login");
    setIsOpen(false);
  };

  const handleSignOut = async () => {
    localStorage.removeItem("returnUrl");
    await supabase.auth.signOut();
    posthog.reset();
    router.push("/");
    setIsOpen(false);
  };

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 bg-white border-b border-[#D8D8D8] top-[var(--banner-h,0px)]">
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/mentormate.png"
              alt="Logo"
              width={200}
              height={40}
              className="object-contain pl-2"
            />
          </Link>

          {/* Desktop Right Controls: notifications + avatar */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="p-2 rounded-full hover:bg-gray-100 text-gray-800"
            >
              <NotificationsNone className="h-6 w-6" />
            </Link>

            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label="Account menu" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={session.user.user_metadata?.avatar_url}
                      />
                      <AvatarFallback>
                        {session.user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="p-3">
                  <div className="px-2 pb-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold leading-tight">
                        {session.user.user_metadata?.full_name ||
                          session.user.user_metadata?.name ||
                          session.user.email?.split("@")[0]}
                      </p>
                      {isAdmin && (
                        <span className="text-sm rounded-full bg-blue-100 text-blue-700 px-3 py-0.5">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-base text-gray-700 mt-1">
                      {session.user.email}
                    </p>
                    <Button
                      variant="defaultGray"
                      onClick={() => router.push("/onboarding")}
                      className="mt-4 w-full text-base"
                    >
                      Set up profile
                    </Button>
                  </div>
                  <DropdownMenuSeparator />
                  <div className="py-1">
                    <DropdownMenuItem onClick={() => router.push("/help")}>
                      Support
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/blog")}>
                      Blog
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="text-red-600 hover:bg-red-50"
                    >
                      Log out
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                onClick={handleLogin}
                aria-label="Log in"
                className="rounded-full focus:outline-none"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            aria-label="Toggle menu"
            onClick={() => setIsOpen((o) => !o)}
            className="p-2 rounded-md hover:bg-gray-200 flex md:hidden"
          >
            {isOpen ? (
              <Close className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        } md:hidden`}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 h-full w-3/4 max-w-xs bg-white z-50 transform transition-transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } flex flex-col md:hidden`}
      >
        <div className="flex-shrink-0 p-4 border-b">
          {session ? (
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={session.user.user_metadata?.avatar_url} />
                <AvatarFallback>
                  {session.user.email?.[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-gray-900 text-sm">
                  {session.user.email}
                </p>
              </div>
            </div>
          ) : (
            <Button variant="logIn" className="w-full" onClick={handleLogin}>
              Log in
            </Button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Sidebar Navigation Items */}
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-700 font-medium hover:text-blue-600"
            onClick={() => setIsOpen(false)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M2.99979 13H3.99979V20C3.99979 21.103 4.89679 22 5.99979 22H17.9998C19.1028 22 19.9998 21.103 19.9998 20V13H20.9998C21.1975 12.9999 21.3908 12.9412 21.5552 12.8314C21.7197 12.7215 21.8478 12.5653 21.9235 12.3826C21.9991 12.1999 22.0189 11.9989 21.9804 11.8049C21.9418 11.611 21.8466 11.4328 21.7068 11.293L12.7068 2.29296C12.614 2.20001 12.5038 2.12627 12.3825 2.07596C12.2612 2.02565 12.1311 1.99976 11.9998 1.99976C11.8685 1.99976 11.7384 2.02565 11.6171 2.07596C11.4958 2.12627 11.3856 2.20001 11.2928 2.29296L2.29279 11.293C2.15298 11.4328 2.05777 11.611 2.0192 11.8049C1.98064 11.9989 2.00044 12.1999 2.07611 12.3826C2.15178 12.5653 2.27992 12.7215 2.44433 12.8314C2.60874 12.9412 2.80204 12.9999 2.99979 13ZM9.99979 20V15H13.9998V20H9.99979ZM11.9998 4.41396L17.9998 10.414L18.0008 20H15.9998V15C15.9998 13.897 15.1028 13 13.9998 13H9.99979C8.89679 13 7.99979 13.897 7.99979 15V20H5.99979V10.414L11.9998 4.41396Z"
                fill="currentColor"
              />
            </svg>
            Home
          </Link>
          <Link
            href="/events"
            className="flex items-center gap-2 text-gray-700 font-medium hover:text-blue-600"
            onClick={() => setIsOpen(false)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 20 22"
              fill="none"
            >
              <path
                d="M12.9196 17.5C12.2393 17.5 11.6658 17.2651 11.1991 16.7955C10.7324 16.3256 10.4991 15.7506 10.4991 15.0705C10.4991 14.3901 10.7339 13.8166 11.2036 13.35C11.6734 12.8833 12.2484 12.65 12.9286 12.65C13.6089 12.65 14.1824 12.8848 14.6491 13.3545C15.1158 13.8243 15.3491 14.3993 15.3491 15.0795C15.3491 15.7598 15.1143 16.3333 14.6446 16.8C14.1748 17.2666 13.5998 17.5 12.9196 17.5ZM2.55286 21.1495C2.09286 21.1495 1.69403 20.9806 1.35636 20.6427C1.01853 20.3051 0.849609 19.9062 0.849609 19.4462V4.05373C0.849609 3.59207 1.01853 3.19181 1.35636 2.85298C1.69403 2.51398 2.09286 2.34448 2.55286 2.34448H4.12411V1.69823C4.12411 1.45906 4.20711 1.25698 4.37311 1.09198C4.53928 0.926982 4.74128 0.844482 4.97911 0.844482C5.22394 0.844482 5.43044 0.926982 5.59861 1.09198C5.76678 1.25698 5.85086 1.45906 5.85086 1.69823V2.34448H14.1474V1.69823C14.1474 1.45906 14.2304 1.25698 14.3966 1.09198C14.5626 0.926982 14.7645 0.844482 15.0024 0.844482C15.2474 0.844482 15.4539 0.926982 15.6219 1.09198C15.79 1.25698 15.8741 1.45906 15.8741 1.69823V2.34448H17.4454C17.907 2.34448 18.3073 2.51398 18.6461 2.85298C18.9851 3.19181 19.1546 3.59207 19.1546 4.05373V19.4462C19.1546 19.9062 18.9851 20.3051 18.6461 20.6427C18.3073 20.9806 17.907 21.1495 17.4454 21.1495H2.55286ZM2.55286 19.4462H17.4454V8.74998H2.55286V19.4462ZM2.55286 7.24998H17.4454V4.05373H2.55286V7.24998Z"
                fill="currentColor"
              />
            </svg>
            Events
          </Link>
          <Link
            href="/learn"
            className="flex items-center gap-2 text-gray-700 font-medium hover:text-blue-600"
            onClick={() => setIsOpen(false)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M6.74911 22.1496C5.95394 22.1496 5.27194 21.8879 4.70311 21.3646C4.13411 20.8414 3.84961 20.1909 3.84961 19.4131V5.36686C3.84961 4.7057 4.04986 4.11661 4.45036 3.59961C4.85086 3.08261 5.37311 2.75595 6.01711 2.61961L13.4421 1.07336C13.9724 0.95753 14.4469 1.07261 14.8654 1.41861C15.2839 1.76461 15.4931 2.20903 15.4931 2.75186V14.9019C15.4931 15.3029 15.3689 15.659 15.1204 15.9704C14.8717 16.2815 14.5485 16.4828 14.1509 16.5741L6.54286 18.2126C6.24786 18.2744 6.00219 18.4194 5.80586 18.6474C5.60936 18.8752 5.51111 19.1311 5.51111 19.4151C5.51111 19.7304 5.63494 19.9881 5.88261 20.1881C6.13028 20.3881 6.41919 20.4881 6.74936 20.4881H18.4931V4.67836C18.4931 4.4447 18.5735 4.24736 18.7344 4.08636C18.8954 3.9252 19.0925 3.84461 19.3259 3.84461C19.5592 3.84461 19.7556 3.9252 19.9151 4.08636C20.0748 4.24736 20.1546 4.4447 20.1546 4.67836V20.4464C20.1546 20.9189 19.9883 21.3209 19.6556 21.6524C19.3229 21.9839 18.9195 22.1496 18.4454 22.1496H6.74911ZM8.67236 16.1269L13.8316 15.0116V2.69186L8.67236 3.75711V16.1269ZM7.01111 16.4824V4.11211L6.51961 4.21211C6.23061 4.27878 5.99028 4.41503 5.79861 4.62086C5.60694 4.82686 5.51111 5.07553 5.51111 5.36686V16.9566C5.66444 16.8659 5.82761 16.7891 6.00061 16.7261C6.17344 16.6631 6.35353 16.6129 6.54086 16.5756L7.01111 16.4824Z"
                fill="currentColor"
              />
            </svg>
            Learn
          </Link>
          <Link
            href="/project"
            className="flex items-center gap-2 text-gray-700 font-medium hover:text-blue-600"
            onClick={() => setIsOpen(false)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
            >
              <path
                d="M19.9996 5.99899C19.9994 5.82052 19.9514 5.64535 19.8607 5.49166C19.77 5.33798 19.6398 5.21137 19.4836 5.12499L10.4616 0.124994C10.3133 0.0433196 10.1468 0.000488281 9.97758 0.000488281C9.80832 0.000488281 9.64182 0.0433196 9.49358 0.124994L0.515577 5.08499C0.359611 5.17136 0.229569 5.29785 0.138919 5.45136C0.0482692 5.60487 0.000307446 5.77983 1.4732e-06 5.95811C-0.0003045 6.13639 0.0470562 6.31151 0.137179 6.46534C0.227301 6.61916 0.356909 6.7461 0.512577 6.83299L9.53458 11.873C9.68311 11.9564 9.85058 12.0004 10.0209 12.0005C10.1913 12.0007 10.3589 11.9571 10.5076 11.874L19.4856 6.87399C19.6415 6.78727 19.7714 6.6604 19.8618 6.50654C19.9522 6.35268 19.9998 6.17744 19.9996 5.99899ZM10.0226 9.85399L3.05958 5.96499L9.97658 2.14299L16.9406 6.00199L10.0226 9.85399Z"
                fill="currentColor"
              />
              <path
                d="M18.5145 9.12598L9.99955 13.856L1.48455 9.12598L0.51355 10.874L9.51355 15.874C9.66207 15.9565 9.82916 15.9997 9.99905 15.9997C10.1689 15.9997 10.336 15.9565 10.4845 15.874L19.4846 10.874L18.5145 9.12598Z"
                fill="currentColor"
              />
              <path
                d="M18.5145 13.126L9.99955 17.856L1.48455 13.126L0.51355 14.874L9.51355 19.874C9.66207 19.9565 9.82916 19.9997 9.99905 19.9997C10.1689 19.9997 10.336 19.9565 10.4845 19.874L19.4846 14.874L18.5145 13.126Z"
                fill="currentColor"
              />
            </svg>
            Project
          </Link>
          <Link
            href="/feedback"
            className="flex items-center gap-2 text-gray-700 font-medium hover:text-blue-600"
            onClick={() => setIsOpen(false)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M6.74911 14.0249H13.0741C13.2866 14.0249 13.4648 13.9526 13.6086 13.8079C13.7523 13.6634 13.8241 13.4842 13.8241 13.2704C13.8241 13.0567 13.7523 12.8791 13.6086 12.7374C13.4648 12.5957 13.2866 12.5249 13.0741 12.5249H6.74911C6.53661 12.5249 6.35853 12.5972 6.21486 12.7419C6.07103 12.8864 5.99911 13.0656 5.99911 13.2794C5.99911 13.4931 6.07103 13.6707 6.21486 13.8124C6.35853 13.9541 6.53661 14.0249 6.74911 14.0249ZM6.74911 10.7749H17.2491C17.4616 10.7749 17.6398 10.7026 17.7836 10.5579C17.9273 10.4134 17.9991 10.2342 17.9991 10.0204C17.9991 9.80674 17.9273 9.62907 17.7836 9.4874C17.6398 9.34574 17.4616 9.2749 17.2491 9.2749H6.74911C6.53661 9.2749 6.35853 9.34724 6.21486 9.4919C6.07103 9.6364 5.99911 9.81557 5.99911 10.0294C5.99911 10.2431 6.07103 10.4207 6.21486 10.5624C6.35853 10.7041 6.53661 10.7749 6.74911 10.7749ZM6.74636 7.5249H15.4601C15.6668 7.5249 15.8429 7.45257 15.9886 7.3079C16.1344 7.1634 16.2074 6.98424 16.2074 6.7704C16.2074 6.55674 16.1344 6.37907 15.9886 6.2374C15.8429 6.09574 15.6668 6.0249 15.4601 6.0249H6.74636C6.53569 6.0249 6.35853 6.09724 6.21486 6.2419C6.07103 6.3864 5.99911 6.56557 5.99911 6.7794C5.99911 6.99307 6.07103 7.17074 6.21486 7.3124C6.35853 7.45407 6.53569 7.5249 6.74636 7.5249ZM5.84961 18.1494L3.30411 20.6949C3.03478 20.9642 2.72503 21.0263 2.37486 20.8812C2.02469 20.7362 1.84961 20.4772 1.84961 20.1042V3.55365C1.84961 3.09199 2.01853 2.69174 2.35636 2.3529C2.69403 2.0139 3.09286 1.8444 3.55286 1.8444H13.3606C13.6194 1.8444 13.8364 1.93857 14.0114 2.1269C14.1865 2.31507 14.2534 2.54174 14.2121 2.8069C14.1708 3.01424 14.0704 3.19049 13.9109 3.33565C13.7512 3.48099 13.5678 3.55365 13.3606 3.55365H3.55286V18.2429L5.19961 16.4462H20.4454V8.82215C20.4454 8.58182 20.5276 8.37982 20.6921 8.21615C20.8566 8.05249 21.0595 7.97065 21.3009 7.97065C21.5422 7.97065 21.7448 8.05249 21.9086 8.21615C22.0726 8.37982 22.1546 8.58182 22.1546 8.82215V16.4462C22.1546 16.9062 21.9851 17.305 21.6461 17.6427C21.3073 17.9805 20.907 18.1494 20.4454 18.1494H5.84961ZM18.9976 6.11465C18.2199 6.11465 17.5604 5.8424 17.0191 5.2979C16.4779 4.7534 16.2074 4.09224 16.2074 3.3144C16.2074 2.5414 16.4791 1.88324 17.0226 1.3399C17.5661 0.796568 18.226 0.524902 19.0024 0.524902C19.7789 0.524902 20.4388 0.797319 20.9821 1.34215C21.5253 1.88682 21.7969 2.54674 21.7969 3.3219C21.7969 4.09707 21.5247 4.75632 20.9804 5.29965C20.436 5.84299 19.7751 6.11465 18.9976 6.11465Z"
                fill="currentColor"
              />
            </svg>
            Feedback
          </Link>

          {/* Divider */}
          <div className="border-t border-gray-200 my-4"></div>

          {/* Additional Profile Links */}
          <Link
            href={`/profile/${session?.user.id}`}
            className="block text-gray-700 font-medium hover:text-blue-600"
            onClick={() => setIsOpen(false)}
          >
            My Profile
          </Link>
          <Link
            href="/projects"
            className="block text-gray-700 font-medium hover:text-blue-600"
            onClick={() => setIsOpen(false)}
          >
            My Projects
          </Link>
          <Link
            href="/resources"
            className="block text-gray-700 font-medium hover:text-blue-600"
            onClick={() => setIsOpen(false)}
          >
            Resources
          </Link>
        </nav>

        {session && (
          <div className="p-4 border-t">
            <button
              onClick={handleSignOut}
              className="w-full text-left text-red-600 font-medium hover:bg-red-50 rounded-md px-3 py-2"
            >
              Sign Out
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
