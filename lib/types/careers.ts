export interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  type: 'full-time' | 'part-time' | 'contract' | 'internship';
  remote: boolean;
  salary?: {
    min: number;
    max: number;
    currency: string;
    period: 'hourly' | 'monthly' | 'yearly' | 'per-episode';
  };
  description: string;
  responsibilities: string[];
  requirements: string[];
  qualifications: string[];
  benefits?: string[];
  postedDate: string;
  applicationDeadline?: string;
  contactEmail?: string;
  isActive: boolean;
}

export interface CareerPageData {
  heroTitle: string;
  heroDescription: string;
  jobPostings: JobPosting[];
  companyValues: {
    title: string;
    description: string;
    icon?: string;
  }[];
}