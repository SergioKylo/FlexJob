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
  async register(name: string, email: string, role: UserRole, lat: number, lng: number, bio?: string, hourlyRate?: number): Promise<{ message: string }> {
    return request<{ message: string }>("/api/auth/register", {
      method: "POST",
      body: { name, email, password: "123456", role, lat, lng, bio: bio ?? "", hourlyRate: hourlyRate ?? 0 } as any,
    });
  },

  async login(email: string, password = "123456"): Promise<User> {
    return request<User>("/api/auth/login", {
      method: "POST",
      body: { email, password } as any,
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
    workDate?: string;
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
      type: (w.category && w.category !== "outros" ? w.category as Category : "casa"),
      city: "Disponível na área",
      pay: w.hourlyRate,
      time: w.startTime && w.endTime ? `${w.startTime} - ${w.endTime}` : "Sempre disponível",
      hours: w.radius,
      days: w.days || "",
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
    category?: string;
    days?: string;
  }): Promise<{ message: string }> {
    return request<{ message: string }>("/api/workers/availability", {
      method: "POST",
      body: availability as any,
    });
  },

  async getMyAvailability(): Promise<{
    lat: number;
    lng: number;
    radius: number;
    startTime: string;
    endTime: string;
    hourlyRate: number;
    isActive: boolean;
    category: string;
    days: string;
  }> {
    return request<any>("/api/workers/availability/me");
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
  async escrowPayment(jobId: number, hours: number, workDate: string, notes: string): Promise<{ message: string; amount: number }> {
    return request<any>("/api/payments/escrow", { method: "POST", body: { jobId, hours, workDate, notes } as any });
  },

  async releasePayment(jobId: number, rating: number, comment: string): Promise<{ message: string; amount: number }> {
    return request<any>("/api/payments/release", { method: "POST", body: { jobId, rating, comment } as any });
  },

  async acceptWorker(jobId: number, workerId: number, accept: boolean): Promise<{ message: string }> {
    return request<{ message: string }>("/api/jobs/accept-worker", {
      method: "POST",
      body: { jobId, workerId, accept } as any,
    });
  },

  async tipWorker(jobId: number, amount: number): Promise<{ message: string }> {
    return request<{ message: string }>("/api/payments/tip", {
      method: "POST",
      body: { jobId, amount } as any,
    });
  },

  async workerReview(jobId: number, rating: number, comment: string): Promise<{ message: string }> {
    return request<{ message: string }>("/api/payments/worker-review", {
      method: "POST",
      body: { jobId, rating, comment } as any,
    });
  },

  async reportConversation(partnerId: number, jobId?: number, reason?: string): Promise<void> {
    await request("/api/chat/report", {
      method: "POST",
      body: { reportedUserId: partnerId, jobId: jobId ?? null, reason: reason ?? "" } as any,
    });
  },

  async proposeJob(params: {
    workerId: number;
    existingJobId?: number;
    title?: string;
    description?: string;
    pay: number;
    duration?: string;
    workDate?: string;
    address?: string;
  }): Promise<{ message: string; jobId: number }> {
    return request<any>("/api/jobs/propose", {
      method: "POST",
      body: {
        workerId: params.workerId,
        existingJobId: params.existingJobId ?? null,
        title: params.title ?? null,
        description: params.description ?? null,
        pay: params.pay,
        duration: params.duration ?? null,
        workDate: params.workDate ?? null,
        address: params.address ?? null,
      } as any,
    });
  },

  async respondToProposal(jobId: number, accept: boolean): Promise<{ message: string }> {
    return request<{ message: string }>("/api/jobs/respond-proposal", {
      method: "POST",
      body: { jobId, accept } as any,
    });
  },

  async closeJob(jobId: number): Promise<{ message: string }> {
    return request<{ message: string }>("/api/jobs/close", {
      method: "POST",
      body: { jobId } as any,
    });
  },

  async updateJob(job: { jobId: number; title: string; description: string; pay: number; duration: string; workDate?: string; address?: string }): Promise<{ message: string }> {
    return request<{ message: string }>("/api/jobs/update", {
      method: "POST",
      body: job as any,
    });
  },

  async updateProfile(name: string, bio: string, avatar?: string): Promise<{ message: string; avatar: string }> {
    return request<{ message: string; avatar: string }>("/api/users/profile", {
      method: "POST",
      body: { name, bio, avatar } as any,
    });
  },

  // Wallet
  async getWallet(): Promise<{ balance: number; escrow: number; transactions: Array<{ title: string; amount: number; partnerName: string; date: string; status: string }> }> {
    return request<any>("/api/wallet");
  },

  // Admin
  admin: {
    async getStats(): Promise<{ userCount: number; workerCount: number; employerCount: number; totalJobs: number; activeJobs: number; totalMessages: number; revenue: number }> {
      return request<any>("/api/admin/stats");
    },
    async getUsers(): Promise<any[]> {
      return request<any[]>("/api/admin/users");
    },
    async getJobs(): Promise<any[]> {
      return request<any[]>("/api/admin/jobs");
    },
    async getMessages(): Promise<any[]> {
      return request<any[]>("/api/admin/messages");
    },
    async deleteUser(id: number): Promise<{ message: string }> {
      return request<any>(`/api/admin/users/${id}`, { method: "DELETE" });
    },
    async deleteJob(id: number): Promise<{ message: string }> {
      return request<any>(`/api/admin/jobs/${id}`, { method: "DELETE" });
    },
    async closeJob(id: number): Promise<{ message: string }> {
      return request<any>(`/api/admin/jobs/${id}/close`, { method: "POST" });
    },
    async getConversations(): Promise<any[]> {
      return request<any[]>("/api/admin/conversations");
    },
    async getConversationMessages(user1Id: number, user2Id: number, jobId?: number): Promise<any[]> {
      const p = new URLSearchParams({ user1Id: String(user1Id), user2Id: String(user2Id) });
      if (jobId != null) p.set("jobId", String(jobId));
      return request<any[]>(`/api/admin/conversation-messages?${p}`);
    },
    async sendMessage(toUserId: number, content: string): Promise<{ message: string }> {
      return request<any>("/api/admin/send-message", {
        method: "POST",
        body: { toUserId, content } as any,
      });
    },
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
