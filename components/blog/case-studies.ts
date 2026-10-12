export interface CaseStudySection {
    heading: string;
    paragraphs?: string[];
    bullets?: string[];
    image?: {
        src: string;
        alt: string;
    };
}

export interface CaseStudy {
    slug: string;
    title: string;
    excerpt: string;
    category: "Hackathons" | "Workshops" | "Corporate Innovation";
    date: string;
    readTime: string;
    thumbnail: string;
    heroAlt: string;
    eyebrow: string;
    introduction: string;
    stats: Array<{ value: string; label: string }>;
    sections: CaseStudySection[];
    sources?: Array<{ label: string; href: string }>;
}

export const caseStudies: CaseStudy[] = [
    {
        slug: "4",
        title: "How 73 Hackers Reimagined the Future of Learning with Goodnotes",
        excerpt:
            "Inside a 48-hour, purpose-driven hackathon where 73 students from more than 15 countries built 21 ideas for the future of learning.",
        category: "Hackathons",
        date: "Jul 12, 2025",
        readTime: "8 min read",
        thumbnail: "/blog/goodnotes-hackathon.jpg",
        heroAlt: "MentorMates Hackathon participants gathered at the Goodnotes office",
        eyebrow: "MentorMates × Goodnotes",
        introduction:
            "Hosted at the Goodnotes office in Hong Kong on July 11–12, 2025, the MentorMates Hackathon brought together students, educators, designers, and builders to tackle real challenges in education. In 48 hours, 73 participants turned lived experience into 21 working concepts—and discovered that meaningful innovation does not require a traditional technical background.",
        stats: [
            { value: "73", label: "participants" },
            { value: "21", label: "projects built" },
            { value: "15+", label: "countries represented" },
            { value: "82%", label: "would recommend it" },
        ],
        sections: [
            {
                heading: "A purpose-driven format",
                paragraphs: [
                    "Teams worked across three focused tracks: AI and special education, AI and workforce learning, and AI and traditional education. The structure narrowed the problem space without prescribing the answer, giving teams room to experiment while keeping their work grounded in a clear human need.",
                    "Mentors and speakers brought perspectives from education, industry, healthcare, and design. Goodnotes employees went beyond sponsorship by opening their workplace, sharing the company’s journey, and coaching teams throughout the build.",
                ],
                bullets: [
                    "Participants chose problems they personally cared about.",
                    "Accessible tools such as Cursor and Magic Loops lowered the barrier to building.",
                    "Continuous feedback helped teams move beyond generic chatbot concepts.",
                ],
            },
            {
                heading: "Projects with a clear reason to exist",
                paragraphs: [
                    "The strongest projects combined technical ambition with a close understanding of the people they aimed to serve. TeachWise, the overall winner, helped educators practise diagnostic questioning through simulated student profiles. Math Buddy turned learning activities for students with ADHD into movement-based challenges.",
                ],
                bullets: [
                    "Memmy created an adaptive Python tutor for different learning styles.",
                    "Learnerator focused on rapid workforce upskilling for unfamiliar tasks.",
                    "Teams consulted educators and special-education practitioners while refining their ideas.",
                ],
                image: {
                    src: "/blog/goodnotes-winners.jpg",
                    alt: "A winning team receiving prizes at the MentorMates Goodnotes Hackathon",
                },
            },
            {
                heading: "Value beyond the weekend",
                paragraphs: [
                    "For participants, the event made building feel accessible and gave them new collaborators across disciplines and countries. For Goodnotes, it created a hands-on talent and research environment: 21 prototypes, direct conversations with emerging builders, and authentic visibility inside the education-technology community.",
                    "The most promising result was the multiplier effect. Participants did not only ask when the next hackathon would happen; several volunteered to organize or mentor one themselves. That progression—from attendee to builder to ecosystem leader—is how an event becomes a movement.",
                ],
            },
        ],
        sources: [
            { label: "MentorMates Hackathon project gallery", href: "https://www.mentormates.ai/events/mmhacks2025/overview" },
        ],
    },
    {
        slug: "5",
        title: "From Idea to Impact: The Johns Hopkins ITGL Hackathon",
        excerpt:
            "How a first-of-its-kind Johns Hopkins event helped global educators turn practical challenges into entrepreneurial projects.",
        category: "Hackathons",
        date: "Mar 1, 2025",
        readTime: "6 min read",
        thumbnail: "",
        heroAlt: "Johns Hopkins ITGL Hackathon",
        eyebrow: "Johns Hopkins University × MentorMates",
        introduction:
            "On March 1, 2025, the International Teaching and Global Leadership program at Johns Hopkins University held its first ITGL Hackathon at the Pava Marie LaPere Center for Entrepreneurship. The intensive one-day event asked a global, cross-disciplinary cohort to turn education challenges into practical concepts that could keep growing after the final pitch.",
        stats: [
            { value: "40+", label: "participants" },
            { value: "8", label: "teams" },
            { value: "100%", label: "gained entrepreneurial skills" },
            { value: "75%", label: "planned to continue" },
        ],
        sections: [
            {
                heading: "Designed for every discipline",
                paragraphs: [
                    "The event treated entrepreneurship as a learnable practice, not a role reserved for engineers. A tailored curriculum gave educators, policy thinkers, designers, and technologists a shared process for problem framing, prototyping, feedback, and pitching.",
                    "Mentors from the Pava Center helped teams connect ambitious ideas to real users and realistic next steps. MentorMates gave teams one place to collect and act on structured feedback as their ideas evolved.",
                ],
            },
            {
                heading: "Global problems, practical concepts",
                paragraphs: [
                    "Participants drew on experience from classrooms and communities around the world. That mix produced solutions with both local relevance and the ability to travel across contexts.",
                ],
                bullets: [
                    "Global Teacher Connect linked educators for peer mentorship and collaborative lesson design.",
                    "EduTrack explored personalized learning progress in resource-constrained schools.",
                    "Cultural Lens helped educators incorporate local culture and languages into curricula.",
                ],
            },
            {
                heading: "Building a path after demo day",
                paragraphs: [
                    "The hackathon connected promising teams with accelerator programs, follow-up mentorship, and opportunities to test ideas in participants’ home countries. That continuity matters: the event was an entry point into entrepreneurship, while the surrounding university ecosystem offered a path to turn a prototype into sustained work.",
                    "The result offers a replicable model for universities that want entrepreneurial learning to feel inclusive, globally minded, and tied to real-world action.",
                ],
            },
        ],
        sources: [
            { label: "Johns Hopkins Technology Ventures", href: "https://ventures.jhu.edu/news/pava-center-continues-to-deepen-relationship-with-the-school-of-education/" },
        ],
    },
    {
        slug: "6",
        title: "Designing Without Boundaries: Stanford’s AI + Learning Differences Hackathon",
        excerpt:
            "136 participants and 22 prototypes showed what happens when people with lived experience help lead inclusive AI design.",
        category: "Hackathons",
        date: "Dec 7, 2024",
        readTime: "7 min read",
        thumbnail: "/blog/stanford-learning-differences.jpg",
        heroAlt: "Winners and participants at Stanford's AI and Learning Differences Hackathon",
        eyebrow: "Stanford Accelerator for Learning × MentorMates",
        introduction:
            "Stanford’s AI + Learning Differences Hackathon brought 136 people from seven sectors together for a 12-hour sprint. Their shared question was direct: how can artificial intelligence help every learner thrive? By embedding people with learning differences throughout the process, the event made inclusive design a working method rather than a closing checklist.",
        stats: [
            { value: "136", label: "participants" },
            { value: "22", label: "prototypes" },
            { value: "15+", label: "countries represented" },
            { value: "5", label: "thematic tracks" },
        ],
        sections: [
            {
                heading: "Co-design from the start",
                paragraphs: [
                    "Participants with learning differences joined as builders, mentors, and judges. Their expertise shaped five tracks spanning special education, workforce learning, traditional education, well-being, and assistive technology.",
                    "MentorMates helped teams organize feedback from peers and domain experts in real time. That made iteration visible and kept decisions tied to the experiences of the people each solution was intended to serve.",
                ],
                image: {
                    src: "/blog/stanford-learning-workshop.jpg",
                    alt: "A facilitator maps ideas during Stanford's inclusive AI hackathon",
                },
            },
            {
                heading: "Five solutions with immediate relevance",
                bullets: [
                    "Empower IEP simplified Individualized Education Plans with summaries, translation, and meeting support.",
                    "Maestra explored an AI coordinator for classroom needs and student engagement.",
                    "FeelLink adapted social-emotional learning scenarios to each learner.",
                    "BCBAwesome supported behavioral therapy technicians through AI coaching.",
                    "Roleability used role-playing to build empathy and social adaptability.",
                ],
            },
            {
                heading: "A blueprint for inclusive innovation",
                paragraphs: [
                    "The event produced more than 22 prototypes. It demonstrated that inclusive design attracts broader talent, that lived experience improves product relevance, and that a carefully structured sprint can make sophisticated technology accessible to non-technical contributors.",
                    "For partners, the model created a talent pipeline, fresh research and development signals, and a documented format that other communities can adapt. For learners, it made a stronger promise: innovation can be built with them, not merely for them.",
                ],
            },
        ],
        sources: [
            { label: "Stanford Accelerator for Learning", href: "https://acceleratelearning.stanford.edu/story/what-does-ai-mean-for-learners-with-disabilities/" },
        ],
    },
    {
        slug: "7",
        title: "From Zero to Prototype: A Three-Hour HeyBoss AI Workshop",
        excerpt:
            "A fast, inclusive workshop helped 34 creators move from raw ideas to working AI products—without requiring a coding background.",
        category: "Workshops",
        date: "May 24, 2025",
        readTime: "5 min read",
        thumbnail: "/blog/heyboss-workshop.jpg",
        heroAlt: "Participants at the HeyBoss AI Vibe Coding Workshop",
        eyebrow: "Bay Area Founders Club × HeyBoss AI × MentorMates",
        introduction:
            "On May 24, 2025, the Bay Area Founders Club hosted a three-hour AI Vibe Coding Workshop at Stanford. Sponsored by HeyBoss AI and facilitated by Chinat Yu, the session gave founders, product managers, educators, and students a direct path from idea to functional prototype—with no prior coding experience required.",
        stats: [
            { value: "34", label: "active builders" },
            { value: "3 hrs", label: "idea-to-demo sprint" },
            { value: "100%", label: "completed a project" },
        ],
        sections: [
            {
                heading: "Learning by building",
                paragraphs: [
                    "The workshop replaced passive demonstrations with a guided build. Participants created HeyBoss AI accounts, chose a problem from their own work, and used rapid feedback loops to make something they could actually show by the end of the afternoon.",
                ],
                bullets: [
                    "AI prototyping frameworks for moving from concept to demo.",
                    "AI-assisted debugging without traditional programming.",
                    "Tool-selection and iteration techniques for real workflows.",
                ],
            },
            {
                heading: "Removing the intimidation barrier",
                paragraphs: [
                    "Participants built websites, applications, games, and internal tools. The shared breakthrough was not a particular feature; it was the realization that testing an AI product no longer had to take months or wait for a full engineering team.",
                    "By making HeyBoss AI the working environment—not simply a sponsor logo—the workshop gave every attendee first-hand product experience and a concrete reason to return to the platform after the event.",
                ],
            },
            {
                heading: "Why short workshops can have lasting value",
                paragraphs: [
                    "A focused workshop fills an important gap between curiosity and execution. With the right scaffolding, non-technical professionals can learn enough in a few hours to validate an idea, communicate it more clearly, and decide what deserves deeper investment.",
                ],
            },
        ],
        sources: [{ label: "Workshop event page", href: "https://lu.ma/1m7wcxlx" }],
    },
    {
        slug: "8",
        title: "Unlocking Creative Potential with Magic Loops",
        excerpt:
            "More than 50 participants explored accessible AI prototyping, creating 48 accounts and projects across games, finance, and community tools.",
        category: "Workshops",
        date: "Jul 26, 2025",
        readTime: "5 min read",
        thumbnail: "/blog/magic-loops-workshop.jpg",
        heroAlt: "Participants at the Magic Loops AI Vibe Coding Workshop",
        eyebrow: "Magic Loops × MentorMates",
        introduction:
            "The Magic Loops AI Workshop turned a packed room of creators, developers, and entrepreneurs into active builders. Facilitated by Chinat Yu, the hands-on session showed how quickly a well-scoped idea can become a working automation or prototype when the tools and teaching are designed for experimentation.",
        stats: [
            { value: "50+", label: "attendees" },
            { value: "48", label: "accounts created" },
            { value: "100%", label: "left with next steps" },
        ],
        sections: [
            {
                heading: "A room built around making",
                paragraphs: [
                    "Every participant worked on a live project during the session. Rather than forcing everyone through the same sample app, the workshop encouraged people to bring problems from their own industries and use cases.",
                ],
                image: {
                    src: "/blog/magic-loops-session.jpg",
                    alt: "A live Magic Loops prototyping demonstration",
                },
            },
            {
                heading: "A wide range of ideas",
                bullets: [
                    "AI-enhanced game development tools for assets and character behavior.",
                    "A chess platform for scheduling, rankings, and match analysis.",
                    "Financial tools for portfolio insights and market scenarios.",
                ],
                paragraphs: [
                    "The variety mattered because it let participants learn from one another. A workflow discovered by a game developer could spark a useful pattern for a founder working in finance, while the platform provided a common language for both.",
                ],
            },
            {
                heading: "From curious observer to confident builder",
                paragraphs: [
                    "Participants repeatedly described feeling “unlocked.” The session shortened the distance between an idea and evidence that it could work, leaving people with a prototype or a clearly defined build path rather than a page of notes.",
                    "That confidence is the durable outcome of accessible AI education: people leave prepared to keep testing, refining, and integrating new tools into their work.",
                ],
            },
        ],
        sources: [{ label: "Workshop event page", href: "https://lu.ma/wklnfycu" }],
    },
    {
        slug: "9",
        title: "How Chanel Prototyped AI-Powered Venture Triage in 48 Hours",
        excerpt:
            "A two-day corporate sprint transformed an overloaded wellness opportunity pipeline into a shared rubric and working AI triage prototype.",
        category: "Corporate Innovation",
        date: "Nov 28, 2025",
        readTime: "6 min read",
        thumbnail: "",
        heroAlt: "AI-powered venture triage workshop",
        eyebrow: "Chanel Innovation & Venture Team × MentorMates",
        introduction:
            "Chanel’s innovation and venture team was exploring opportunities across wellness, well-being, and health technology. As leads arrived from accelerators, university programs, incubators, and founders, the team needed a faster and more consistent way to decide what fit its strategy. A two-day hackathon turned that open-ended challenge into a working AI-assisted triage concept.",
        stats: [
            { value: "2 days", label: "from discovery to demo" },
            { value: "1", label: "shared scoring rubric" },
            { value: "48 hrs", label: "to a working prototype" },
        ],
        sections: [
            {
                heading: "Day one: make the hidden criteria explicit",
                paragraphs: [
                    "The sprint began by mapping the existing scouting workflow. Together, the team identified the signals of a strong lead, surfaced implicit decision criteria, and defined what strategic fit meant across wellness opportunities.",
                    "This discovery work was essential. An AI scoring system can only be useful when the organization first agrees on the judgment it should support.",
                ],
            },
            {
                heading: "Day two: turn the rubric into a product",
                paragraphs: [
                    "The second day moved into rapid prototyping and short feedback loops. The team built a lead pipeline, structured scoring model, AI screening agent, and simple dashboard interface for reviewing the highest-priority opportunities.",
                ],
                bullets: [
                    "Read and summarize startup descriptions.",
                    "Evaluate each lead against the co-designed criteria.",
                    "Surface relevant opportunities for human review.",
                ],
            },
            {
                heading: "A prototype and a shared decision system",
                paragraphs: [
                    "The sprint delivered more than software. It gave the team a shared language for lead quality, clearer alignment around wellness priorities, and a model that could be refined without starting from scratch.",
                    "The format also demonstrated a practical alternative to a long discovery cycle. By co-designing and building in the same room, the team could see assumptions, test them immediately, and create momentum for broader uses of AI in scouting and innovation workflows.",
                ],
            },
        ],
    },
];

export const caseStudyBySlug = new Map(caseStudies.map((study) => [study.slug, study]));
