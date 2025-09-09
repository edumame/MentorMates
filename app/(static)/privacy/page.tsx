"use client";

import React from "react";
import { Footer } from "@/components/layout/footer";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-none shadow-none p-0">
          {/* Page Title */}
          <h1 className="text-3xl font-bold text-center">Terms of Service</h1>
          <p className="text-center text-sm text-gray-500 mt-2">
            Last updated: 8/22/2025
          </p>

          {/* 1. Introduction */}
          <section className="mt-10 border-b border-gray-200 pb-6">
            <h2 className="text-xl font-bold mb-3">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              This Privacy Policy explains how MentorMates (&quot;we&quot;,
              &quot;our&quot;, or &quot;us&quot;) collects, uses, shares, and
              protects your personal information. This policy applies to all
              users of our platform, including mentors, participants, and
              administrators.
            </p>
          </section>

          {/* 2. Information We Collect */}
          <section className="border-b border-gray-200 pb-6 pt-6">
            <h2 className="text-xl font-bold mb-3">2. Information We Collect</h2>

            <h3 className="text-base font-semibold mb-2">
              2.1 Information You Provide
            </h3>
            <ul className="list-disc space-y-1 ml-6 text-gray-700 mb-4">
              <li>Account information (name, email address)</li>
              <li>
                Profile information (professional background, areas of expertise)
              </li>
              <li>Project submissions and feedback</li>
              <li>Communications with other users</li>
            </ul>

            <h3 className="text-base font-semibold mb-2">
              2.2 Automatically Collected Information
            </h3>
            <ul className="list-disc space-y-1 ml-6 text-gray-700">
              <li>Device information (browser type, IP address)</li>
              <li>Usage data (interactions with the platform)</li>
              <li>Cookies and similar technologies</li>
            </ul>
          </section>

          {/* 3. How We Use Your Information */}
          <section className="border-b border-gray-200 pb-6 pt-6">
            <h2 className="text-xl font-bold mb-3">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc space-y-1 ml-6 text-gray-700">
              <li>To provide and maintain our services</li>
              <li>To authenticate your identity through OAuth</li>
              <li>To match mentors with participants</li>
              <li>To facilitate communication between users</li>
              <li>To improve our platform and user experience</li>
              <li>To send important notifications and updates</li>
            </ul>
          </section>

          {/* 4. Information Sharing */}
          <section className="border-b border-gray-200 pb-6 pt-6">
            <h2 className="text-xl font-bold mb-3">4. Information Sharing</h2>
            <p className="text-gray-700 mb-3">
              We do not sell your personal information. We may share your
              information in the following circumstances:
            </p>
            <ul className="list-disc space-y-1 ml-6 text-gray-700">
              <li>
                With other platform users as necessary for the service (e.g.,
                mentors seeing participant profiles)
              </li>
              <li>With service providers who assist in platform operations</li>
              <li>When required by law or to protect rights</li>
              <li>With your consent</li>
            </ul>
          </section>

          {/* 5. OAuth Authentication */}
          <section className="border-b border-gray-200 pb-6 pt-6">
            <h2 className="text-xl font-bold mb-3">5. OAuth Authentication</h2>
            <p className="text-gray-700 mb-3">
              We use OAuth for authentication, which means:
            </p>
            <ul className="list-disc space-y-1 ml-6 text-gray-700">
              <li>You may log in using third-party authentication providers</li>
              <li>We receive basic profile information from these providers</li>
              <li>
                We do not receive or store your passwords for these services
              </li>
              <li>
                You can revoke access through your third-party provider settings
              </li>
            </ul>
          </section>

          {/* 6. Data Security */}
          <section className="border-b border-gray-200 pb-6 pt-6">
            <h2 className="text-xl font-bold mb-3">6. Data Security</h2>
            <p className="text-gray-700 mb-3">
              We implement appropriate technical and organizational measures to
              protect your personal information, including:
            </p>
            <ul className="list-disc space-y-1 ml-6 text-gray-700">
              <li>Encryption of data in transit and at rest</li>
              <li>Regular security assessments</li>
              <li>Access controls and authentication requirements</li>
              <li>Secure data storage practices</li>
            </ul>
          </section>

          {/* 7. Your Rights */}
          <section className="border-b border-gray-200 pb-6 pt-6">
            <h2 className="text-xl font-bold mb-3">7. Your Rights</h2>
            <p className="text-gray-700 mb-3">You have the right to:</p>
            <ul className="list-disc space-y-1 ml-6 text-gray-700">
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your information</li>
              <li>Withdraw consent for data processing</li>
              <li>Export your data</li>
              <li>Object to certain data processing</li>
            </ul>
          </section>

          {/* 8. Updates to This Policy */}
          <section className="border-b border-gray-200 pb-6 pt-6">
            <h2 className="text-xl font-bold mb-3">8. Updates to This Policy</h2>
            <p className="text-gray-700">
              We may update this Privacy Policy from time to time. We will
              notify you of any significant changes through the platform or via
              email.
            </p>
          </section>

          {/* 9. Contact Us */}
          <section className="pt-6">
            <h2 className="text-xl font-bold mb-3">9. Contact Us</h2>
            <p className="text-gray-700 mb-3">
              If you have any questions about this Privacy Policy or our data
              practices, please contact us at:
            </p>
            <p className="text-gray-700">
              Email:{" "}
              <a
                href="mailto:hello@mentor-mates.com"
                className="text-blue-900 hover:underline"
              >
                hello@mentor-mates.com
              </a>
              <br />
              Address: 353 Jane Stanford Way, Stanford University, California
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
