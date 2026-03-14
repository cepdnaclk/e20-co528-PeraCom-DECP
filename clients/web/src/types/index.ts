export type UserRole = "ADMIN" | "STUDENT" | "ALUMNI";

export type ReactionType =
  | "LIKE"
  | "CELEBRATE"
  | "SUPPORT"
  | "LOVE"
  | "HAHA"
  | "INSIGHTFUL";

export interface UserSummary {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export interface Post {
  _id: string;
  author: Omit<UserSummary, "email" | "role">;
  content: string;
  images?: string[];
  video?: string;
  myReaction?: ReactionType | null;
  totalReactions: number;
  reactionCounts: Record<ReactionType, number>;
  commentCount: number;
  repostCount: number;
  originalPostId?: Post | null;
  isEdited: boolean;
  updatedAt?: string;
  createdAt: string;
}

export interface Comment {
  _id: string;
  postId: string;
  author: Omit<UserSummary, "email" | "role">;
  content: string;
  isEdited: boolean;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  status: "active" | "inactive" | "suspended";
  joinDate: string;
  bio?: string;
  graduationYear?: number;
  currentCompany?: string;
  jobTitle?: string;
  skills?: string[];
  linkedIn?: string;
  github?: string;
  online?: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  attachments?: string[];
}

export interface Conversation {
  id: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  isGroup: boolean;
  name?: string;
}

export interface ResearchProject {
  id: string;
  title: string;
  description: string;
  status: "draft" | "ongoing" | "completed" | "cancelled";
  owner: User;
  collaborators: User[];
  createdAt: string;
  tags: string[];
}

export interface Event {
  id: string;
  title: string;
  description: string;
  type: "seminar" | "workshop" | "alumni-talk" | "hackathon";
  date: string;
  location: string;
  status: "upcoming" | "ongoing" | "completed" | "cancelled" | "draft";
  attendees: number;
  maxAttendees: number;
  organizer: User;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: "full-time" | "part-time" | "internship" | "contract";
  remote: boolean;
  description: string;
  postedBy: User;
  postedAt: string;
  industry: string;
  status: "active" | "closed" | "draft";
  applicants: number;
}

export interface Notification {
  id: string;
  type: "message" | "event" | "research" | "job" | "system";
  title: string;
  description: string;
  read: boolean;
  timestamp: string;
}
