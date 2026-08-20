export type View = 'chat' | 'upload' | 'repository' | 'admin';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LegalDomain {
  id: string;
  title: string;
  description: string;
  icon: string;
  items: {
    label: string;
    value: string;
  }[];
  statutesCount: number;
  themeColor: string;
}

export interface UploadedDoc {
  id: string;
  title: string;
  content: string;
  sections: string[];
  uploadedAt: Date;
  type: 'file' | 'text';
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

// Admin email that has admin access
export const ADMIN_EMAIL = 'nevilsanish@gmail.com';

export interface VerifiedLaw {
  id: string;
  title: string;
  content: string;
  category: string; // maps to LEGAL_DOMAINS id (constitutional, civil, criminal, corporate, labour)
  sections: string[];
  summary: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedBy: string; // user uid
  uploaderName: string;
  uploaderEmail: string;
  verifiedAt: Date | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  createdAt: Date;
  type: 'file' | 'text';
  pdfUrl?: string; // Firebase Storage URL for the original uploaded PDF
  originalFileName?: string; // Original filename of the uploaded file
}
