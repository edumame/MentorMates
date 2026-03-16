import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Providers } from "@/components/utils/Providers";
import { AuthProvider } from "@/features/user/authentication/auth/AuthProvider";
import { AuthContextProvider } from "@/features/user/authentication/auth/AuthContext";
import { StagewiseToolbarWrapper } from "@/components/StagewiseToolbarWrapper";
import { ConditionalNavbar } from "@/components/layout/ConditionalNavbar";
import { ConditionalLayout } from "@/components/layout/ConditionalLayout";
import { LayoutConfigProvider } from "@/components/layout/LayoutConfigProvider";
import { ConditionalAnnouncement } from "@/components/layout/ConditionalAnnouncement";
import { FloatingSupportButton } from "@/components/layout/FloatingSupportButton";

const inter = Inter({
  subsets: ["latin"],
  display: "optional",
});

export const metadata: Metadata = {
  title: "MentorMates",
  description: "Connecting mentors and students in hackathons",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=optional"
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {/* Remove extension-injected node before/during hydration to avoid hydration mismatch */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function r(){var e=document.getElementById("pronounceRootElement");e&&e.remove();}r();if(document.body){var o=new MutationObserver(r);o.observe(document.body,{childList:!0,subtree:!0});setTimeout(function(){o.disconnect();},5e3);}else{document.addEventListener("DOMContentLoaded",r);}})();`,
          }}
        />
        <div id="__next" suppressHydrationWarning>
          <Providers>
            <AuthContextProvider>
              <LayoutConfigProvider>
                <ConditionalAnnouncement />
                <ConditionalNavbar />
                <AuthProvider>
                  <ConditionalLayout>
                    {process.env.NODE_ENV === "development" && (
                      <StagewiseToolbarWrapper />
                    )}
                    {children}
                  </ConditionalLayout>
                </AuthProvider>
                <FloatingSupportButton />
              </LayoutConfigProvider>
            </AuthContextProvider>
          </Providers>
        </div>
      </body>
    </html>
  );
}
