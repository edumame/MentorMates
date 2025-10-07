import Link from "next/link";
import React from "react";

const HomeIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M9 22V12H15V22M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z"
      stroke="#09090B"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const EventIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M16 2V6M8 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z"
      stroke="#09090B"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BookIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M6.74911 22.1496C5.95394 22.1496 5.27194 21.8879 4.70311 21.3646C4.13411 20.8414 3.84961 20.1909 3.84961 19.4131V5.36686C3.84961 4.7057 4.04986 4.11661 4.45036 3.59961C4.85086 3.08261 5.37311 2.75595 6.01711 2.61961L13.4421 1.07336C13.9724 0.95753 14.4469 1.07261 14.8654 1.41861C15.2839 1.76461 15.4931 2.20903 15.4931 2.75186V14.9019C15.4931 15.3029 15.3689 15.659 15.1204 15.9704C14.8717 16.2815 14.5485 16.4828 14.1509 16.5741L6.54286 18.2126C6.24786 18.2744 6.00219 18.4194 5.80586 18.6474C5.60936 18.8752 5.51111 19.1311 5.51111 19.4151C5.51111 19.7304 5.63494 19.9881 5.88261 20.1881C6.13028 20.3881 6.41919 20.4881 6.74936 20.4881H18.4931V4.67836C18.4931 4.4447 18.5735 4.24736 18.7344 4.08636C18.8954 3.9252 19.0925 3.84461 19.3259 3.84461C19.5592 3.84461 19.7556 3.9252 19.9151 4.08636C20.0748 4.24736 20.1546 4.4447 20.1546 4.67836V20.4464C20.1546 20.9189 19.9883 21.3209 19.6556 21.6524C19.3229 21.9839 18.9195 22.1496 18.4454 22.1496H6.74911ZM8.67236 16.1269L13.8316 15.0116V2.69186L8.67236 3.75711V16.1269ZM7.01111 16.4824V4.11211L6.51961 4.21211C6.23061 4.27878 5.99028 4.41503 5.79861 4.62086C5.60694 4.82686 5.51111 5.07553 5.51111 5.36686V16.9566C5.66444 16.8659 5.82761 16.7891 6.00061 16.7261C6.17344 16.6631 6.35353 16.6129 6.54086 16.5756L7.01111 16.4824Z"
      fill="black"
    />
  </svg>
);

const ProjectIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M11 3V11L14 8L17 11V3M5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3Z"
      stroke="#09090B"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FeedbackIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M18 9H20C20.5304 9 21.0391 9.21071 21.4142 9.58579C21.7893 9.96086 22 10.4696 22 11V22L18 18H12C11.4696 18 10.9609 17.7893 10.5858 17.4142C10.2107 17.0391 10 16.5304 10 16V15M14 9C14 9.53043 13.7893 10.0391 13.4142 10.4142C13.0391 10.7893 12.5304 11 12 11H6L2 15V4C2 2.9 2.9 2 4 2H12C12.5304 2 13.0391 2.21071 13.4142 2.58579C13.7893 2.96086 14 3.46957 14 4V9Z"
      stroke="#09090B"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ProfileIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle
      cx="12"
      cy="8"
      r="4"
      stroke="#09090B"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4 20C4 16.6863 7.13401 14 12 14C16.866 14 20 16.6863 20 20"
      stroke="#09090B"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SupportIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="#09090B"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.09 9C9.325 8.331 9.988 7.833 10.8 7.833C11.612 7.833 12.275 8.331 12.51 9C12.745 9.669 12.082 10.167 11.27 10.167C10.458 10.167 9.795 10.665 9.56 11.334C9.325 12.003 9.988 12.501 10.8 12.501C11.612 12.501 12.275 12.003 12.51 11.334"
      stroke="#09090B"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="12"
      cy="16"
      r="1"
      fill="#09090B"
    />
  </svg>
);

const data = [
  { name: "Home", href: "/", icon: HomeIcon },
  { name: "Event", href: "/events", icon: EventIcon },
  { name: "Learn", href: "/learn", icon: BookIcon },
  { name: "Project", href: "/project", icon: ProjectIcon },
  { name: "Feedback", href: "/feedback", icon: FeedbackIcon },
];

const bottomLinks = [
  { name: "Support", href: "/support", icon: SupportIcon },
  { name: "Profile", href: "/profile", icon: ProfileIcon },
];

export function SideNav() {
  return (
    <div className="p-4 w-[240px] h-full flex flex-col justify-between">
      <div className="flex flex-col gap-2">
        {data.map((item) => (
          <Link
            href={item.href}
            key={item.name}
            className="flex items-center gap-2 hover:bg-blue-100/50 hover:rounded-md w-full p-2"
          >
            {item.icon}
            {item.name}
          </Link>
        ))}
      </div>
      <div className="flex flex-col gap-2 mt-8">
        {bottomLinks.map((item) => (
          <Link
            href={item.href}
            key={item.name}
            className="flex items-center gap-2 hover:bg-blue-100/50 hover:rounded-md w-full p-2"
          >
            {item.icon}
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
