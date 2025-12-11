"use client";

import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  // client-side navigation to avoid server-side transition issues and force reload to avoid client side caching issues
  const handleGoHome = () => {
    // Use router.push with a full page reload to avoid client-side transition issues
    // when navigating away from a not-found state within dynamic route layouts
    window.location.href = "/";
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Page Not Found. This page may have been deleted or never existed.
          </h1>
          <button
            onClick={handleGoHome}
            className="text-blue-500 hover:text-blue-600 flex items-center gap-2 mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to home
          </button>
        </div>
      </div>
    </div>
  );
}
