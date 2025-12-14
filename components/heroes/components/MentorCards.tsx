import { VideoIcon } from "lucide-react";
import { data } from "@/lib/MentorData";
import Link from "next/link";

export function MentorCards() {
  return (
    <ul role="list" className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {data.map((mentor) => (
        <li
          key={mentor.id}
          className="col-span-1 flex flex-col divide-y divide-gray-200 rounded-xl bg-white text-center border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 group"
        >
          <div className="flex flex-1 flex-col p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={mentor.name}
              src={mentor.imageUrl}
              className="mx-auto size-32 shrink-0 rounded-full bg-gray-300 outline outline-1 -outline-offset-1 outline-black/5"
            />
            <h3 className="mt-6 text-sm font-medium text-gray-900">{mentor.name}</h3>
            <dl className="mt-1 flex grow flex-col justify-between">
              <dt className="sr-only">Title</dt>
              <dd className="text-sm text-gray-500">{mentor.title}</dd>
              <dt className="sr-only">Role</dt>
              <dd className="mt-3">
                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  {mentor.role}
                </span>
              </dd>
            </dl>
          </div>
          <div>
            <div className="-mt-px flex divide-x divide-gray-200">
              <div className="-ml-px flex w-0 flex-1">
                <Link
                  href={`/call/${mentor.id}`}
                  className="relative inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-br-lg border border-transparent py-4 text-sm font-semibold text-gray-900"
                >
                  <VideoIcon aria-hidden="true" className="size-5 text-gray-400" />
                  Start Call
                </Link>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}