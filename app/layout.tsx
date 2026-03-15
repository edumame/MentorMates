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
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=optional"
        />
      </head>
      <body className={inter.className}>
        <JsonLd />
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
      </body>
    </html>
  );
}
