// Core Event Types
export enum EventRoleEnum {
  Participant = 1,
  Mentor = 2,
  Judge = 3,
  Organizer = 4,
  Admin = 5,
}

export enum EventRole {
  Participant = "participant",
  Mentor = "mentor",
  Judge = "judge",
  Organizer = "organizer",
  Admin = "admin",
}

export enum EventVisibility {
  Test = "test",
  Demo = "demo",
  Private = "private",
  Public = "public",
  Draft = "draft",
  Archived = "archived",
}

// Pricing Types
export interface PricingTier {
  id: string;
  event_id: string;
  tier_id: string; // Unique identifier within the event (e.g., "early-bird", "regular")
  name: string;
  price: number; // Price in cents
  stripe_price_id?: string;
  description?: string;
  available_until?: string; // ISO date string for limited-time offers
  max_quantity?: number; // Maximum number of tickets for this tier
  current_quantity?: number; // Current number sold (for tracking)
  is_active?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
  bundle_size?: number;
  _markedForDeletion?: boolean; // Local state flag for pending deletion
}

// Coupon Types
export type CouponStatus = 'active' | 'inactive' | 'expired';
export type CouponDuration = 'once' | 'repeating' | 'forever';

export interface Coupon {
  id: string;
  event_id: string;
  stripe_coupon_id: string;
  name: string;
  percent_off?: number; // Percentage discount (1-100)
  amount_off?: number; // Fixed amount discount in cents
  currency?: string; // Currency for amount_off (e.g., 'usd')
  duration: CouponDuration;
  duration_in_months?: number; // For 'repeating' duration
  max_redemptions?: number; // Maximum uses across all users
  redeem_by?: string; // Expiration date (ISO string)
  status: CouponStatus;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PromoCode {
  id: string;
  coupon_id: string;
  code: string; // The actual promo code (e.g., "EARLYBIRD2024")
  usage_count: number; // Number of times this code has been used
  max_uses?: number; // Maximum uses for this specific code (null = unlimited)
  is_active: boolean; // Whether this code can be used
  created_at: string;
  updated_at: string;
}

export interface CouponWithCodes extends Coupon {
  promo_codes: PromoCode[];
}

export interface CreateCouponRequest {
  couponName: string;
  eventId: string;
  percent_off?: number;
  amount_off?: number;
  currency?: string;
  duration: CouponDuration;
  duration_in_months?: number;
  max_redemptions?: number;
  redeem_by?: string;
  codes?: string[]; // Optional promo codes to create with the coupon
}

export interface UserProfile {
  uid: string;
  display_name: string;
}

export type EventItem = {
  event_id: string;
  slug?: string;
  event_name: string;
  event_date: string;
  location: string;
  visibility?: EventVisibility;
  cover_image_url?: string;
  scoring_config?: EventScoringConfig;
  paid?: boolean;
  stripe_price_id?: string; // Stripe price ID for paid events
  participant_capacity?: number | null; // Max participants; null = unlimited
};

// Event Overview Types
export interface ScheduleEvent {
  name: string;
  time: string;
  description?: string;
}

export interface ScheduleDay {
  time: string;
  events: ScheduleEvent[];
}

export interface Prize {
  id: string;
  track_id: string;
  prize_amount: string;
  prize_description: string;
  winning_project_id?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  created_at?: string;
  updated_at?: string;
  winning_project?: Project;
}

export interface Resource {
  name: string;
  link: string;
}

export interface Rule {
  title: string;
  items: string[];
}

export interface EventTrack {
  track_id: string;
  event_id: string;
  name: string;
  description: string;
  label?: string;
  prizes?: Prize[];
  scoring_criteria: TrackScoringConfig;
  created_at: string;
  updated_at: string;
}

export interface EventDetails extends EventItem {
  event_description: string;
  event_blurb?: string;
  paywall_content?: string;
  event_schedule: ScheduleDay[];
  event_prizes: Prize[];
  event_resources: Resource[];
  created_at: string;
  rules: Rule[];
  event_tracks?: EventTrack[];
  role_labels?: Record<string, string>;
  faq?: string; // Optional markdown FAQ content
  submission_time_start?: string; // Submission window start time
  submission_time_cutoff?: string; // Submission window end time
  sponsorship_tiers?: {
    tiers?: Array<{
      id: string; // e.g., "bronze" | "silver" | "gold" or custom
      label: string;
      price: number; // in cents
      benefits?: string[];
      sort?: number;
    }>;
  } | null;
}

// Project Types
export interface Project {
  id: string;
  project_name: string;
  project_description: string;
  lead_name: string;
  lead_email: string;
  teammates?: string[];
  event_id: string;
  track_ids: string[]; //need to make tracks not required. Will need to redo.
  tracks?: EventTrack[];
  created_at: string;
  project_url?: string;
  video_url?: string | null;
  additional_materials_url?: string;
  cover_image_url?: string;
  event_name?: string;
  prizes_won?: Prize[];
  contextus_project_id?: string;
  submitted?: boolean;
}

export enum ProjectBoardContext {
  MyProjects = "MyProjects",
  EventGallery = "EventGallery",
}

// Feedback Types
export interface FeedbackItem {
  id: string;
  project_id: string;
  mentor_name: string;
  mentor_email?: string;
  feedback_text: string;
  rating: number;
  created_at: string;
}

// Scoring Types
export interface ScoringCriterion {
  id: string;
  name: string;
  description: string;
  weight?: number;
  min?: number;
  max?: number;
  type?: "numeric" | "multiplechoice"; // Type of criterion
  options?: string[]; // Options for choice-based criteria
}

export interface TrackScoringConfig {
  name: string;
  criteria: ScoringCriterion[];
}

export interface EventScoringConfig {
  tracks: Record<string, TrackScoringConfig>;
  defaultMin?: number;
  defaultMax?: number;
  defaultWeight?: number;
}

export interface ProjectScore {
  id: string;
  project_id: string;
  judge_id: string;
  track_id: string;
  event_id: string;
  scores: Record<string, number | string>;
  comments?: string;
  created_at: string;
  updated_at: string;
}

export interface ScoreFormData {
  scores: Record<string, number | string>;
  comments?: string;
}

// Add new type for project-track relationship
export interface ProjectTrack {
  project_id: string;
  track_id: string;
  created_at: string;
}

// API Response Types
export interface ProjectTrackRelation {
  track_id: string;
  event_tracks?: EventTrack[];
}

export interface SupabaseProjectData {
  id: string;
  project_name: string;
  lead_name: string;
  lead_email: string;
  project_description: string;
  teammates: string[];
  project_url?: string;
  additional_materials_url?: string;
  cover_image_url?: string;
  event_id: string;
  created_at: string;
  submitted?: boolean;
  project_tracks?: Array<{
    track_id: string;
    event_tracks?: Array<{
      track_id: string;
      event_id: string;
      name: string;
      description: string;
      label?: string;
      prize_amount?: string;
      prize_description?: string;
      scoring_criteria?: unknown;
      created_at: string;
      updated_at: string;
    }>;
  }>;
  [key: string]: unknown;
}

export interface PrizeWithTrack {
  id: string;
  track_id: string;
  prize_amount: string;
  prize_description: string;
  winning_project_id?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  event_tracks?: Array<{ event_id: string }>;
}

export interface ProjectWithPrizes extends Project {
  prizes_won: Prize[];
}

// API Response Types for Supabase joins
export interface ProjectFromDatabase {
  id: string;
  project_name: string;
  lead_name: string;
  lead_email: string;
  project_description: string;
  teammates: string[];
  project_url?: string;
  additional_materials_url?: string;
  cover_image_url?: string;
  event_id: string;
  created_at: string;
  submitted?: boolean;
  project_tracks?: Array<{
    event_tracks?: EventTrack;
  }>;
}

export interface PrizeFromDatabase {
  id: string;
  track_id: string;
  prize_amount: string;
  prize_description: string;
}

export interface DevpostProjectImport {
  project_url: string;
  project_description: string;
  project_name: string;
  additional_materials_url: string;
  lead_name: string;
  lead_email: string;
  event_id: string;
  video_url?: string;
  teammates?: string[];
}