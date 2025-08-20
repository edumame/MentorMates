"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail } from "lucide-react";

type TeamMember = {
  name: string;
  imageUrl: string;
  profileUrl: string;
};

type ProjectDirector = TeamMember & {
  email: string;
};

type TeamGroup = {
  position: string;
  members: TeamMember[];
};

const projectDirector: ProjectDirector = {
  name: "Chinat Yu",
  imageUrl: "/img/Chinat.png",
  profileUrl: "https://www.linkedin.com/in/chinat-yu/",
  email: "chinat@stanford.edu",
};

const teamGroups: TeamGroup[] = [
  {
    position: "Faculty Advisors",
    members: [
      {
        name: "Kristen Blair",
        imageUrl: "/img/Kristen.png",
        profileUrl: "https://profiles.stanford.edu/kristen-blair",
      },
      {
        name: "Glenn Fajardo",
        imageUrl: "/img/Glenn.png",
        profileUrl: "https://dschool.stanford.edu/team-directory/glenn-fajardo",
      },
      {
        name: "Chris Piech",
        imageUrl: "/img/ChrisPiech.jpg",
        profileUrl: "https://stanford.edu/~cpiech/bio/index.html",
      },
    ],
  },
  {
    position: "Research Intern",
    members: [
      {
        name: "Aurelia Sindhunirmala",
        imageUrl: "/img/Lia.png",
        profileUrl: "https://www.linkedin.com/in/aurelia-sindhunirmala/",
      },
      {
        name: "Jeffery Zhou",
        imageUrl: "/img/Jeffery.png",
        profileUrl: "https://www.linkedin.com/in/jeffery-zhou-b8523816a/",
      }
    ],
  },
];

const ProfileImage = ({
  imageUrl,
  name,
}: {
  imageUrl: string;
  name: string;
}) => (
  <motion.div
    className="relative w-40 h-40 mb-6 rounded-full overflow-hidden shadow-lg"
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

export default function TeamGrid() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto pt-16 px-4 sm:px-6">
        <h1 className="mb-8 text-3xl sm:text-4xl md:text-5xl font-bold text-center text-blue-900">
          Our Team
        </h1>

        <motion.section
          id="project-director"
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-semibold text-center mb-6 text-blue-800">
            Project Director
          </h2>
          <div className="flex justify-center">
            <div className="flex flex-col items-center">
              <Link
                href={projectDirector.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ProfileImage
                  imageUrl={projectDirector.imageUrl}
                  name={projectDirector.name}
                />
              </Link>
              <Link
                href={projectDirector.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-md font-medium text-black hover:text-blue-500 transition-colors duration-200"
              >
                {projectDirector.name}
              </Link>
              <Link
                href={`mailto:${projectDirector.email}`}
                className="text-md text-blue-700 hover:text-blue-900 transition-colors duration-200 flex items-center mt-2"
                aria-label={`Email ${projectDirector.name}`}
              >
                <Mail size={20} className="mr-2" />
                {projectDirector.email}
              </Link>

              <div className="mt-8 max-w-3xl text-sm sm:text-base leading-relaxed text-gray-700 px-4 sm:px-0">
                <h3 className="text-lg font-semibold text-blue-800 text-center">Bio</h3>
                <p className="mt-2 text-center">
                  Chinat Yu is a Stanford AI researcher, tech founder, and one of
                  <Link href="https://top.mlh.io/2023/profiles/chinat-yu" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-700 hover:text-blue-900 underline">MLH’s Top 50 Hackers</Link>.
                  He has organized and led initiatives including publishing
                  <Link href="https://acceleratelearning.stanford.edu/story/what-does-ai-mean-for-learners-with-disabilities/" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-700 hover:text-blue-900 underline">white papers</Link>
                  and building platforms such as
                  <Link href="https://www.q2l.app/" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-700 hover:text-blue-900 underline">Quest2Learn</Link>
                  and
                  <Link href="https://ai-playground.io/" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-700 hover:text-blue-900 underline">AI Playground</Link>.
                  His work has been showcased at major events like
                  <Link href="https://stanforddaily.com/2025/05/30/stanford-founders-hosts-90-startups-in-second-ever-demo-day/?utm_campaign=digest&utm_medium=email&utm_source=mailchimp&utm_content=May-30-2025?utm_campaign=digest&utm_medium=email&utm_source=mailchimp&utm_content=May-30-2025" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-700 hover:text-blue-900 underline">Stanford’s 1.2K-person Demo Day</Link>
                  and
                  <Link href="https://ventures.jhu.edu/news/pava-center-continues-to-deepen-relationship-with-the-school-of-education/" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-700 hover:text-blue-900 underline">Johns Hopkins’ first education hackathon at the Pava Center</Link>.
                  Passionate about the intersection of generative AI, entrepreneurial education, and community building, Chinat is currently researching and developing MentorMates, a platform that provides scaffolding and support for hackathons and entrepreneurial events.
                </p>

                <div className="my-6 text-center text-gray-300">⸻</div>

                <p className="text-center">
                  <Link href="https://top.mlh.io/2023/profiles/chinat-yu" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-900 underline">MLH Top 50 Hacker</Link>,
                  <Link href="https://ed.stanford.edu/giving/story/ready-set-solve" target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-700 hover:text-blue-900 underline">Stanford AI + Learning Differences Hackathon</Link>,
                  <Link href="https://stanforddaily.com/2025/05/30/stanford-founders-hosts-90-startups-in-second-ever-demo-day/?utm_campaign=digest&utm_medium=email&utm_source=mailchimp&utm_content=May-30-2025?utm_campaign=digest&utm_medium=email&utm_source=mailchimp&utm_content=May-30-2025" target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-700 hover:text-blue-900 underline">Stanford Demo Day (1.2K attendees)</Link>,
                  <Link href="https://ventures.jhu.edu/news/pava-center-continues-to-deepen-relationship-with-the-school-of-education/" target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-700 hover:text-blue-900 underline">Johns Hopkins Hackathon @ Pava Center</Link>,
                  <Link href="https://acceleratelearning.stanford.edu/story/what-does-ai-mean-for-learners-with-disabilities/" target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-700 hover:text-blue-900 underline">Stanford Hackathon Toolkit White Paper</Link>,
                  <Link href="https://www.q2l.app/" target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-700 hover:text-blue-900 underline">Quest2Learn</Link>,
                  <Link href="https://ai-playground.io/" target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-700 hover:text-blue-900 underline">AI Playground</Link>
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {teamGroups.map((group, index) => (
          <motion.section
            key={index}
            id={group.position.toLowerCase().replace(/\s+/g, "-")}
            className="mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <h2 className="text-2xl font-semibold text-center mb-6 text-blue-800">
              {group.position}
            </h2>
            <div className="flex flex-wrap justify-center gap-16">
              {group.members.map((member, i) => (
                <motion.div
                  key={i}
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <Link
                    href={member.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ProfileImage
                      imageUrl={member.imageUrl}
                      name={member.name}
                    />
                  </Link>
                  <Link
                    href={member.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-md font-medium text-black hover:text-blue-500 transition-colors duration-200"
                  >
                    {member.name}
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.section>
        ))}
      </div>
    </div>
  );
}
