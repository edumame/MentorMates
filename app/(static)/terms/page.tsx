"use client";

import React from "react";
import { Footer } from "@/components/layout/Footer";

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-none shadow-none p-0">
          {/* Page Title */}
          <h1 className="text-3xl font-bold text-center">Terms &amp; Conditions</h1>
          <p className="text-center text-sm text-gray-500 mt-2">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          {/* 1. Introduction */}
          <section className="mt-10 border-b border-gray-200 pb-6">
            <h2 className="text-xl font-bold mb-3">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms and Conditions govern your use of MentorMates
              (&quot;the Platform&quot;). By accessing or using our platform,
              you agree to be bound by these terms. If you disagree with any
              part of these terms, you may not access the platform.
            </p>
          </section>

          {/* 2. User Accounts */}
          <section className="border-b border-gray-200 pb-6 pt-6">
            <h2 className="text-xl font-bold mb-3">2. User Accounts</h2>
            <ul className="list-disc space-y-1 ml-6 text-gray-700">
              <li>You must be at least 13 years old to use the Platform</li>
              <li>You are responsible for maintaining the security of your account</li>
              <li>You must provide accurate and complete information when creating an account</li>
              <li>You may not use another user&apos;s account without permission</li>
              <li>You must notify us immediately of any unauthorized use of your account</li>
            </ul>
          </section>

          {/* 3. Platform Rules */}
          <section className="border-b border-gray-200 pb-6 pt-6">
            <h2 className="text-xl font-bold mb-3">3. Platform Rules</h2>

            <h3 className="text-base font-semibold mb-2">3.1 General Conduct</h3>
            <ul className="list-disc space-y-1 ml-6 text-gray-700 mb-4">
              <li>Treat all users with respect and professionalism</li>
              <li>Do not engage in harassment or discriminatory behavior</li>
              <li>Do not post inappropriate, offensive, or illegal content</li>
              <li>Do not attempt to disrupt or abuse the Platform&apos;s services</li>
            </ul>

            <h3 className="text-base font-semibold mb-2">3.2 Project Submissions</h3>
            <ul className="list-disc space-y-1 ml-6 text-gray-700">
              <li>Submit only original work or work you have permission to use</li>
              <li>Respect intellectual property rights</li>
              <li>Follow project submission guidelines and deadlines</li>
              <li>Do not submit malicious code or harmful content</li>
            </ul>
          </section>

          {/* 4. Intellectual Property */}
          <section className="border-b border-gray-200 pb-6 pt-6">
            <h2 className="text-xl font-bold mb-3">4. Intellectual Property</h2>
            <ul className="list-disc space-y-1 ml-6 text-gray-700">
              <li>Users retain ownership of their submitted content</li>
              <li>
                Users grant MentorMates a license to use submitted content for platform purposes
              </li>
              <li>MentorMates&apos;s branding and platform content are protected by copyright</li>
              <li>Do not use MentorMates&apos;s intellectual property without permission</li>
            </ul>
          </section>

          {/* 5. Mentorship Guidelines */}
          <section className="border-b border-gray-200 pb-6 pt-6">
            <h2 className="text-xl font-bold mb-3">5. Mentorship Guidelines</h2>
            <ul className="list-disc space-y-1 ml-6 text-gray-700">
              <li>Mentors must provide constructive and professional feedback</li>
              <li>Mentors should respect participant privacy and confidentiality</li>
              <li>Participants should engage actively and respectfully with mentors</li>
              <li>Both parties should maintain professional boundaries</li>
            </ul>
          </section>

          {/* 6. Termination */}
          <section className="border-b border-gray-200 pb-6 pt-6">
            <h2 className="text-xl font-bold mb-3">6. Termination</h2>
            <p className="text-gray-700 mb-3">
              We reserve the right to terminate or suspend accounts that violate these
              terms or for any other reason at our discretion. Upon termination:
            </p>
            <ul className="list-disc space-y-1 ml-6 text-gray-700">
              <li>Access to the platform will be revoked</li>
              <li>Submitted content may be removed</li>
              <li>You remain bound by relevant terms that survive termination</li>
            </ul>
          </section>

          {/* 7. Disclaimers */}
          <section className="border-b border-gray-200 pb-6 pt-6">
            <h2 className="text-xl font-bold mb-3">7. Disclaimers</h2>
            <ul className="list-disc space-y-1 ml-6 text-gray-700">
              <li>The Platform is provided &quot;as is&quot; without warranties</li>
              <li>We do not guarantee continuous, uninterrupted access</li>
              <li>We are not responsible for user-generated content</li>
              <li>Users assume risks associated with platform use</li>
            </ul>
          </section>

          {/* 8. Changes to Terms */}
          <section className="border-b border-gray-200 pb-6 pt-6">
            <h2 className="text-xl font-bold mb-3">8. Changes to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              We may modify these terms at any time. Continued use of the Platform after
              changes constitutes acceptance of the modified terms. We will notify users
              of significant changes through the platform or via email.
            </p>
          </section>

          {/* 9. Contact Us */}
          <section className="pt-6">
            <h2 className="text-xl font-bold mb-3">9. Contact Us</h2>
            <p className="text-gray-700 mb-3">
              If you have any questions about these Terms and Conditions, please contact us at:
            </p>
            <p className="text-gray-700">
              Email:{" "}
              <a href="mailto:admin@mentormates.ai" className="text-blue-900 hover:underline">
                admin@mentormates.ai
              </a>
              <br />
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
