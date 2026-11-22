/**
 * Strict Zero-Trust Domain Types for Citizen Reporting System
 */

export type ReportCategory =
  | 'infrastructure'
  | 'sanitation'
  | 'lighting'
  | 'water'
  | 'other';

export type ReportStatus = 'pending' | 'in_progress' | 'resolved' | 'completed';

export type ReportPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Verified RBAC Roles encoded inside Firebase Auth Custom Claims (`request.auth.token.role`):
 * - civil / citizen: Public mobile registration; reports issues & upvotes
 * - employee: Pre-provisioned municipal worker; transitions pending -> in_progress -> resolved
 * - admin: Pre-provisioned administrator; triage, reassign, delete & manage users
 */
export type UserRole = 'civil' | 'citizen' | 'employee' | 'admin';

export const isCivilianRole = (role?: string | null): boolean =>
  role === 'civil' || role === 'citizen';

export interface ReportLocation {
  latitude: number;
  longitude: number;
  address: string;
  city?: string;
}

export interface ResolutionData {
  resolvedAt: string; // ISO string timestamp
  resolvedBy: string; // Verified staff UID
  resolvedByName: string; // Staff Display Name
  afterImageUrl: string; // Download URL stored at reports/{id}/resolution_proof/
  afterImagePath: string; // Storage path in bucket
  notes: string; // Official work notes
}

export interface CivicReport {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  status: ReportStatus;
  priority?: ReportPriority;
  location: ReportLocation;
  region: string; // Délégation / Mo3tamdiya (e.g., 'Sousse Médina', 'Hammam Sousse')
  imageUrl: string; // "Before" evidence URL
  photoBeforeUrl?: string | null; // Optional alias for "Before" defect URL
  imagePath: string; // Storage path in bucket
  photoAfterUrl?: string | null; // Top-level mandatory proof URL verified by Firestore rules
  userId: string; // Citizen reporter UID
  userDisplayName: string;
  upvotesCount: number;
  upvotedBy: string[]; // Array of authenticated UIDs who upvoted
  resolution?: ResolutionData | null;
  assignedTo?: string | null; // Optional pre-provisioned employee UID assigned by admin
  assignedToName?: string | null;
  assignedAt?: any; // Timestamp when taken in charge by staff
  inProgressAt?: any; // Timestamp when status moved to in_progress
  resolvedBy?: string | null;
  resolvedAt?: any;
  completedBy?: string | null;
  completedAt?: any;
  resolutionNote?: string | null;
  deletionReason?: string | null;
  deletedBy?: string | null;
  archivedAt?: any;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface ReportComment {
  id: string;
  reportId: string;
  userId: string;
  userDisplayName: string;
  userRole: UserRole;
  text: string;
  createdAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  role: UserRole;
  assignedRegion?: string | null; // e.g., 'Sousse Médina', 'Hammam Sousse', or 'ALL' for Super-Admin
  isSuperAdmin?: boolean;
  isActive?: boolean; // Account status: false = suspended by Admin
  pushToken?: string | null;
  points: number;
  badge: 'Novice Watcher' | 'Active Citizen' | 'Civic Guardian' | 'Community Hero';
  reportsCount: number;
  resolvedCount: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface StaffMember {
  uid: string;
  displayName: string;
  email: string;
  role: 'employee' | 'admin';
  assignedRegion: string;
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface MunicipalNotification {
  id: string;
  type: 'NEW_REPORT';
  reportId: string;
  title: string;
  body: string;
  region: string;
  createdAt: any;
  read?: boolean;
}
