# [Mentor Mates](https://www.mentor-mates.com/)

> ### Exploring the synergy of generative AI and personalized formative feedback.

<!-- thumbnail -->
<img src="/public/img/landing.png" alt="landing">

A Next.js application designed to streamline the process of collecting and managing mentor feedback for projects and hackathons, with comprehensive role-based access control and project scoring systems.

## 🌱 Open source

MentorMates is **open source** under the [MIT License](LICENSE).

**Mission.** Hackathons are a great way to learn new technology, but they often intimidate beginners and people from underrepresented backgrounds. MentorMates gives every participant structured mentorship, feedback and support, so a hackathon is a place where anyone can confidently build something meaningful.

**Community.** We build in the open, with the students, mentors, organizers and partners who use MentorMates. Issues, ideas and pull requests are welcome, and so are hackathon partnerships and collaborations: write to us at [contact@mentormates.ai](mailto:contact@mentormates.ai).

## 🚀 Features

- **Multi-Role Support**: Participants, Mentors, Judges, Organizers, and Admins
- **Project Management**: Submission system with QR code generation for easy access
- **Feedback System**: AI-enhanced mentor feedback with real-time suggestions
- **Event Management**: Complete hackathon lifecycle management
- **Scoring & Judging**: Flexible project scoring with custom criteria
- **Real-time Dashboard**: Role-specific dashboards and analytics
- **Authentication**: OAuth integration with Supabase Auth
- **Dark Mode**: Full dark/light theme support

## 🛠️ Tech Stack

<div>
    <img src="https://img.shields.io/badge/next.js-%23000000.svg?logo=next.js&logoColor=white&style=for-the-badge" alt="Next.js" /> 
    <img src="https://img.shields.io/badge/typescript-%23007acc.svg?logo=typescript&logoColor=white&style=for-the-badge" alt="TypeScript" /> 
    <img src="https://img.shields.io/badge/supabase-%233ecf8e.svg?logo=supabase&logoColor=white&style=for-the-badge" alt="Supabase" /> 
    <img src="https://img.shields.io/badge/tailwindcss-%2338b2ac.svg?logo=tailwind-css&logoColor=white&style=for-the-badge" alt="TailwindCSS" /> 
    <img src="https://img.shields.io/badge/react-%2320232a.svg?logo=react&logoColor=%2361dafb&style=for-the-badge" alt="React" />
</div>

## 📁 Project Structure

### **App Directory (Next.js 15 App Router)**
```
app/
├── (auth)/                    # Authentication route group  
│   ├── login/                 # Main login/signup page
│   ├── auth/                  # OAuth callbacks and error handling
│   └── select-role/           # Role selection after authentication
├── (users)/                   # Authenticated user pages
│   ├── admin/                 # Admin-only access page
│   └── mentor/                # Mentor-specific pages and QR scanning
├── (static)/                  # Public pages (no auth required)
│   ├── about/                 # About page
│   ├── privacy/               # Privacy policy
│   ├── teams/                 # Team information
│   └── terms/                 # Terms of service
├── events/                    # Event management
│   ├── [id]/                  # Dynamic event pages
│   │   ├── dashboard/         # Event organizer dashboard
│   │   ├── feed/              # Event activity feed
│   │   ├── gallery/           # Project gallery
│   │   ├── overview/          # Event overview
│   │   ├── participants/      # Participant management
│   │   ├── submit/            # Project submission
│   │   └── tools/             # Event tools (brainstormer, etc.)
│   └── page.tsx               # Events listing
├── projects/                  # 🆕 UNIFIED PROJECT MANAGEMENT
│   ├── [id]/                  # Unified project view
│   ├── public/[id]/           # Public project showcase
│   ├── join/[id]/[token]/     # Secure project invitations
│   └── page.tsx               # Personal project gallery
├── feedback/                  # Feedback management
│   └── given/                 # Feedback history
├── profile/                   # User profiles
│   └── [userId]/              # Dynamic user profile pages
├── resources/                 # Resource library
├── api/                       # API routes
│   ├── email/                 # Email notifications
│   ├── events/                # Event CRUD operations
│   ├── feedback/              # Feedback processing
│   ├── projects/              # Legacy project API (submit only)
│   └── roles/                 # Role verification and management
└── utils/supabase/            # Next.js specific Supabase utilities
    ├── client.ts              # Client-side Supabase config
    ├── middleware.ts          # Session management middleware
    └── server.ts              # Server-side Supabase config

```

### **Library Structure**
```
lib/
├── config/                    # Configuration files
│   └── constants.ts           # Application constants
├── templates/                 # Email templates
│   ├── feedback-notification.ts
│   ├── project-submission.ts
│   └── project-teammate.ts
├── hooks/                     # Custom React hooks
│   ├── use-media-query.ts     # Responsive design hook
│   ├── use-profile.ts         # User profile management
│   ├── use-project.ts         # Project data management
│   └── use-toast.ts           # Toast notification hook
├── utils/                     # Utility functions
│   ├── invite-links.ts        # Project invitation utilities
│   ├── roles.ts               # Role management utilities
│   └── ui.ts                  # UI utility functions
├── types/                     # TypeScript type definitions
│   └── index.ts               # Application-wide types
├── helpers/                   # Helper functions
│   └── projects.ts            # Project-related helper functions
├── database.types.ts          # Supabase generated types
└── supabase.ts               # Supabase client configuration
```

### **Components Structure**
```
🆕 features/                   # Feature-based component organization
├── projects/                  # 🆕 Project management feature
│   ├── components/
│   │   ├── forms/            # ProjectSubmissionForm, SubmissionConfirmation
│   │   ├── displays/         # ProjectBoard, project cards
│   │   ├── feedback/         # FeedbackForm and management
│   │   └── management/       # Project dashboard and settings
│   ├── api/                  # Complete project API layer
│   │   ├── submit.ts         # Project submission
│   │   ├── update.ts         # Project updates
│   │   ├── delete.ts         # Project deletion
│   │   ├── join.ts           # Team management
│   │   └── feedback.ts       # Feedback management
│   ├── hooks/                # useProject and related hooks
│   └── utils/                # Project-specific utilities
└── user/                     # 🆕 User management feature
    ├── authentication/       # AuthProvider, AuthRedirectProvider
    ├── dashboards/           # All 5 role-specific dashboards
    │   ├── admin-dashboard.tsx
    │   ├── judge-dashboard.tsx
    │   ├── mentor-dashboard.tsx
    │   ├── participant-dashboard.tsx
    │   └── organizer/        # Organizer dashboard components
    │       ├── access/       # Access control (passwords, roles)
    │       ├── details/      # Event details management
    │       ├── participants/ # Participant management
    │       ├── scores/       # Scoring management
    │       ├── submissions/  # Submission management
    │       └── tracks/       # Track and prize management
    ├── profiles/             # Profile management utilities
    └── roles/                # Role management utilities

components/                   # Shared components
├── ui/                      # Design system components (Radix UI + custom)
├── events/                  # Event-related components
├── heroes/                  # Landing page hero components
├── journal/                 # Personal journal components
├── layout/                  # Layout components (navbar, footer, etc.)
├── project-scoring/         # Project scoring system
├── resources/               # Resource library components
└── utils/                   # Utility components
    ├── QRScanner.tsx        # QR code scanning
    ├── UserSearch.tsx       # User search functionality
    └── VoiceInput.tsx       # Voice input component
```

## 🗄️ Database Schema

### **Core Tables**

#### **User Management**
```sql
-- User profiles (extends Supabase auth.users)
user_profiles (
    uid UUID PRIMARY KEY,
    display_name TEXT,
    email TEXT,
    links JSON,
    pulse BIGINT,
    created_at TIMESTAMPTZ
)

-- User roles per event
user_event_roles (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(uid),
    event_id UUID REFERENCES events(event_id),
    role event_role,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(user_id, event_id)
)

-- Role-based passwords for protected access
role_passwords (
    id UUID PRIMARY KEY,
    event_id UUID REFERENCES events(event_id),
    role event_role,
    password_hash TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
```

#### **Event Management**
```sql
-- Events
events (
    event_id UUID PRIMARY KEY,
    event_name TEXT,
    event_date TEXT,
    location TEXT,
    event_description TEXT,
    event_schedule JSONB,
    event_prizes JSONB,
    event_resources JSONB,
    created_at TIMESTAMPTZ,
    rules JSONB,
    cover_image_url TEXT,
    scoring_config JSONB,
    event_blurb TEXT,
    submission_time_start TIMESTAMPTZ,
    submission_time_cutoff TIMESTAMPTZ,
    visibility event_visibility,
    role_labels JSONB,
    slug TEXT
)

-- Event tracks/categories
event_tracks (
    track_id UUID PRIMARY KEY,
    event_id UUID REFERENCES events(event_id),
    name TEXT,
    description TEXT,
    label TEXT,
    prize_amount TEXT,
    prize_description TEXT,
    scoring_criteria JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)

-- Track prizes
prizes (
    id UUID PRIMARY KEY,
    track_id UUID REFERENCES event_tracks(track_id),
    prize_amount TEXT,
    prize_description TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
```

#### **Project Management**
```sql
-- Projects
projects (
    id UUID PRIMARY KEY,
    project_name TEXT,
    lead_name TEXT,
    lead_email TEXT,
    project_description TEXT,
    teammates TEXT[],
    project_url TEXT,
    additional_materials_url TEXT,
    cover_image_url TEXT,
    event_id UUID,
    created_at TIMESTAMPTZ
)

-- Project scores from judges
project_scores (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    judge_id UUID,
    scores JSONB,
    comments TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    track_id UUID,
    event_id UUID
)

-- Project to track relationship
project_tracks (
    project_id UUID REFERENCES projects(id),
    track_id UUID REFERENCES event_tracks(track_id),
    created_at TIMESTAMPTZ
)

-- Mentor feedback
feedback (
    id UUID PRIMARY KEY,
    mentor_id UUID,
    mentor_email TEXT,
    mentor_name TEXT,
    feedback_text TEXT,
    modifier_field TEXT[],
    specific_ai_suggestion TEXT,
    positive_ai_suggestion TEXT,
    actionable_ai_suggestion TEXT,
    original_feedback_text TEXT,
    project_id UUID,
    event_id UUID,
    created_at TIMESTAMPTZ
)

-- Journaling and goals
platform_engagement (
    id UUID PRIMARY KEY,
    user_id UUID,
    event_id UUID,
    type TEXT,
    content TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    display_name TEXT,
    status TEXT,
    is_private BOOLEAN,
    tags TEXT[]
)
```

### **Role Hierarchy & Permissions**

1. **Participant** (Default)
   - Submit projects
   - Join events
   - Access personal dashboard

2. **Mentor** (Password Protected)
   - Provide project feedback
   - Access mentor dashboard
   - QR code scanning

3. **Judge** (Password Protected)
   - Score and evaluate projects
   - Access judging interface
   - View all submissions

4. **Organizer** (Password Protected)
   - Full event management
   - Configure tracks and scoring
   - Manage participants

5. **Admin** (Super User)
   - System-wide access
   - User management
   - Cross-event analytics

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm/yarn/pnpm/bun
- Supabase account and project

### Installation & Setup

1. **Clone the repository:**
```bash
git clone https://github.com/your-username/mentor-mates.git
cd mentor-mates
```

2. **Install dependencies:**
```bash
npm install
```

3. **Environment setup:**
Create `.env.local` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EMAIL_USER=your_email@gmail.com
EMAIL_APP_PASSWORD=your_app_password
```

4. **Database setup:**
```bash
npm run setup-db
```

5. **Start development server:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run setup-db` - Initialize database schema
- `scripts/test-webhook-message-new.sh` - CLI webhook smoke test for the chat `message.new` path

### Testing Docs

- Responses migration CLI test guide: [`RESPONSES_CLI_TESTING.md`](./RESPONSES_CLI_TESTING.md)

## 🏗️ Architecture

The project has undergone a complete architectural transformation from scattered, type-based organization to a clean, feature-based structure. 

**Status**: ✅ **ALL ARCHITECTURAL DEBT RESOLVED!**

For detailed architecture documentation, migration history, and technical decisions, see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Questions, partnership or hackathon ideas: [contact@mentormates.ai](mailto:contact@mentormates.ai).

## 📄 License

Copyright (c) 2026 MentorMates contributors. MentorMates is open source under the MIT License: see the [LICENSE](LICENSE) file. The website shows the same text at `/license`.

Source code: [github.com/edumame/MentorMates](https://github.com/edumame/MentorMates).
