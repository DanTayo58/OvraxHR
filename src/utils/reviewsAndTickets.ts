import { PlatformReview, SupportTicket, User } from '../types';

const REVIEWS_STORAGE_KEY = 'skima_platform_reviews_v1';
const TICKETS_STORAGE_KEY = 'skima_support_tickets_v1';

// Dedicated Super Admin Authentication Table
export interface SuperAdminRecord {
  id: string;
  username: string;
  passwordHash: string; // Plain/hashed comparison
  name: string;
  email: string;
  role: 'SuperAdmin';
  organization: string;
  isSuperAdmin: true;
}

export const SUPER_ADMIN_CREDENTIALS_TABLE: SuperAdminRecord[] = [
  {
    id: 'super-admin-01',
    username: 'entry-rheivatech-admin',
    passwordHash: 'dantayo58',
    name: 'Rheivatech Master Admin',
    email: 'admin@rheivatech.com',
    role: 'SuperAdmin',
    organization: 'Rheivatech Global Engine',
    isSuperAdmin: true,
  },
];

/**
 * Checks credentials against the dedicated Super Admin authentication table.
 */
export function authenticateSuperAdmin(usernameOrEmail: string, passwordAttempt: string): User | null {
  const norm = (usernameOrEmail || '').trim().toLowerCase();
  const matched = SUPER_ADMIN_CREDENTIALS_TABLE.find(
    (admin) =>
      (admin.username.toLowerCase() === norm || admin.email.toLowerCase() === norm) &&
      admin.passwordHash === passwordAttempt
  );

  if (matched) {
    return {
      id: matched.id,
      username: matched.username,
      name: matched.name,
      email: matched.email,
      company: matched.organization,
      companyId: 'RHEIVA',
      role: 'SuperAdmin',
      isAdmin: true,
      isSuperAdmin: true,
      isEmailVerified: true,
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}

// -------------------------------------------------------------
// REVIEWS MANAGEMENT
// -------------------------------------------------------------

export const REVIEW_CATEGORIES = [
  'Workforce & Attendance',
  'Payroll & Slips',
  'Staff Directory & Dossiers',
  'Performance & Job Contracts (JD)',
  'Biometrics & Hardware Clock-in',
  'Reports & Analytics Exports',
  'User Access & Role Permissions',
  'General Platform Experience',
  'Feature Request',
  'Support & Customer Care',
] as const;

export function loadAllPlatformReviews(): PlatformReview[] {
  try {
    const raw = localStorage.getItem(REVIEWS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const seen = new Set<string>();
        const unique: PlatformReview[] = [];
        for (const item of parsed) {
          if (item && item.id && !seen.has(item.id)) {
            seen.add(item.id);
            unique.push({
              ...item,
              likes: item.likes || (item.likedBy ? item.likedBy.length : 0),
              dislikes: item.dislikes || (item.dislikedBy ? item.dislikedBy.length : 0),
              likedBy: Array.isArray(item.likedBy) ? item.likedBy : [],
              dislikedBy: Array.isArray(item.dislikedBy) ? item.dislikedBy : [],
              replies: Array.isArray(item.replies) ? item.replies : [],
              category: item.category || 'General Platform Experience',
            });
          }
        }
        return unique;
      }
    }
  } catch (e) {
    console.error('Failed to load reviews:', e);
  }
  return [];
}

export function saveAllPlatformReviews(reviews: PlatformReview[]): void {
  try {
    const seen = new Set<string>();
    const unique: PlatformReview[] = [];
    for (const item of reviews) {
      if (item && item.id && !seen.has(item.id)) {
        seen.add(item.id);
        unique.push({
          ...item,
          likes: item.likes || (item.likedBy ? item.likedBy.length : 0),
          dislikes: item.dislikes || (item.dislikedBy ? item.dislikedBy.length : 0),
          likedBy: Array.isArray(item.likedBy) ? item.likedBy : [],
          dislikedBy: Array.isArray(item.dislikedBy) ? item.dislikedBy : [],
          replies: Array.isArray(item.replies) ? item.replies : [],
        });
      }
    }
    localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(unique));
    window.dispatchEvent(new Event('skima_reviews_updated'));
  } catch (e) {
    console.error('Failed to save reviews:', e);
  }
}

export function addPlatformReview(review: Omit<PlatformReview, 'id' | 'createdAt'>): PlatformReview {
  const all = loadAllPlatformReviews();
  const newReview: PlatformReview = {
    ...review,
    id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    likes: 0,
    dislikes: 0,
    likedBy: [],
    dislikedBy: [],
    replies: [],
    category: review.category || 'General Platform Experience',
  };
  const updated = [newReview, ...all];
  saveAllPlatformReviews(updated);
  return newReview;
}

export function updatePlatformReview(reviewId: string, partial: Partial<PlatformReview>): PlatformReview | null {
  const all = loadAllPlatformReviews();
  let updatedRecord: PlatformReview | null = null;
  const updated = all.map((r) => {
    if (r.id === reviewId) {
      updatedRecord = {
        ...r,
        ...partial,
        updatedAt: new Date().toISOString(),
      };
      return updatedRecord;
    }
    return r;
  });

  if (updatedRecord) {
    saveAllPlatformReviews(updated);
  }
  return updatedRecord;
}

export function toggleReviewReaction(
  reviewId: string,
  userId: string,
  type: 'like' | 'dislike'
): PlatformReview | null {
  const all = loadAllPlatformReviews();
  let updatedReview: PlatformReview | null = null;

  const updated = all.map((r) => {
    if (r.id !== reviewId) return r;

    let likedBy = [...(r.likedBy || [])];
    let dislikedBy = [...(r.dislikedBy || [])];

    const hasLiked = likedBy.includes(userId);
    const hasDisliked = dislikedBy.includes(userId);

    if (type === 'like') {
      if (hasLiked) {
        // Toggle off
        likedBy = likedBy.filter((id) => id !== userId);
      } else {
        likedBy.push(userId);
        // Remove from disliked if was disliked
        dislikedBy = dislikedBy.filter((id) => id !== userId);
      }
    } else if (type === 'dislike') {
      if (hasDisliked) {
        // Toggle off
        dislikedBy = dislikedBy.filter((id) => id !== userId);
      } else {
        dislikedBy.push(userId);
        // Remove from liked if was liked
        likedBy = likedBy.filter((id) => id !== userId);
      }
    }

    updatedReview = {
      ...r,
      likedBy,
      dislikedBy,
      likes: likedBy.length,
      dislikes: dislikedBy.length,
    };
    return updatedReview;
  });

  if (updatedReview) {
    saveAllPlatformReviews(updated);
  }
  return updatedReview;
}

export function addReviewReply(
  reviewId: string,
  reply: {
    authorId?: string;
    authorName: string;
    authorRole: string;
    companyName?: string;
    departmentName?: string;
    message: string;
    isOfficialSupport?: boolean;
  }
): PlatformReview | null {
  const all = loadAllPlatformReviews();
  let updatedReview: PlatformReview | null = null;

  const updated = all.map((r) => {
    if (r.id !== reviewId) return r;
    const replies = r.replies || [];
    const newReply = {
      ...reply,
      id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    updatedReview = {
      ...r,
      replies: [...replies, newReply],
    };
    return updatedReview;
  });

  if (updatedReview) {
    saveAllPlatformReviews(updated);
  }
  return updatedReview;
}

export function deleteReviewReply(reviewId: string, replyId: string): PlatformReview | null {
  const all = loadAllPlatformReviews();
  let updatedReview: PlatformReview | null = null;

  const updated = all.map((r) => {
    if (r.id !== reviewId) return r;
    const replies = (r.replies || []).filter((rep) => rep.id !== replyId);
    updatedReview = {
      ...r,
      replies,
    };
    return updatedReview;
  });

  if (updatedReview) {
    saveAllPlatformReviews(updated);
  }
  return updatedReview;
}

export function deletePlatformReview(reviewId: string): void {
  const all = loadAllPlatformReviews();
  const updated = all.filter((r) => r.id !== reviewId);
  saveAllPlatformReviews(updated);
}

// -------------------------------------------------------------
// SUPPORT TICKETS MANAGEMENT
// -------------------------------------------------------------

export function loadAllSupportTickets(): SupportTicket[] {
  try {
    const raw = localStorage.getItem(TICKETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const seen = new Set<string>();
        const unique: SupportTicket[] = [];
        for (const item of parsed) {
          if (item && item.id && !seen.has(item.id)) {
            seen.add(item.id);
            unique.push(item);
          }
        }
        return unique;
      }
    }
  } catch (e) {
    console.error('Failed to load support tickets:', e);
  }
  return [];
}

export function saveAllSupportTickets(tickets: SupportTicket[]): void {
  try {
    const seen = new Set<string>();
    const unique: SupportTicket[] = [];
    for (const item of tickets) {
      if (item && item.id && !seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
      }
    }
    localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(unique));
    window.dispatchEvent(new Event('skima_tickets_updated'));
  } catch (e) {
    console.error('Failed to save support tickets:', e);
  }
}

export function createSupportTicket(ticket: Omit<SupportTicket, 'id' | 'ticketNumber' | 'createdAt' | 'status'>): SupportTicket {
  const all = loadAllSupportTickets();
  const ticketNumber = `SKM-TKT-${Math.floor(100000 + Math.random() * 900000)}`;
  const now = new Date().toISOString();
  
  const initialMessages = ticket.messages && ticket.messages.length > 0 
    ? ticket.messages 
    : [
        {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          sender: 'client' as const,
          authorName: ticket.authorName || 'Client',
          text: ticket.message,
          timestamp: now,
        },
      ];

  const newTicket: SupportTicket = {
    ...ticket,
    id: `tkt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    ticketNumber,
    status: 'Open',
    createdAt: now,
    lastMessageAt: now,
    unreadBySupport: true,
    unreadByClient: false,
    messages: initialMessages,
  };
  const updated = [newTicket, ...all];
  saveAllSupportTickets(updated);
  return newTicket;
}

export function updateSupportTicketStatus(ticketId: string, status: SupportTicket['status'], adminNote?: string): void {
  const all = loadAllSupportTickets();
  const updated = all.map((t) => {
    if (t.id === ticketId) {
      return {
        ...t,
        status,
        adminNote: adminNote !== undefined ? adminNote : t.adminNote,
      };
    }
    return t;
  });
  saveAllSupportTickets(updated);
}

/**
 * Appends a message to the ticket conversation.
 * If client sends, marks unread for support and sets status to Open if previously closed or pending.
 * If support sends, marks unread for client.
 */
export function addTicketMessage(
  ticketId: string,
  sender: 'client' | 'support',
  authorName: string,
  text: string
): SupportTicket | null {
  const all = loadAllSupportTickets();
  let resultTicket: SupportTicket | null = null;
  const now = new Date().toISOString();

  const updated = all.map((t) => {
    if (t.id !== ticketId) return t;

    const currentMessages = t.messages || [
      {
        id: `msg-orig-${t.id}`,
        sender: 'client' as const,
        authorName: t.authorName || 'Client',
        text: t.message,
        timestamp: t.createdAt,
      },
    ];

    const newMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender,
      authorName,
      text,
      timestamp: now,
    };

    const nextStatus = sender === 'client' && t.status === 'Closed' ? 'Open' : t.status;

    resultTicket = {
      ...t,
      status: nextStatus,
      messages: [...currentMessages, newMsg],
      lastMessageAt: now,
      unreadBySupport: sender === 'client' ? true : false,
      unreadByClient: sender === 'support' ? true : false,
    };

    return resultTicket;
  });

  if (resultTicket) {
    saveAllSupportTickets(updated);
  }
  return resultTicket;
}

/**
 * When support desk opens an inquiry card:
 * If status is Open, automatically change status to 'In Review'.
 * Clears unread notification for support.
 */
export function markTicketOpenedBySupport(ticketId: string): SupportTicket | null {
  const all = loadAllSupportTickets();
  let updatedRecord: SupportTicket | null = null;

  const updated = all.map((t) => {
    if (t.id !== ticketId) return t;

    // "If the message is not seen, the status should be set to open. When it is opened, it should be set to 'in review'"
    const nextStatus = t.status === 'Open' ? 'In Review' : t.status;

    updatedRecord = {
      ...t,
      status: nextStatus,
      unreadBySupport: false,
    };
    return updatedRecord;
  });

  if (updatedRecord) {
    saveAllSupportTickets(updated);
  }
  return updatedRecord;
}

/**
 * When client views their chat, mark unread for client as false.
 */
export function markTicketOpenedByClient(ticketId: string): SupportTicket | null {
  const all = loadAllSupportTickets();
  let updatedRecord: SupportTicket | null = null;

  const updated = all.map((t) => {
    if (t.id !== ticketId) return t;
    updatedRecord = {
      ...t,
      unreadByClient: false,
    };
    return updatedRecord;
  });

  if (updatedRecord) {
    saveAllSupportTickets(updated);
  }
  return updatedRecord;
}

/**
 * "only the client can set the status to closed"
 */
export function setTicketClosedByClient(ticketId: string, isClosed: boolean): SupportTicket | null {
  const all = loadAllSupportTickets();
  let updatedRecord: SupportTicket | null = null;

  const updated = all.map((t) => {
    if (t.id !== ticketId) return t;
    updatedRecord = {
      ...t,
      status: isClosed ? 'Closed' : 'Open',
    };
    return updatedRecord;
  });

  if (updatedRecord) {
    saveAllSupportTickets(updated);
  }
  return updatedRecord;
}

export function deleteSupportTicket(ticketId: string): void {
  const all = loadAllSupportTickets();
  const updated = all.filter((t) => t.id !== ticketId);
  saveAllSupportTickets(updated);
}
