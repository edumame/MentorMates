import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/utils/Providers";
import { AuthProvider } from "@/features/user/authentication/auth/AuthProvider";
import { StagewiseToolbarWrapper } from "@/components/StagewiseToolbarWrapper";
import { ConditionalNavbar } from "@/components/layout/ConditionalNavbar";
import { ConditionalLayout } from "@/components/layout/ConditionalLayout";
import { LayoutConfigProvider } from "@/components/layout/LayoutConfigProvider";
import { ConditionalAnnouncement } from "@/components/layout/ConditionalAnnouncement";

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
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=optional"
        />
      </head>
      <body className={inter.className}>
        <Providers>
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
        </Providers>
      </body>
    </html>
  );
}
