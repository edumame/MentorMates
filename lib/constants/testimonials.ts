export interface Testimonial {
  id: number;
  rating: number;
  quote: string;
  author: string;
  title: string;
  avatar: string;
  logo?: string;
  logoWidth?: number;
  logoHeight?: number;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 1,
    rating: 5,
    quote:
      'Those young entrepreneurs will thrive if they have the "meta AI competency" which I coined at the SXSW a few years ago. Also, I am hoping that they will generate unique foundational questions that will lead to learning, change, and innovation.',
    author: "Paul Kim",
    title: "Former Associate Dean, Stanford Graduate School of Education",
    avatar: "/testimonials/paul.png",
    logo: "/testimonials/stanfordedu.png",
    logoWidth: 117,
    logoHeight: 66,
  },
  {
    id: 2,
    rating: 5,
    quote:
      "This Hackathon provided invaluable insight &mdash; especially bridging the stigma of how you need crazy computer science knowledge for these competitions.",
    author: "Elina Les",
    title: "Participant, Hong Kong",
    avatar: "/testimonials/avatarFallback.png",
    logo: undefined,
    logoWidth: 220,
    logoHeight: 48,
  },
  {
    id: 3,
    rating: 5,
    quote:
      "I've been to a LOT of hackathons, both as a judge and as a hacker. And at the MentorMates hackathon, I saw a level of creativity and efficiency I'd never seen before. These devs were super pragmatic and responsive to feedback. They knew how to ask the right questions before rolling up their sleeves and getting things done.",
    author: "Quincy Larson",
    title: "Founder & Teacher, freeCodeCamp.org",
    avatar: "/testimonials/quincy.png",
    logo: "/testimonials/freecode.png",
    logoWidth: 189,
    logoHeight: 21,
  },
];

// Helper function to get testimonials by ID
export const getTestimonialById = (id: number): Testimonial | undefined => {
  return TESTIMONIALS.find((testimonial) => testimonial.id === id);
};

// Helper function to get random testimonials
export const getRandomTestimonials = (count: number): Testimonial[] => {
  const shuffled = [...TESTIMONIALS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};
