export type WaveUrgency = "calm" | "eager" | "frantic" | "desperate";

export type HelpRequestStatus =
  | "idle"
  | "waiting"
  | "connected"
  | "in_session"
  | "ending";

export interface HelpRequest {
  id: string;
  teamName: string;
  projectName?: string;
  raisedAt: Date;
  status: HelpRequestStatus;
  mentorName?: string;
}

export interface HighFiveStats {
  highFiveCount: number;
  mentorName: string;
}
