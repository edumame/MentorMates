import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-gray-300 dark:text-gray-600">404</h1>
        </div>
        
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Page Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Oops! The page you&apos;re looking for doesn&apos;t exist. It might have been moved, deleted, or you entered the wrong URL.
          </p>
        </div>

        <div className="space-y-4">
          <Button asChild className="w-full">
            <Link href="/">
              Go Back Home
            </Link>
          </Button>
          
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" asChild>
              <Link href="/events">
                Browse Events
              </Link>
            </Button>
            
            <Button variant="outline" asChild>
              <Link href="/join">
                Join Platform
              </Link>
            </Button>
          </div>
          
          <Button variant="ghost" asChild className="w-full">
            <Link href="/about">
              Learn More
            </Link>
          </Button>
        </div>
        
        <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
          <p>Need help? <Link href="/about" className="text-blue-600 dark:text-blue-400 hover:underline">Learn more about MentorMates</Link></p>
        </div>
      </div>
    </div>
  );
}