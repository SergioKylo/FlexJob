export type Language = "pt" | "en";

export type UserRole = "worker" | "employer" | "admin";

export type AppView = "map" | "jobs" | "workers" | "messages" | "wallet" | "profile";

export type WorkMode = "need" | "work";

export type Category = "restauracao" | "eventos" | "logistica" | "casa" | "retalho";

export type SortMode = "match" | "pay" | "distance" | "rating";

export type User = {
  id?: number;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  bio?: string;
  rating?: number;
  walletBalance?: number;
  lat?: number;
  lng?: number;
};

export type Opportunity = {
  id: number;
  title: string;
  requester: string;
  type: Category;
  city: string;
  pay: number;
  time: string;
  hours: number;
  rating: number;
  distance: number;
  description: string;
  lat: number;
  lng: number;
  photo?: string;
  address?: string;
  employerId?: number;
};

export type MatchRecord = {
  id: number;
  itemId: number;
  mode: WorkMode;
  title: string;
  city: string;
  pay: number;
  createdAt: string;
};

export type Persona = {
  name: string;
  role: string;
  city: string;
  detail: string;
  initials: string;
};

export type ChatMessage = {
  id: number;
  fromUserId: number;
  toUserId: number;
  jobId?: number;
  fromName: string;
  toName: string;
  content: string;
  messageType?: string;
  createdAt: string;
};

export type InboxConversation = {
  jobId: number;
  jobTitle: string;
  partnerId: number;
  partnerName: string;
  partnerAvatar: string;
  partnerRole: string;
  lastMessage: string;
  lastMessageTime: string;
};
