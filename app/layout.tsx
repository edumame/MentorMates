import { Inter } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Providers } from "@/components/utils/Providers";
import { AuthProvider } from "@/features/user/authentication/auth/AuthProvider";
import { AuthContextProvider } from "@/features/user/authentication/auth/AuthContext";
import { ConditionalNavbar } from "@/components/layout/ConditionalNavbar";
import { ConditionalLayout } from "@/components/layout/ConditionalLayout";
import { LayoutConfigProvider } from "@/components/layout/LayoutConfigProvider";
import { FloatingSupportButton } from "@/components/layout/FloatingSupportButton";
import { JsonLd } from "./JsonLd";
import { seoMetadata } from "./seo-metadata";

const inter = Inter({
  subsets: ["latin"],
  display: "optional",
});

export const metadata = seoMetadata;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=optional"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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
                <ConditionalNavbar />
                <AuthProvider>
                  <ConditionalLayout>
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
