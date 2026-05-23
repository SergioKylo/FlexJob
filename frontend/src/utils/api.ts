import type { User, UserRole, Opportunity, Category, ChatMessage, InboxConversation } from "../types";

const BASE_URL = ""; // Empty string because Vite proxy will route /api requests to http://backend:8080

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  // Ensure cookies are sent and received
  options.credentials = "include";
  
  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    options.headers = {
      ...options.headers,
      "Content-Type": "application/json",
    };
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${BASE_URL}${url}`, options);

  if (!response.ok) {
    let message = "Ocorreu um erro no servidor.";
    try {
      const errData = await response.json();
      message = errData.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  // Handle empty responses
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }
  return {} as Promise<T>;
}

export const api = {
  // Auth
  async register(name: string, email: string, role: UserRole, lat: number, lng: number): Promise<{ message: string }> {
    return request<{ message: string }>("/api/auth/register", {
      method: "POST",
      body: { name, email, password: "123456", role, lat, lng } as any, // hardcoding a simple password in register for this demo
    });
  },

  async login(email: string): Promise<User> {
    return request<User>("/api/auth/login", {
      method: "POST",
      body: { email, password: "123456" } as any, // hardcoding a simple password
    });
  },

  async logout(): Promise<{ message: string }> {
    return request<{ message: string }>("/api/auth/logout", {
      method: "POST",
    });
  },

  async me(): Promise<User> {
    return request<User>("/api/auth/me", {
      method: "GET",
    });
  },

  // Jobs
  async getJobs(lat?: number, lng?: number, radius?: number): Promise<Opportunity[]> {
    const params = new URLSearchParams();
    if (lat !== undefined) params.append("lat", lat.toString());
    if (lng !== undefined) params.append("lng", lng.toString());
    if (radius !== undefined) params.append("radius", radius.toString());
    
    const query = params.toString() ? `?${params.toString()}` : "";
    const rawJobs = await request<any[]>(`/api/jobs${query}`);
    
    // Map backend job schema to frontend Opportunity schema
    return rawJobs.map((j) => ({
      id: j.id,
      title: j.title,
      requester: j.employerName || "Empregador",
      type: j.category as Category,
      city: j.address || "Local",
      pay: j.pay,
      time: j.duration || "N/A",
      hours: 4, // default
      rating: j.employerRating || 5.0,
      distance: lat !== undefined && lng !== undefined ? parseFloat(calculateDistance(lat, lng, j.lat, j.lng).toFixed(1)) : 0,
      description: j.description,
      lat: j.lat,
      lng: j.lng,
      photo: j.photo,
      address: j.address,
      employerId: j.employerId,
    }));
  },

  async postJob(job: {
    title: string;
    description: string;
    category: string;
    lat: number;
    lng: number;
    address: string;
    pay: number;
    payType: string;
    duration: string;
    photo?: string;
  }): Promise<{ message: string }> {
    return request<{ message: string }>("/api/jobs", {
      method: "POST",
      body: job as any,
    });
  },

  async applyToJob(jobId: number): Promise<{ message: string }> {
    return request<{ message: string }>("/api/jobs/apply", {
      method: "POST",
      body: { jobId } as any,
    });
  },

  // Workers
  async getWorkers(lat?: number, lng?: number, radius?: number): Promise<Opportunity[]> {
    const params = new URLSearchParams();
    if (lat !== undefined) params.append("lat", lat.toString());
    if (lng !== undefined) params.append("lng", lng.toString());
    if (radius !== undefined) params.append("radius", radius.toString());

    const query = params.toString() ? `?${params.toString()}` : "";
    const rawWorkers = await request<any[]>(`/api/workers${query}`);

    // Map backend worker availability schema to frontend Opportunity schema (representing workers as "opportunities" on the map)
    return rawWorkers.map((w) => ({
      id: w.workerId,
      title: w.name,
      requester: "Trabalhador Disponível",
      type: "casa", // fallback category
      city: "Disponível na área",
      pay: w.hourlyRate,
      time: w.startTime && w.endTime ? `${w.startTime} - ${w.endTime}` : "Sempre disponível",
      hours: w.radius,
      rating: w.rating || 5.0,
      distance: lat !== undefined && lng !== undefined ? parseFloat(calculateDistance(lat, lng, w.lat, w.lng).toFixed(1)) : 0,
      description: w.bio || "Sem bio disponível.",
      lat: w.lat,
      lng: w.lng,
    }));
  },

  async getMyJobs(): Promise<any[]> {
    return request<any[]>("/api/jobs/my", {
      method: "GET",
    });
  },

  async getJobApplications(jobId: number): Promise<any[]> {
    return request<any[]>(`/api/jobs/applications?jobId=${jobId}`, {
      method: "GET",
    });
  },

  async respondToApplication(applicationId: number, accept: boolean): Promise<{ message: string }> {
    return request<{ message: string }>("/api/jobs/applications/respond", {
      method: "POST",
      body: { applicationId, accept } as any,
    });
  },

  async updateAvailability(availability: {
    lat: number;
    lng: number;
    radius: number;
    startTime: string;
    endTime: string;
    hourlyRate: number;
    isActive: boolean;
  }): Promise<{ message: string }> {
    return request<{ message: string }>("/api/workers/availability", {
      method: "POST",
      body: availability as any,
    });
  },

  async getReviews(userId: number): Promise<any[]> {
    return request<any[]>(`/api/users/reviews?userId=${userId}`, {
      method: "GET",
    });
  },

  // Messages
  async getInbox(): Promise<InboxConversation[]> {
    return request<InboxConversation[]>("/api/messages/inbox", {
      method: "GET",
    });
  },

  async getMessages(partnerId: number, jobId?: number): Promise<ChatMessage[]> {
    const params = new URLSearchParams();
    params.append("partnerId", partnerId.toString());
    if (jobId !== undefined && jobId > 0) {
      params.append("jobId", jobId.toString());
    }
    return request<ChatMessage[]>(`/api/messages?${params.toString()}`, {
      method: "GET",
    });
  },

  async sendMessage(toUserId: number, content: string, jobId?: number): Promise<{ message: string }> {
    return request<{ message: string }>("/api/messages", {
      method: "POST",
      body: { toUserId, content, jobId } as any,
    });
  },

  // Jobs detail
  async getJobDetail(jobId: number): Promise<{ id: number; title: string; pay: number; duration: string; status: string; paymentStatus: string; employerId: number; employerName: string; workerId?: number; workerName?: string }> {
    return request<any>(`/api/jobs/detail?jobId=${jobId}`);
  },

  // Payments
  async escrowPayment(jobId: number): Promise<{ message: string; amount: number }> {
    return request<any>("/api/payments/escrow", { method: "POST", body: { jobId } as any });
  },

  async releasePayment(jobId: number, rating: number, comment: string): Promise<{ message: string; amount: number }> {
    return request<any>("/api/payments/release", { method: "POST", body: { jobId, rating, comment } as any });
  },

  // Wallet
  async getWallet(): Promise<{ balance: number; escrow: number; transactions: Array<{ title: string; amount: number; partnerName: string; date: string; status: string }> }> {
    return request<any>("/api/wallet");
  },
};

// Distance Helper
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
