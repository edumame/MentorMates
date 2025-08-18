"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

type Contributor = {
  name: string;
  imageUrl: string;
  profileUrl: string;
  role: string;
};

const contributors: Contributor[] = [
  {
    name: "Matthew Law",
    imageUrl: "/img/Matthew.png",
    profileUrl: "https://www.linkedin.com/in/matthew-law-0x251/",
    role: "Research Intern",
  },
  // Add more contributors as needed
];

const ProfileImage = ({
  imageUrl,
  name,
}: {
  imageUrl: string;
  name: string;
}) => (
  <motion.div
    className="relative w-40 h-40 rounded-full overflow-hidden shadow-lg"
    whileHover={{ scale: 1.05 }}
    transition={{ duration: 0.2 }}
  >
    <Image
      src={imageUrl}
      alt={`${name}'s profile picture`}
      fill
      className="object-cover"
    />
  </motion.div>
);

export default function PreviousContributors() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-blue-900 mb-6">
            Previous Contributors
          </h1>
          <p className="text-xl sm:text-2xl text-blue-700 max-w-3xl mx-auto">
            Huge thanks to our previous contributors who helped shape MentorMate into what it is today!
          </p>
        </motion.div>

        <div className="space-y-16">
          {contributors.map((contributor, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="flex flex-col md:flex-row items-center gap-8 bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300"
            >
              <Link
                href={contributor.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0"
              >
                <ProfileImage
                  imageUrl={contributor.imageUrl}
                  name={contributor.name}
                />
              </Link>
              <div className="flex-grow text-center md:text-left">
                <Link
                  href={contributor.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-2xl font-semibold text-blue-900 hover:text-blue-700 transition-colors duration-200"
                >
                  {contributor.name}
                </Link>
                <h3 className="text-lg font-medium text-blue-700 mt-2">
                  {contributor.role}
                </h3>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
