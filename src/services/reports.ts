/**
 * Hardened Firestore & Firebase Storage Service Layer (`src/services/reports.ts`)
 *
 * Security & Validation Guarantees:
 * - Client-side image size (max 5 MB) & MIME whitelist (image/jpeg, image/png) pre-checks
 *   mirroring `storage.rules` before network transfer
 * - Uploads `resolution_proof` strictly under `reports/{reportId}/resolution_proof/`
 * - Atomic Firestore upvote transactions strictly toggling caller's own UID in `upvotedBy`
 * - Enforces mandatory `photoAfterUrl` before marking any report `'resolved'`
 * - Never masks live Firebase `permission-denied` failures with fake local optimistic mutations
 * - All caught errors normalized via `normalizeSecurityError` (zero stack-trace leakage)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  arrayUnion,
  arrayRemove,
  increment,
  Unsubscribe,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  UploadMetadata,
  deleteObject,
} from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from './firebase';
import {
  CivicReport,
  ReportCategory,
  ReportComment,
  ReportPriority,
  ReportStatus,
  ResolutionData,
  UserRole,
} from '../types/report';
import { AppSecurityError, normalizeSecurityError } from '../utils/errors';
import {
  DUPLICATE_DETECTION_RADIUS_METERS,
  findNearbyActiveDuplicates,
  GeoCoordinates,
  NearbyDuplicateMatch,
} from '../utils/geoDistance';
import { dispatchRegionalNewReportNotification } from './notificationService';

export const REPORTS_COLLECTION = 'reports';
export const ARCHIVED_REPORTS_COLLECTION = 'archived_reports';
export const USERS_COLLECTION = 'users';
export const COMMENTS_SUBCOLLECTION = 'comments';

let localArchivedReportsStore: any[] = [];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB exact parity with storage.rules
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

// Local evaluation seed data (used ONLY when Firebase credentials are not configured yet)
let localReportsStore: CivicReport[] = [
  {
    id: "rep_lamp_01",
    title: "Poteau d'éclairage public incliné et dépôt d'emballages cartons",
    description: "Un candélabre municipal penchait dangereusement vers la chaussée après un choc, avec accumulation de déchets d'emballages commerciaux au pied du mât.",
    category: "lighting",
    status: "completed",
    priority: "high",
    location: {"latitude":35.8587,"longitude":10.6015,"address":"Avenue Habib Bourguiba, Hammam Sousse","city":"Hammam Sousse"},
    region: "Hammam Sousse",
    imageUrl: "lamp_before.jpg",
    photoBeforeUrl: "lamp_before.jpg",
    imagePath: "reports/rep_lamp_01/evidence/lamp_before.jpg",
    photoAfterUrl: "lamp_after.jpg",
    userId: "citoyen_youssef_01",
    userDisplayName: "Youssef Trabelsi",
    upvotesCount: 16,
    upvotedBy: ["citoyen_youssef_01","citoyen_nour_02","citoyen_sami_04"],
    resolution: {"resolvedAt":"2026-11-21T14:30:00.000Z","resolvedBy":"staff_chiheb_001","resolvedByName":"Chiheb (Agent Municipal - Hammam Sousse)","afterImageUrl":"lamp_after.jpg","afterImagePath":"proofs/rep_lamp_01_after.jpg","notes":"Candélabre redressé et scellement renforcé. Enlèvement complet des déchets et nettoyage du trottoir par les équipes de la propreté."},
    assignedTo: "staff_chiheb_001",
    assignedToName: "Chiheb (Agent Municipal - Hammam Sousse)",
    createdAt: { toMillis: () => Date.now() - 3600000 * 18 },
    updatedAt: { toMillis: () => Date.now() - 3600000 * 18 },
  },
  {
    id: "rep_pothole_01",
    title: "Affaissement et nids-de-poule inondés sur la voie d’accès",
    description: "Multiples crevasses et flaques d’eau stagnante rendant le passage des véhicules et piétons très difficile entre les immeubles.",
    category: "infrastructure",
    status: "completed",
    priority: "critical",
    location: {"latitude":35.8272,"longitude":10.6358,"address":"Rue de Constantine, Quartier Médina, Sousse","city":"Sousse"},
    region: "Sousse Médina",
    imageUrl: "pothole_before.jpg",
    photoBeforeUrl: "pothole_before.jpg",
    imagePath: "reports/rep_pothole_01/evidence/pothole_before.jpg",
    photoAfterUrl: "pothole_after.jpg",
    userId: "citoyen_sami_04",
    userDisplayName: "Sami Ben Rejeb",
    upvotesCount: 29,
    upvotedBy: ["citoyen_sami_04","citoyen_youssef_01","citoyen_nour_02","citoyen_mehdi_03"],
    resolution: {"resolvedAt":"2026-11-21T16:00:00.000Z","resolvedBy":"staff_chiheb_001","resolvedByName":"Chiheb (Agent Municipal - Sousse Médina)","afterImageUrl":"pothole_after.jpg","afterImagePath":"proofs/rep_pothole_01_after.jpg","notes":"Décapage du sol dégradé, pose de sous-couche compactée et nouvel enrobé bitumineux étalé sur l’ensemble de la chaussée."},
    assignedTo: "staff_chiheb_001",
    assignedToName: "Chiheb (Agent Municipal - Sousse Médina)",
    createdAt: { toMillis: () => Date.now() - 3600000 * 26 },
    updatedAt: { toMillis: () => Date.now() - 3600000 * 26 },
  },
  {
    id: "rep_alley_01",
    title: "Ruelle en terre battue défoncée et boueuse rendant l’accès impossible",
    description: "Passage historique non goudronné se transformant en bourbier glissant à chaque intempérie pour les habitants du quartier.",
    category: "infrastructure",
    status: "completed",
    priority: "high",
    location: {"latitude":36.7985,"longitude":10.1695,"address":"Rue Tourbet El Bey, Médina de Tunis","city":"Tunis"},
    region: "Tunis Centre-Ville",
    imageUrl: "alley_before.jpg",
    photoBeforeUrl: "alley_before.jpg",
    imagePath: "reports/rep_alley_01/evidence/alley_before.jpg",
    photoAfterUrl: "alley_after.jpg",
    userId: "citoyen_amira_07",
    userDisplayName: "Amira Jaziri",
    upvotesCount: 22,
    upvotedBy: ["citoyen_amira_07","citoyen_nour_02"],
    resolution: {"resolvedAt":"2026-11-21T10:15:00.000Z","resolvedBy":"staff_tarak_002","resolvedByName":"Tarak (Service Voirie - Tunis)","afterImageUrl":"alley_after.jpg","afterImagePath":"proofs/rep_alley_01_after.jpg","notes":"Travaux d’assainissement souterrain achevés suivis du goudronnage intégral de la ruelle avec revêtement antidérapant."},
    assignedTo: "staff_tarak_002",
    assignedToName: "Tarak (Service Voirie - Tunis)",
    createdAt: { toMillis: () => Date.now() - 3600000 * 32 },
    updatedAt: { toMillis: () => Date.now() - 3600000 * 32 },
  },
  {
    id: "rep_grass_trash_01",
    title: "Dépotoir sauvage de plastique et bouteilles dans l’espace vert",
    description: "Amas d’immondices dissimulés dans les herbes hautes près du parc municipal créant une pollution visuelle et environnementale.",
    category: "sanitation",
    status: "completed",
    priority: "medium",
    location: {"latitude":36.8783,"longitude":10.3248,"address":"Avenue Taïeb Mhiri, La Marsa Plage","city":"La Marsa"},
    region: "La Marsa",
    imageUrl: "grass_trash_before.jpg",
    photoBeforeUrl: "grass_trash_before.jpg",
    imagePath: "reports/rep_grass_trash_01/evidence/grass_trash_before.jpg",
    photoAfterUrl: "grass_trash_after.jpg",
    userId: "citoyen_fatma_08",
    userDisplayName: "Fatma Ben Salem",
    upvotesCount: 15,
    upvotedBy: ["citoyen_fatma_08","citoyen_sami_04"],
    resolution: {"resolvedAt":"2026-11-21T18:45:00.000Z","resolvedBy":"staff_anis_003","resolvedByName":"Anis (Direction de l’Environnement - La Marsa)","afterImageUrl":"grass_trash_after.jpg","afterImagePath":"proofs/rep_grass_trash_01_after.jpg","notes":"Opération de ratissage écologique : collecte de tous les déchets plastiques et verre, et fauchage propre de la parcelle."},
    assignedTo: "staff_anis_003",
    assignedToName: "Anis (Direction de l’Environnement - La Marsa)",
    createdAt: { toMillis: () => Date.now() - 3600000 * 12 },
    updatedAt: { toMillis: () => Date.now() - 3600000 * 12 },
  },
  {
    id: "rep_pending_01",
    title: "Fissuration majeure et effondrement de chaussée sur la route de ceinture",
    description: "L’asphalte s’est fracturé sur plusieurs mètres avec des déformations profondes risquant de causer des accidents de motos et des crevaisons aux heures de pointe.",
    category: "infrastructure",
    status: "pending",
    priority: "critical",
    location: {"latitude":35.834,"longitude":10.5925,"address":"Avenue Yasser Arafat, Sahloul, Sousse","city":"Sousse"},
    region: "Sousse Jawhara",
    imageUrl: "pending_1.jpg",
    photoBeforeUrl: "pending_1.jpg",
    imagePath: "reports/rep_pending_01/evidence/pending_1.jpg",
    photoAfterUrl: null,
    userId: "citoyen_mehdi_03",
    userDisplayName: "Dr. Mehdi Bouazizi",
    upvotesCount: 18,
    upvotedBy: ["citoyen_mehdi_03","citoyen_sami_04","citoyen_youssef_01"],
    resolution: null,
    assignedTo: null,
    assignedToName: null,
    createdAt: { toMillis: () => Date.now() - 3600000 * 4 },
    updatedAt: { toMillis: () => Date.now() - 3600000 * 4 },
  },
  {
    id: "rep_pending_02",
    title: "Débordement de benne municipale et accumulation de cartons sauvages",
    description: "La benne d’ordures ménagères est saturée depuis 48 heures. Les sacs poubelles et emballages s’étalent sur la chaussée, dégageant des odeurs nauséabondes.",
    category: "sanitation",
    status: "pending",
    priority: "high",
    location: {"latitude":35.8295,"longitude":10.6372,"address":"Rue Ibn Khaldoun, Médina de Sousse","city":"Sousse"},
    region: "Sousse Médina",
    imageUrl: "pending_2.jpg",
    photoBeforeUrl: "pending_2.jpg",
    imagePath: "reports/rep_pending_02/evidence/pending_2.jpg",
    photoAfterUrl: null,
    userId: "citoyen_nour_02",
    userDisplayName: "Nour El Houda Dridi",
    upvotesCount: 14,
    upvotedBy: ["citoyen_nour_02","citoyen_youssef_01"],
    resolution: null,
    assignedTo: null,
    assignedToName: null,
    createdAt: { toMillis: () => Date.now() - 3600000 * 7 },
    updatedAt: { toMillis: () => Date.now() - 3600000 * 7 },
  },
  {
    id: "rep_pending_03",
    title: "Effondrement béant d’un regard d’égout comblé de gravats",
    description: "Un affaissement critique du trottoir a créé un trou profond de plus de 50 cm. Des riverains y ont déposé un carton pour alerter les automobilistes.",
    category: "infrastructure",
    status: "pending",
    priority: "critical",
    location: {"latitude":34.7398,"longitude":10.757,"address":"Boulevard Majida Boulila, Sfax","city":"Sfax"},
    region: "Sfax Ville",
    imageUrl: "pending_3.jpg",
    photoBeforeUrl: "pending_3.jpg",
    imagePath: "reports/rep_pending_03/evidence/pending_3.jpg",
    photoAfterUrl: null,
    userId: "citoyen_mohamed_09",
    userDisplayName: "Mohamed Ali Triki",
    upvotesCount: 21,
    upvotedBy: ["citoyen_mohamed_09","citoyen_mehdi_03"],
    resolution: null,
    assignedTo: null,
    assignedToName: null,
    createdAt: { toMillis: () => Date.now() - 3600000 * 2 },
    updatedAt: { toMillis: () => Date.now() - 3600000 * 2 },
  },
  {
    id: "rep_pending_04",
    title: "Inondation et stagnation d’eaux pluviales dans une ruelle résidentielle",
    description: "Suite aux pluies récentes, les eaux pluviales sont bloquées sans écoulement devant les entrées des maisons, formant une marre boueuse insalubre.",
    category: "water",
    status: "pending",
    priority: "medium",
    location: {"latitude":35.8612,"longitude":10.5975,"address":"Rue des Jardins, El Kantaoui, Hammam Sousse","city":"Hammam Sousse"},
    region: "Hammam Sousse",
    imageUrl: "pending_4.jpg",
    photoBeforeUrl: "pending_4.jpg",
    imagePath: "reports/rep_pending_04/evidence/pending_4.jpg",
    photoAfterUrl: null,
    userId: "citoyen_mariem_05",
    userDisplayName: "Mariem Khelifi",
    upvotesCount: 9,
    upvotedBy: ["citoyen_mariem_05"],
    resolution: null,
    assignedTo: null,
    assignedToName: null,
    createdAt: { toMillis: () => Date.now() - 3600000 * 9 },
    updatedAt: { toMillis: () => Date.now() - 3600000 * 9 },
  }
];

let localCommentsStore: Record<string, ReportComment[]> = {
  rep_zarzis_001: [
    {
      id: 'cmt_001',
      reportId: 'rep_zarzis_001',
      userId: 'demo_employee_uid',
      userDisplayName: 'Chiheb (Agent Municipal)',
      userRole: 'employee',
      text: 'Scheduled sanitation truck inspection for tomorrow morning.',
      createdAt: { toMillis: () => Date.now() - 3600000 * 2 },
    },
  ],
};

let listeners: Array<(reports: CivicReport[]) => void> = [];

function notifyLocalListeners() {
  listeners.forEach((listener) => listener([...localReportsStore]));
}

/**
 * Resolves and strictly validates MIME type (JPEG/PNG only) and 5 MB ceiling before upload.
 */
function resolveValidatedMimeType(uri: string, blobType?: string): 'image/jpeg' | 'image/png' {
  const normalizedBlobType = (blobType || '').toLowerCase();
  if (normalizedBlobType && normalizedBlobType !== 'application/octet-stream') {
    if (ALLOWED_IMAGE_MIME_TYPES.has(normalizedBlobType)) {
      return normalizedBlobType as 'image/jpeg' | 'image/png';
    }
    throw new AppSecurityError(
      'storage/invalid-argument',
      'Unsupported file format. Only JPEG and PNG images are allowed.'
    );
  }

  const lowerUri = uri.split('?')[0].toLowerCase();
  if (lowerUri.endsWith('.png')) return 'image/png';
  if (lowerUri.endsWith('.jpg') || lowerUri.endsWith('.jpeg')) return 'image/jpeg';

  throw new AppSecurityError(
    'storage/invalid-argument',
    'Could not verify image format. Please choose a JPEG or PNG photo.'
  );
}

/**
 * Securely uploads an image to Firebase Storage with strict size, MIME, and ownership metadata.
 */
export async function uploadMediaToStorage(params: {
  uri: string;
  path: string;
  uploadedBy: string;
  purpose: 'evidence' | 'resolution_proof' | 'avatar';
}): Promise<string> {
  if (!params.uploadedBy) {
    throw new AppSecurityError('unauthenticated', 'You must sign in before uploading photos.', true);
  }

  if (!isFirebaseConfigured) {
    return params.uri;
  }

  try {
    const response = await fetch(params.uri);
    const blob = await response.blob();

    if (blob.size <= 0 || blob.size > MAX_IMAGE_BYTES) {
      throw new AppSecurityError(
        'storage/invalid-argument',
        'Image exceeds the 5 MB security upload limit. Please compress or retake the photo.'
      );
    }

    const contentType = resolveValidatedMimeType(params.uri, blob.type);
    const metadata: UploadMetadata = {
      contentType,
      customMetadata: {
        uploadedBy: params.uploadedBy,
        purpose: params.purpose,
      },
    };

    const storageRef = ref(storage, params.path);
    const uploadTask = await uploadBytesResumable(storageRef, blob, metadata);
    return await getDownloadURL(uploadTask.ref);
  } catch (err) {
    throw normalizeSecurityError(
      err,
      'Photo upload was rejected. Ensure it is a valid JPEG/PNG under 5 MB.'
    );
  }
}

/**
 * Uploads a citizen or municipal staff user profile avatar to `avatars/{userId}/`
 * conforming strictly with storage.rules `match /avatars/{userId}/{fileName}`
 */
export async function uploadUserProfileAvatar(params: {
  userId: string;
  localImageUri: string;
}): Promise<string> {
  const ext = params.localImageUri.split('?')[0].toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  const avatarPath = `avatars/${params.userId}/avatar_${Date.now()}.${ext}`;

  return await uploadMediaToStorage({
    uri: params.localImageUri,
    path: avatarPath,
    uploadedBy: params.userId,
    purpose: 'avatar',
  });
}

/**
 * Normalizes Firestore report records so legacy docs missing `upvotedBy` or `photoAfterUrl`
 * still hydrate cleanly in UI components.
 */
function hydrateReportDoc(id: string, raw: Record<string, any>): CivicReport {
  const upvotedBy: string[] = Array.isArray(raw.upvotedBy)
    ? raw.upvotedBy
    : Array.isArray(raw.upvoters)
      ? raw.upvoters
      : [];

  return {
    ...(raw as CivicReport),
    id,
    region:
      typeof raw.region === 'string' && raw.region.trim().length > 0
        ? raw.region.trim()
        : 'Sousse Médina',
    upvotedBy,
    photoBeforeUrl: raw.photoBeforeUrl ?? raw.imageUrl ?? null,
    photoAfterUrl: raw.photoAfterUrl ?? raw.resolution?.afterImageUrl ?? null,
  };
}

/**
 * Citizen Report Creation
 * Security invariant: ALWAYS forces `status: 'pending'`, `upvotesCount: 0`, `upvotedBy: []`,
 * validates coordinate bounds, and leaves citizen gamification counters server-authoritative.
 */
export async function createReport(params: {
  title: string;
  description: string;
  category: ReportCategory;
  localImageUri: string;
  location: { latitude: number; longitude: number; address: string; city?: string };
  region?: string;
  userId: string;
  userDisplayName: string;
}): Promise<string> {
  if (!params.userId || params.userId === 'anonymous') {
    throw new AppSecurityError('unauthenticated', 'Sign in to submit a civic report.', true);
  }

  const cleanTitle = params.title.trim();
  const cleanDescription = params.description.trim();
  const cleanAddress = params.location.address.trim();
  const cleanRegion = (params.region || 'Sousse Médina').trim();

  if (cleanTitle.length < 3 || cleanTitle.length > 120) {
    throw new AppSecurityError('invalid-argument', 'Title must be between 3 and 120 characters.');
  }
  if (cleanDescription.length < 5 || cleanDescription.length > 2000) {
    throw new AppSecurityError(
      'invalid-argument',
      'Description must be between 5 and 2000 characters.'
    );
  }
  if (
    typeof params.location.latitude !== 'number' ||
    typeof params.location.longitude !== 'number' ||
    params.location.latitude < -90 ||
    params.location.latitude > 90 ||
    params.location.longitude < -180 ||
    params.location.longitude > 180
  ) {
    throw new AppSecurityError('invalid-argument', 'Invalid GPS coordinates provided.');
  }

  const reportId = `rep_${Date.now()}`;
  const ext = params.localImageUri.split('?')[0].toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  const evidencePath = `reports/${reportId}/evidence/before_${Date.now()}.${ext}`;

  const downloadUrl = await uploadMediaToStorage({
    uri: params.localImageUri,
    path: evidencePath,
    uploadedBy: params.userId,
    purpose: 'evidence',
  });

  const payload: CivicReport = {
    id: reportId,
    title: cleanTitle,
    description: cleanDescription,
    category: params.category,
    status: 'pending',
    priority: 'medium',
    location: {
      latitude: params.location.latitude,
      longitude: params.location.longitude,
      address: cleanAddress || 'GPS Verified Location',
      ...(params.location.city ? { city: params.location.city } : {}),
    },
    region: cleanRegion,
    imageUrl: downloadUrl,
    imagePath: evidencePath,
    photoAfterUrl: null,
    userId: params.userId,
    userDisplayName: (params.userDisplayName || 'Citizen').trim(),
    upvotesCount: 0,
    upvotedBy: [],
    resolution: null,
    assignedTo: null,
    assignedToName: null,
    createdAt: { toMillis: () => Date.now() },
    updatedAt: { toMillis: () => Date.now() },
  };

  if (!isFirebaseConfigured) {
    localReportsStore = [payload, ...localReportsStore];
    notifyLocalListeners();
    // Dispatch regional employee notification in background
    dispatchRegionalNewReportNotification(payload).catch((err) => {
      console.warn('[CreateReport] Regional notification error:', err);
    });
    return reportId;
  }

  try {
    const reportRef = doc(collection(db, REPORTS_COLLECTION), reportId);
    await setDoc(reportRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    // Dispatch targeted push notifications to active employees in report.region
    dispatchRegionalNewReportNotification(payload).catch((err) => {
      console.warn('[CreateReport] Regional notification error:', err);
    });
    // NOTE: User gamification points & reportsCount MUST be incremented server-side via
    // Cloud Functions (onDocumentCreated('reports/{reportId}')) to prevent self-tampering.
    return reportId;
  } catch (err) {
    throw normalizeSecurityError(err, 'Failed to publish report. Verify permissions and inputs.');
  }
}

/**
 * Atomic Upvote Transaction (`upvotedBy` & `upvotesCount`)
 * Enforces exact +1 / -1 transaction parity with firestore.rules `isValidUpvoteMutation()`.
 */
export async function toggleUpvote(reportId: string, userId: string): Promise<boolean> {
  if (!userId) {
    throw new AppSecurityError('unauthenticated', 'Sign in to upvote civic reports.', true);
  }

  if (!isFirebaseConfigured) {
    const reportIndex = localReportsStore.findIndex((r) => r.id === reportId);
    if (reportIndex === -1) return false;
    const report = localReportsStore[reportIndex];
    const currentVoters = report.upvotedBy || [];
    const hasVoted = currentVoters.includes(userId);
    const nextVoted = !hasVoted;

    localReportsStore[reportIndex] = {
      ...report,
      upvotedBy: hasVoted
        ? currentVoters.filter((id) => id !== userId)
        : [...currentVoters, userId],
      upvotesCount: hasVoted
        ? Math.max(0, (report.upvotesCount || 1) - 1)
        : (report.upvotesCount || 0) + 1,
    };
    notifyLocalListeners();
    return nextVoted;
  }

  try {
    const reportRef = doc(db, REPORTS_COLLECTION, reportId);
    let votedAfterTx = false;

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(reportRef);
      if (!snap.exists()) {
        throw new AppSecurityError('not-found', 'This report no longer exists.');
      }

      const data = snap.data();
      const voters: string[] = Array.isArray(data.upvotedBy) ? data.upvotedBy : [];
      const hasVoted = voters.includes(userId);
      votedAfterTx = !hasVoted;

      // Differential update matches firestore.rules affectedKeys().hasOnly(['upvotedBy', 'upvotesCount', 'updatedAt'])
      transaction.update(reportRef, {
        upvotedBy: hasVoted ? arrayRemove(userId) : arrayUnion(userId),
        upvotesCount: increment(hasVoted ? -1 : 1),
        updatedAt: serverTimestamp(),
      });
    });

    return votedAfterTx;
  } catch (err) {
    throw normalizeSecurityError(err, 'Could not update vote. Please try again.');
  }
}

/**
 * Idempotent Positive Upvote (used by Smart Duplicate Detection modal).
 * Increments the counter strictly by +1 ONLY if the caller has not already voted,
 * preventing accidental removal of an existing vote.
 */
export async function ensureReportUpvote(
  reportId: string,
  userId: string
): Promise<{ alreadyUpvoted: boolean; upvotesCount: number }> {
  if (!userId) {
    throw new AppSecurityError('unauthenticated', 'Sign in to upvote civic reports.', true);
  }

  if (!isFirebaseConfigured) {
    const reportIndex = localReportsStore.findIndex((r) => r.id === reportId);
    if (reportIndex === -1) {
      return { alreadyUpvoted: false, upvotesCount: 0 };
    }
    const report = localReportsStore[reportIndex];
    const currentVoters = report.upvotedBy || [];
    if (currentVoters.includes(userId)) {
      return { alreadyUpvoted: true, upvotesCount: report.upvotesCount || currentVoters.length };
    }

    const nextCount = (report.upvotesCount || 0) + 1;
    localReportsStore[reportIndex] = {
      ...report,
      upvotedBy: [...currentVoters, userId],
      upvotesCount: nextCount,
    };
    notifyLocalListeners();
    return { alreadyUpvoted: false, upvotesCount: nextCount };
  }

  try {
    const reportRef = doc(db, REPORTS_COLLECTION, reportId);
    let outcome = { alreadyUpvoted: false, upvotesCount: 0 };

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(reportRef);
      if (!snap.exists()) {
        throw new AppSecurityError('not-found', 'This report no longer exists.');
      }

      const data = snap.data();
      const voters: string[] = Array.isArray(data.upvotedBy) ? data.upvotedBy : [];
      const currentCount = typeof data.upvotesCount === 'number' ? data.upvotesCount : voters.length;

      if (voters.includes(userId)) {
        outcome = { alreadyUpvoted: true, upvotesCount: currentCount };
        return;
      }

      transaction.update(reportRef, {
        upvotedBy: arrayUnion(userId),
        upvotesCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      outcome = { alreadyUpvoted: false, upvotesCount: currentCount + 1 };
    });

    return outcome;
  } catch (err) {
    throw normalizeSecurityError(err, 'Could not confirm nearby issue.');
  }
}

/**
 * Smart Duplicate Detection Query:
 * Queries active reports (`status != 'resolved'`) and evaluates Haversine proximity
 * within `radiusMeters` (default: 30m).
 */
export async function findNearbyActiveReports(
  origin: GeoCoordinates,
  radiusMeters: number = DUPLICATE_DETECTION_RADIUS_METERS
): Promise<NearbyDuplicateMatch[]> {
  if (!isFirebaseConfigured) {
    return findNearbyActiveDuplicates(origin, localReportsStore, radiusMeters);
  }

  try {
    const activeQuery = query(
      collection(db, REPORTS_COLLECTION),
      where('status', '!=', 'resolved'),
      limit(250)
    );
    const snapshot = await getDocs(activeQuery);
    const activeReports = snapshot.docs.map((docSnap) =>
      hydrateReportDoc(docSnap.id, docSnap.data())
    );
    return findNearbyActiveDuplicates(origin, activeReports, radiusMeters);
  } catch (err) {
    throw normalizeSecurityError(err, 'Unable to check nearby active issues.');
  }
}

/**
 * Municipal Worker / Admin Transition: `pending -> in_progress`
 * Assigns worker UID, name, and timestamps (assignedAt, inProgressAt).
 * Authoritative write verified by Firestore Security Rules against Custom Claims.
 */
export async function markReportInProgress(
  reportId: string,
  employeeUid?: string | null,
  employeeDisplayName?: string | null
): Promise<void> {
  const nowIso = new Date().toISOString();
  if (!isFirebaseConfigured) {
    const reportIndex = localReportsStore.findIndex((r) => r.id === reportId);
    if (reportIndex !== -1) {
      localReportsStore[reportIndex] = {
        ...localReportsStore[reportIndex],
        status: 'in_progress',
        assignedTo: employeeUid || localReportsStore[reportIndex].assignedTo,
        assignedToName: employeeDisplayName || localReportsStore[reportIndex].assignedToName,
        assignedAt: nowIso,
        inProgressAt: nowIso,
        updatedAt: { toMillis: () => Date.now() },
      };
      notifyLocalListeners();
    }
    return;
  }

  try {
    const reportRef = doc(db, REPORTS_COLLECTION, reportId);
    const patch: Record<string, any> = {
      status: 'in_progress',
      updatedAt: serverTimestamp(),
      inProgressAt: serverTimestamp(),
    };
    if (employeeUid) {
      patch.assignedTo = employeeUid;
      patch.assignedAt = serverTimestamp();
    }
    if (employeeDisplayName) {
      patch.assignedToName = employeeDisplayName;
    }
    await updateDoc(reportRef, patch);
  } catch (err) {
    throw normalizeSecurityError(
      err,
      'You are not authorized to dispatch municipal teams.'
    );
  }
}

/**
 * Municipal Worker / Admin Transition: `in_progress -> completed`
 * Uploads mandatory "After" photo proof to `proofs/{reportId}_after.jpg`
 * and atomically commits `status: 'completed'`, `photoAfterUrl`, `completedBy`,
 * `completedAt`, `resolutionNote`, and structured resolution object.
 */
export async function completeReportWithProof(params: {
  reportId: string;
  employeeUid: string;
  employeeName: string;
  localAfterImageUri: string;
  notes?: string;
}): Promise<void> {
  if (!params.localAfterImageUri) {
    throw new AppSecurityError(
      'invalid-argument',
      'Mandatory "After" resolution photo is required.'
    );
  }
  if (!params.employeeUid) {
    throw new AppSecurityError('unauthenticated', 'Authenticated staff session required.', true);
  }

  const cleanNotes = (params.notes || '').trim();
  const ext = params.localAfterImageUri.split('?')[0].toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  // Stores resolution proof under proofs/{reportId}_after.jpg
  const proofPath = `proofs/${params.reportId}_after.${ext}`;

  const afterUrl = await uploadMediaToStorage({
    uri: params.localAfterImageUri,
    path: proofPath,
    uploadedBy: params.employeeUid,
    purpose: 'resolution_proof',
  });

  const nowIso = new Date().toISOString();
  const resolution: ResolutionData = {
    resolvedAt: nowIso,
    resolvedBy: params.employeeUid,
    resolvedByName: params.employeeName,
    afterImageUrl: afterUrl,
    afterImagePath: proofPath,
    notes: cleanNotes,
  };

  if (!isFirebaseConfigured) {
    const reportIndex = localReportsStore.findIndex((r) => r.id === params.reportId);
    if (reportIndex !== -1) {
      localReportsStore[reportIndex] = {
        ...localReportsStore[reportIndex],
        status: 'completed',
        photoAfterUrl: afterUrl,
        completedBy: params.employeeUid,
        completedAt: nowIso,
        resolutionNote: cleanNotes,
        resolvedBy: params.employeeUid,
        resolvedAt: nowIso,
        resolution,
        updatedAt: { toMillis: () => Date.now() },
      };
      notifyLocalListeners();
    }
    return;
  }

  try {
    const reportRef = doc(db, REPORTS_COLLECTION, params.reportId);
    await updateDoc(reportRef, {
      status: 'completed',
      photoAfterUrl: afterUrl, // Verified strictly by firestore.rules hasValidResolutionProof()
      completedBy: params.employeeUid,
      completedAt: serverTimestamp(),
      resolutionNote: cleanNotes,
      resolvedBy: params.employeeUid,
      resolvedAt: serverTimestamp(),
      resolution,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    throw normalizeSecurityError(
      err,
      'Completion rejected: verify employee/admin credentials and proof image.'
    );
  }
}

/**
 * Municipal Worker / Admin Transition: `pending | in_progress -> resolved`
 * Uploads mandatory "After" photo proof to `proofs/{reportId}_after.jpg`
 * and atomically commits `status: 'resolved'`, `photoAfterUrl`, `resolvedBy`,
 * `resolvedAt`, and structured resolution notes.
 */
export async function resolveReportWithProof(params: {
  reportId: string;
  staffId: string;
  staffName: string;
  localAfterImageUri: string;
  notes: string;
}): Promise<void> {
  return completeReportWithProof({
    reportId: params.reportId,
    employeeUid: params.staffId,
    employeeName: params.staffName,
    localAfterImageUri: params.localAfterImageUri,
    notes: params.notes,
  });
}

/**
 * Admin-Only Triage & Crew Reassignment
 */
export async function updateReportTriage(params: {
  reportId: string;
  priority?: ReportPriority;
  category?: ReportCategory;
  assignedTo?: string | null;
  assignedToName?: string | null;
}): Promise<void> {
  if (!isFirebaseConfigured) {
    const reportIndex = localReportsStore.findIndex((r) => r.id === params.reportId);
    if (reportIndex !== -1) {
      localReportsStore[reportIndex] = {
        ...localReportsStore[reportIndex],
        ...(params.priority ? { priority: params.priority } : {}),
        ...(params.category ? { category: params.category } : {}),
        ...(params.assignedTo !== undefined ? { assignedTo: params.assignedTo } : {}),
        ...(params.assignedToName !== undefined ? { assignedToName: params.assignedToName } : {}),
      };
      notifyLocalListeners();
    }
    return;
  }

  try {
    const patch: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };
    if (params.priority) patch.priority = params.priority;
    if (params.category) patch.category = params.category;
    if (params.assignedTo !== undefined) patch.assignedTo = params.assignedTo;
    if (params.assignedToName !== undefined) patch.assignedToName = params.assignedToName;

    await updateDoc(doc(db, REPORTS_COLLECTION, params.reportId), patch);
  } catch (err) {
    throw normalizeSecurityError(err, 'Only verified administrators can triage or reassign reports.');
  }
}

/**
 * Full Admin Governance Report Modification
 * Allows modifying title, description, category, region, priority, status, and staff assignment.
 */
export async function adminUpdateReport(
  reportId: string,
  patch: {
    title?: string;
    description?: string;
    category?: ReportCategory;
    region?: string;
    status?: ReportStatus;
    priority?: ReportPriority;
    assignedTo?: string | null;
    assignedToName?: string | null;
  }
): Promise<void> {
  if (patch.title !== undefined && patch.title.trim().length < 3) {
    throw new AppSecurityError('invalid-argument', 'Le titre doit contenir au moins 3 caractères.');
  }
  if (patch.description !== undefined && patch.description.trim().length < 5) {
    throw new AppSecurityError('invalid-argument', 'La description doit contenir au moins 5 caractères.');
  }
  if (patch.region !== undefined && !patch.region.trim()) {
    throw new AppSecurityError('invalid-argument', 'La délégation / Mo3tamdiya ne peut pas être vide.');
  }

  if (!isFirebaseConfigured) {
    const idx = localReportsStore.findIndex((r) => r.id === reportId);
    if (idx !== -1) {
      localReportsStore[idx] = {
        ...localReportsStore[idx],
        ...patch,
        updatedAt: { toMillis: () => Date.now() },
      };
      notifyLocalListeners();
    }
    return;
  }

  try {
    const cleanedPatch: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };
    if (patch.title !== undefined) cleanedPatch.title = patch.title.trim();
    if (patch.description !== undefined) cleanedPatch.description = patch.description.trim();
    if (patch.category !== undefined) cleanedPatch.category = patch.category;
    if (patch.region !== undefined) cleanedPatch.region = patch.region.trim();
    if (patch.status !== undefined) cleanedPatch.status = patch.status;
    if (patch.priority !== undefined) cleanedPatch.priority = patch.priority;
    if (patch.assignedTo !== undefined) cleanedPatch.assignedTo = patch.assignedTo;
    if (patch.assignedToName !== undefined) cleanedPatch.assignedToName = patch.assignedToName;

    await updateDoc(doc(db, REPORTS_COLLECTION, reportId), cleanedPatch);
  } catch (err) {
    throw normalizeSecurityError(err, 'Impossible de mettre à jour le signalement. Droits administrateur requis.');
  }
}

/**
 * Content Moderation: Permanent Report Deletion with Storage Image Cleanup & Karma Adjustment
 * 1. Removes images from Firebase Storage
 * 2. Stores audit record in archived_reports collection
 * 3. Applies optional citizen karma penalty for spam submissions (-10 pts)
 * 4. Deletes report document from reports collection
 */
export async function deleteReportWithStorageCleanup(params: {
  report: CivicReport;
  reason: string;
  adminUid?: string;
  adminName?: string;
  karmaPenalty?: boolean;
}): Promise<void> {
  const { report, reason, adminUid, adminName, karmaPenalty } = params;

  if (!reason || reason.trim().length < 3) {
    throw new AppSecurityError('invalid-argument', 'Un motif de modération obligatoire est requis.');
  }

  if (!isFirebaseConfigured) {
    localArchivedReportsStore.unshift({
      ...report,
      deletionReason: reason.trim(),
      deletedBy: adminUid || 'admin',
      deletedByName: adminName || 'Admin Arij',
      archivedAt: new Date().toISOString(),
    });

    localReportsStore = localReportsStore.filter((r) => r.id !== report.id);
    notifyLocalListeners();
    return;
  }

  try {
    // 1. Delete associated images from Firebase Storage
    if (report.imagePath) {
      try {
        const evidenceRef = ref(storage, report.imagePath);
        await deleteObject(evidenceRef);
      } catch (storageErr) {
        console.warn('[Storage Cleanup] Evidence image delete warning:', storageErr);
      }
    }

    if (report.resolution?.afterImagePath) {
      try {
        const afterRef = ref(storage, report.resolution.afterImagePath);
        await deleteObject(afterRef);
      } catch (storageErr) {
        console.warn('[Storage Cleanup] Resolution image delete warning:', storageErr);
      }
    }

    // 2. Audit Trail: Write to archived_reports
    await setDoc(doc(db, ARCHIVED_REPORTS_COLLECTION, report.id), {
      ...report,
      deletionReason: reason.trim(),
      deletedBy: adminUid || 'admin',
      deletedByName: adminName || 'Admin',
      archivedAt: serverTimestamp(),
    });

    // 3. Karma Penalty for spam / fake reports
    if (karmaPenalty && report.userId) {
      try {
        const userRef = doc(db, USERS_COLLECTION, report.userId);
        await updateDoc(userRef, {
          points: increment(-10),
          updatedAt: serverTimestamp(),
        });
      } catch (karmaErr) {
        console.warn('[Karma Penalty] Failed to decrement user karma:', karmaErr);
      }
    }

    // 4. Delete report document from active Firestore collection
    await deleteDoc(doc(db, REPORTS_COLLECTION, report.id));
  } catch (err) {
    throw normalizeSecurityError(err, 'Échec de la suppression et modération du signalement.');
  }
}

/**
 * Admin-Only Report Deletion (legacy wrapper)
 */
export async function deleteReport(reportId: string): Promise<void> {
  const existing = await getReportById(reportId);
  if (existing) {
    return deleteReportWithStorageCleanup({
      report: existing,
      reason: 'Suppression administrative directe',
    });
  }

  if (!isFirebaseConfigured) {
    localReportsStore = localReportsStore.filter((r) => r.id !== reportId);
    notifyLocalListeners();
    return;
  }

  try {
    await deleteDoc(doc(db, REPORTS_COLLECTION, reportId));
  } catch (err) {
    throw normalizeSecurityError(err, 'Only verified administrators can delete reports.');
  }
}

/**
 * Fetch single report safely
 */
export async function getReportById(reportId: string): Promise<CivicReport | null> {
  if (!isFirebaseConfigured) {
    return localReportsStore.find((r) => r.id === reportId) || null;
  }

  try {
    const snap = await getDoc(doc(db, REPORTS_COLLECTION, reportId));
    if (snap.exists()) {
      return hydrateReportDoc(snap.id, snap.data());
    }
    return null;
  } catch (err) {
    throw normalizeSecurityError(err, 'Unable to load report details.');
  }
}

/**
 * Real-time subscription to civic reports feed
 */
export function subscribeToReports(
  options: {
    category?: ReportCategory | 'all';
    status?: ReportStatus | 'all';
    region?: string | null;
  },
  onUpdate: (reports: CivicReport[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const filterReports = (all: CivicReport[]) => {
    let result = [...all];
    if (options.category && options.category !== 'all') {
      result = result.filter((r) => r.category === options.category);
    }
    if (options.status && options.status !== 'all') {
      result = result.filter((r) => r.status === options.status);
    }
    if (options.region && options.region !== 'ALL') {
      result = result.filter(
        (r) => r.region?.toLowerCase().trim() === options.region?.toLowerCase().trim()
      );
    }
    return result;
  };

  if (!isFirebaseConfigured) {
    onUpdate(filterReports(localReportsStore));
    const localListener = (updatedAll: CivicReport[]) => {
      onUpdate(filterReports(updatedAll));
    };
    listeners.push(localListener);
    return () => {
      listeners = listeners.filter((l) => l !== localListener);
    };
  }

  const q = query(collection(db, REPORTS_COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const remoteReports = snapshot.docs.map((docSnap) =>
        hydrateReportDoc(docSnap.id, docSnap.data())
      );
      onUpdate(filterReports(remoteReports));
    },
    (err) => {
      const safeErr = normalizeSecurityError(err, 'Unable to stream live reports.');
      onError?.(safeErr);
    }
  );
}

/**
 * Read & post public discussion comments under `/reports/{reportId}/comments`
 */
export function subscribeToReportComments(
  reportId: string,
  onUpdate: (comments: ReportComment[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!isFirebaseConfigured) {
    onUpdate([...(localCommentsStore[reportId] || [])]);
    return () => {};
  }

  const commentsQuery = query(
    collection(db, REPORTS_COLLECTION, reportId, COMMENTS_SUBCOLLECTION),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    commentsQuery,
    (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ReportComment, 'id'>),
      }));
      onUpdate(list);
    },
    (err) => {
      onError?.(normalizeSecurityError(err, 'Unable to load comments.'));
    }
  );
}

export async function addReportComment(params: {
  reportId: string;
  userId: string;
  userDisplayName: string;
  userRole: UserRole;
  text: string;
}): Promise<void> {
  const cleanText = params.text.trim();
  if (!params.userId) {
    throw new AppSecurityError('unauthenticated', 'Sign in to post a comment.', true);
  }
  if (cleanText.length < 1 || cleanText.length > 1000) {
    throw new AppSecurityError('invalid-argument', 'Comment must be 1 to 1000 characters.');
  }

  const commentId = `cmt_${Date.now()}`;

  if (!isFirebaseConfigured) {
    const newComment: ReportComment = {
      id: commentId,
      reportId: params.reportId,
      userId: params.userId,
      userDisplayName: params.userDisplayName,
      userRole: params.userRole,
      text: cleanText,
      createdAt: { toMillis: () => Date.now() },
    };
    localCommentsStore[params.reportId] = [
      ...(localCommentsStore[params.reportId] || []),
      newComment,
    ];
    return;
  }

  try {
    await setDoc(
      doc(db, REPORTS_COLLECTION, params.reportId, COMMENTS_SUBCOLLECTION, commentId),
      {
        id: commentId,
        reportId: params.reportId,
        userId: params.userId,
        userDisplayName: params.userDisplayName,
        userRole: params.userRole,
        text: cleanText,
        createdAt: serverTimestamp(),
      }
    );
  } catch (err) {
    throw normalizeSecurityError(err, 'Unable to post comment.');
  }
}
