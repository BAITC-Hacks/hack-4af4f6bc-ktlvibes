export type TaskStatus = "draft" | "published";

export type RatingLevel = "черновик" | "рабочая" | "готовая" | "приоритетная";

export interface CardFields {
  topic: string;
  title: string;
  context: string;
  need: string;
  users: string;
  dataDescription: string;
  dataAccess: string;
  constraints: string;
  expectedResult: string;
  successMetric: string;
  successTarget: string;
  contact: string;
  interactionFormat: string;
}

export interface RatingItem {
  key: string;
  earned: number;
  max: number;
}

export interface MissingRatingItem {
  key: string;
  hint: string;
}

export interface Rating {
  total: number;
  level: RatingLevel;
  breakdown: RatingItem[];
  missing: MissingRatingItem[];
}

interface TaskBase extends CardFields {
  id: number;
  businessId: number;
  initialDescription: string;
  createdAt: string;
  updatedAt: string;
}

export interface DraftTask extends TaskBase {
  status: "draft";
  score: null;
  rating: null;
  confirmedAt: null;
}

export interface PublishedTask extends TaskBase {
  status: "published";
  score: number;
  rating: Rating;
  confirmedAt: string;
}

export type Task = DraftTask | PublishedTask;

export interface Question {
  field: keyof CardFields;
  text: string;
}

export type QuestionSource = "llm" | "fallback";

export interface QuestionsResponse {
  questions: Question[];
  source: QuestionSource;
}

export interface Business {
  id: number;
  name: string;
}

export interface Team {
  id: number;
  name: string;
  interests: string;
  skills: string;
  technologies: string;
  points: number;
}

export type ProposalStatus = "submitted" | "selected" | "rejected";

export interface Proposal {
  id: number;
  taskId: number;
  teamId: number;
  teamName: string;
  idea: string;
  plan: string;
  duration: string;
  prototypeUrl: string;
  status: ProposalStatus;
  createdAt: string;
}

export interface ProgressConfirmation {
  id: number;
  taskId: number;
  teamId: number;
  note: string;
  points: number;
  confirmedAt: string;
}

export interface DemoActors {
  businesses: Business[];
  teams: Team[];
}

export type DemoActor =
  | { role: "business"; id: number; name: string }
  | { role: "team"; id: number; name: string };
