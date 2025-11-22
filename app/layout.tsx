import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/utils/Providers";
import { AuthProvider } from "@/features/user/authentication/auth/AuthProvider";
import { AuthContextProvider } from "@/features/user/authentication/auth/AuthContext";
import { StagewiseToolbarWrapper } from "@/components/StagewiseToolbarWrapper";
import { ConditionalNavbar } from "@/components/layout/ConditionalNavbar";
import { ConditionalLayout } from "@/components/layout/ConditionalLayout";
import { LayoutConfigProvider } from "@/components/layout/LayoutConfigProvider";
import { ConditionalAnnouncement } from "@/components/layout/ConditionalAnnouncement";
import { ACTIVE_BRAND, getBrandCssVariables } from "@/lib/config/brands";

const inter = Inter({
  subsets: ["latin"],
  display: "optional",
});

export const metadata: Metadata = {
  title: ACTIVE_BRAND.meta.title,
  description: ACTIVE_BRAND.meta.description,
  icons: {
    icon: ACTIVE_BRAND.meta.favicon ?? "/mentormate.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const brandStyles = getBrandCssVariables(ACTIVE_BRAND);
  const bodyClassName = `${inter.className} brand-${ACTIVE_BRAND.key}`;

  return (
    <html
      lang="en"
      data-brand={ACTIVE_BRAND.key}
      style={brandStyles}
      className={`brand-${ACTIVE_BRAND.key}`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=optional"
        />
      </head>
      <body className={bodyClassName}>
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
            </LayoutConfigProvider>
          </AuthContextProvider>
        </Providers>
      </body>
    </html>
  );
}
