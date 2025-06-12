import React from "react";
import Link from "next/link";

export default function ConfirmationPage() {
  return (
    <div className="max-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-gray-100 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            {/* Email icon */}
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <svg
                className="h-6 w-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>

            {/* Main heading */}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Check Your Email
            </h1>

            {/* Subheading */}
            <p className="text-sm text-gray-600 mb-6">
              We&apos;ve sent a confirmation email to your inbox. Please click
              the link in the email to verify your account.
            </p>

            {/* Additional instructions */}
            <div className="text-left bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                What to do next:
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Check your inbox for our confirmation email</li>
                <li>• Don&apos;t forget to check your spam folder</li>
                <li>• Click the confirmation link in the email</li>
              </ul>
            </div>

            {/* Back to home link */}
            <Link
              href="/"
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
