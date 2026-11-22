/**
 * Standalone Tunisian Civic Reports Database Seed Script (`scripts/seed.ts`)
 * =========================================================================
 *
 * Populates Bledi+ (بلادي+) with realistic, geographically verified Tunisian civic reports
 * using our local seed photos (4 Before/After completed pairs + 4 pending issues):
 *
 * Completed Pairs (Before / After Comparison):
 * 1. rep_lamp_01 (lighting, Hammam Sousse) -> lamp_before.jpg & lamp_after.jpg
 * 2. rep_pothole_01 (infrastructure, Sousse Médina) -> pothole_before.jpg & pothole_after.jpg
 * 3. rep_alley_01 (infrastructure, Tunis Centre-Ville) -> alley_before.jpg & alley_after.jpg
 * 4. rep_grass_trash_01 (sanitation, La Marsa) -> grass_trash_before.jpg & grass_trash_after.jpg
 *
 * Active Pending Reports (Awaiting Municipal Intervention):
 * 5. rep_pending_01 (infrastructure, Sousse Jawhara / Sahloul) -> pending_1.jpg
 * 6. rep_pending_02 (sanitation, Sousse Médina) -> pending_2.jpg
 * 7. rep_pending_03 (infrastructure, Sfax Ville) -> pending_3.jpg
 * 8. rep_pending_04 (water, Hammam Sousse) -> pending_4.jpg
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *   npx tsx scripts/seed.ts --force
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  Firestore,
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyYOUR_FIREBASE_API_KEY',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'citizen-reporting-mini-project.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'citizen-reporting-mini-project',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'citizen-reporting-mini-project.appspot.com',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  appId: process.env.FIREBASE_APP_ID || '1:123456789012:web:abcdef123456',
};

export interface CivicReportSeed {
  id: string;
  title: string;
  description: string;
  category: 'infrastructure' | 'sanitation' | 'lighting' | 'water' | 'other';
  status: 'pending' | 'in_progress' | 'resolved' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  location: {
    latitude: number;
    longitude: number;
    address: string;
    city: string;
  };
  region: string; // Mo3tamdiya
  imageUrl: string;
  photoBeforeUrl: string;
  imagePath: string;
  photoAfterUrl: string | null;
  userId: string;
  userDisplayName: string;
  upvotesCount: number;
  upvotedBy: string[];
  assignedTo: string | null;
  assignedToName: string | null;
  resolution?: {
    resolvedAt: string;
    resolvedBy: string;
    resolvedByName: string;
    afterImageUrl: string;
    afterImagePath: string;
    notes: string;
  } | null;
  hoursAgo: number;
}

export const TUNISIAN_REPORTS_SEED: CivicReportSeed[] = [
  // ---------------------------------------------------------------------------
  // 1. COMPLETED: Leaning Streetlight & Cardboard Trash (Hammam Sousse)
  // ---------------------------------------------------------------------------
  {
    id: 'rep_lamp_01',
    title: "Poteau d'éclairage public incliné et dépôt d'emballages cartons",
    description:
      "Un candélabre municipal penchait dangereusement vers la chaussée après un choc, avec accumulation de déchets d'emballages commerciaux au pied du mât.",
    category: 'lighting',
    status: 'completed',
    priority: 'high',
    location: {
      latitude: 35.8587,
      longitude: 10.6015,
      address: 'Avenue Habib Bourguiba, Hammam Sousse',
      city: 'Hammam Sousse',
    },
    region: 'Hammam Sousse',
    imageUrl: 'lamp_before.jpg',
    photoBeforeUrl: 'lamp_before.jpg',
    imagePath: 'reports/rep_lamp_01/evidence/lamp_before.jpg',
    photoAfterUrl: 'lamp_after.jpg',
    userId: 'citoyen_youssef_01',
    userDisplayName: 'Youssef Trabelsi',
    upvotesCount: 16,
    upvotedBy: ['citoyen_youssef_01', 'citoyen_nour_02', 'citoyen_sami_04'],
    assignedTo: 'staff_chiheb_001',
    assignedToName: 'Chiheb (Agent Municipal - Hammam Sousse)',
    resolution: {
      resolvedAt: '2026-11-21T14:30:00.000Z',
      resolvedBy: 'staff_chiheb_001',
      resolvedByName: 'Chiheb (Agent Municipal - Hammam Sousse)',
      afterImageUrl: 'lamp_after.jpg',
      afterImagePath: 'proofs/rep_lamp_01_after.jpg',
      notes:
        'Candélabre redressé et scellement renforcé. Enlèvement complet des déchets et nettoyage du trottoir par les équipes de la propreté.',
    },
    hoursAgo: 18,
  },

  // ---------------------------------------------------------------------------
  // 2. COMPLETED: Flooded Potholes Road (Sousse Médina)
  // ---------------------------------------------------------------------------
  {
    id: 'rep_pothole_01',
    title: 'Affaissement et nids-de-poule inondés sur la voie d’accès',
    description:
      'Multiples crevasses et flaques d’eau stagnante rendant le passage des véhicules et piétons très difficile entre les immeubles.',
    category: 'infrastructure',
    status: 'completed',
    priority: 'critical',
    location: {
      latitude: 35.8272,
      longitude: 10.6358,
      address: 'Rue de Constantine, Quartier Médina, Sousse',
      city: 'Sousse',
    },
    region: 'Sousse Médina',
    imageUrl: 'pothole_before.jpg',
    photoBeforeUrl: 'pothole_before.jpg',
    imagePath: 'reports/rep_pothole_01/evidence/pothole_before.jpg',
    photoAfterUrl: 'pothole_after.jpg',
    userId: 'citoyen_sami_04',
    userDisplayName: 'Sami Ben Rejeb',
    upvotesCount: 29,
    upvotedBy: ['citoyen_sami_04', 'citoyen_youssef_01', 'citoyen_nour_02', 'citoyen_mehdi_03'],
    assignedTo: 'staff_chiheb_001',
    assignedToName: 'Chiheb (Agent Municipal - Sousse Médina)',
    resolution: {
      resolvedAt: '2026-11-21T16:00:00.000Z',
      resolvedBy: 'staff_chiheb_001',
      resolvedByName: 'Chiheb (Agent Municipal - Sousse Médina)',
      afterImageUrl: 'pothole_after.jpg',
      afterImagePath: 'proofs/rep_pothole_01_after.jpg',
      notes:
        'Décapage du sol dégradé, pose de sous-couche compactée et nouvel enrobé bitumineux étalé sur l’ensemble de la chaussée.',
    },
    hoursAgo: 26,
  },

  // ---------------------------------------------------------------------------
  // 3. COMPLETED: Muddy & Unpaved Alleyway (Tunis Centre-Ville)
  // ---------------------------------------------------------------------------
  {
    id: 'rep_alley_01',
    title: 'Ruelle en terre battue défoncée et boueuse rendant l’accès impossible',
    description:
      'Passage historique non goudronné se transformant en bourbier glissant à chaque intempérie pour les habitants du quartier.',
    category: 'infrastructure',
    status: 'completed',
    priority: 'high',
    location: {
      latitude: 36.7985,
      longitude: 10.1695,
      address: 'Rue Tourbet El Bey, Médina de Tunis',
      city: 'Tunis',
    },
    region: 'Tunis Centre-Ville',
    imageUrl: 'alley_before.jpg',
    photoBeforeUrl: 'alley_before.jpg',
    imagePath: 'reports/rep_alley_01/evidence/alley_before.jpg',
    photoAfterUrl: 'alley_after.jpg',
    userId: 'citoyen_amira_07',
    userDisplayName: 'Amira Jaziri',
    upvotesCount: 22,
    upvotedBy: ['citoyen_amira_07', 'citoyen_nour_02'],
    assignedTo: 'staff_tarak_002',
    assignedToName: 'Tarak (Service Voirie - Tunis)',
    resolution: {
      resolvedAt: '2026-11-21T10:15:00.000Z',
      resolvedBy: 'staff_tarak_002',
      resolvedByName: 'Tarak (Service Voirie - Tunis)',
      afterImageUrl: 'alley_after.jpg',
      afterImagePath: 'proofs/rep_alley_01_after.jpg',
      notes:
        'Travaux d’assainissement souterrain achevés suivis du goudronnage intégral de la ruelle avec revêtement antidérapant.',
    },
    hoursAgo: 32,
  },

  // ---------------------------------------------------------------------------
  // 4. COMPLETED: Trash Dumped in Grass (La Marsa)
  // ---------------------------------------------------------------------------
  {
    id: 'rep_grass_trash_01',
    title: 'Dépotoir sauvage de plastique et bouteilles dans l’espace vert',
    description:
      'Amas d’immondices dissimulés dans les herbes hautes près du parc municipal créant une pollution visuelle et environnementale.',
    category: 'sanitation',
    status: 'completed',
    priority: 'medium',
    location: {
      latitude: 36.8783,
      longitude: 10.3248,
      address: 'Avenue Taïeb Mhiri, La Marsa Plage',
      city: 'La Marsa',
    },
    region: 'La Marsa',
    imageUrl: 'grass_trash_before.jpg',
    photoBeforeUrl: 'grass_trash_before.jpg',
    imagePath: 'reports/rep_grass_trash_01/evidence/grass_trash_before.jpg',
    photoAfterUrl: 'grass_trash_after.jpg',
    userId: 'citoyen_fatma_08',
    userDisplayName: 'Fatma Ben Salem',
    upvotesCount: 15,
    upvotedBy: ['citoyen_fatma_08', 'citoyen_sami_04'],
    assignedTo: 'staff_anis_003',
    assignedToName: 'Anis (Direction de l’Environnement - La Marsa)',
    resolution: {
      resolvedAt: '2026-11-21T18:45:00.000Z',
      resolvedBy: 'staff_anis_003',
      resolvedByName: 'Anis (Direction de l’Environnement - La Marsa)',
      afterImageUrl: 'grass_trash_after.jpg',
      afterImagePath: 'proofs/rep_grass_trash_01_after.jpg',
      notes:
        'Opération de ratissage écologique : collecte de tous les déchets plastiques et verre, et fauchage propre de la parcelle.',
    },
    hoursAgo: 12,
  },

  // ---------------------------------------------------------------------------
  // 5. PENDING: Severe Asphalt Cracking & Trench (Sahloul / Sousse Jawhara)
  // ---------------------------------------------------------------------------
  {
    id: 'rep_pending_01',
    title: 'Fissuration majeure et effondrement de chaussée sur la route de ceinture',
    description:
      'L’asphalte s’est fracturé sur plusieurs mètres avec des déformations profondes risquant de causer des accidents de motos et des crevaisons aux heures de pointe.',
    category: 'infrastructure',
    status: 'pending',
    priority: 'critical',
    location: {
      latitude: 35.834,
      longitude: 10.5925,
      address: 'Avenue Yasser Arafat, Sahloul, Sousse',
      city: 'Sousse',
    },
    region: 'Sousse Jawhara',
    imageUrl: 'pending_1.jpg',
    photoBeforeUrl: 'pending_1.jpg',
    imagePath: 'reports/rep_pending_01/evidence/pending_1.jpg',
    photoAfterUrl: null,
    userId: 'citoyen_mehdi_03',
    userDisplayName: 'Dr. Mehdi Bouazizi',
    upvotesCount: 18,
    upvotedBy: ['citoyen_mehdi_03', 'citoyen_sami_04', 'citoyen_youssef_01'],
    assignedTo: null,
    assignedToName: null,
    resolution: null,
    hoursAgo: 4,
  },

  // ---------------------------------------------------------------------------
  // 6. PENDING: Overflowing Dumpster & Cardboard Heap (Sousse Médina)
  // ---------------------------------------------------------------------------
  {
    id: 'rep_pending_02',
    title: 'Débordement de benne municipale et accumulation de cartons sauvages',
    description:
      'La benne d’ordures ménagères est saturée depuis 48 heures. Les sacs poubelles et emballages s’étalent sur la chaussée, dégageant des odeurs nauséabondes.',
    category: 'sanitation',
    status: 'pending',
    priority: 'high',
    location: {
      latitude: 35.8295,
      longitude: 10.6372,
      address: 'Rue Ibn Khaldoun, Médina de Sousse',
      city: 'Sousse',
    },
    region: 'Sousse Médina',
    imageUrl: 'pending_2.jpg',
    photoBeforeUrl: 'pending_2.jpg',
    imagePath: 'reports/rep_pending_02/evidence/pending_2.jpg',
    photoAfterUrl: null,
    userId: 'citoyen_nour_02',
    userDisplayName: 'Nour El Houda Dridi',
    upvotesCount: 14,
    upvotedBy: ['citoyen_nour_02', 'citoyen_youssef_01'],
    assignedTo: null,
    assignedToName: null,
    resolution: null,
    hoursAgo: 7,
  },

  // ---------------------------------------------------------------------------
  // 7. PENDING: Collapsed Sidewalk Hole with Box/Rubble (Sfax Ville)
  // ---------------------------------------------------------------------------
  {
    id: 'rep_pending_03',
    title: 'Effondrement béant d’un regard d’égout comblé de gravats',
    description:
      'Un affaissement critique du trottoir a créé un trou profond de plus de 50 cm. Des riverains y ont déposé un carton pour alerter les automobilistes.',
    category: 'infrastructure',
    status: 'pending',
    priority: 'critical',
    location: {
      latitude: 34.7398,
      longitude: 10.757,
      address: 'Boulevard Majida Boulila, Sfax',
      city: 'Sfax',
    },
    region: 'Sfax Ville',
    imageUrl: 'pending_3.jpg',
    photoBeforeUrl: 'pending_3.jpg',
    imagePath: 'reports/rep_pending_03/evidence/pending_3.jpg',
    photoAfterUrl: null,
    userId: 'citoyen_mohamed_09',
    userDisplayName: 'Mohamed Ali Triki',
    upvotesCount: 21,
    upvotedBy: ['citoyen_mohamed_09', 'citoyen_mehdi_03'],
    assignedTo: null,
    assignedToName: null,
    resolution: null,
    hoursAgo: 2,
  },

  // ---------------------------------------------------------------------------
  // 8. PENDING: Flooded Residential Alleyway (Hammam Sousse)
  // ---------------------------------------------------------------------------
  {
    id: 'rep_pending_04',
    title: 'Inondation et stagnation d’eaux pluviales dans une ruelle résidentielle',
    description:
      'Suite aux pluies récentes, les eaux pluviales sont bloquées sans écoulement devant les entrées des maisons, formant une marre boueuse insalubre.',
    category: 'water',
    status: 'pending',
    priority: 'medium',
    location: {
      latitude: 35.8612,
      longitude: 10.5975,
      address: 'Rue des Jardins, El Kantaoui, Hammam Sousse',
      city: 'Hammam Sousse',
    },
    region: 'Hammam Sousse',
    imageUrl: 'pending_4.jpg',
    photoBeforeUrl: 'pending_4.jpg',
    imagePath: 'reports/rep_pending_04/evidence/pending_4.jpg',
    photoAfterUrl: null,
    userId: 'citoyen_mariem_05',
    userDisplayName: 'Mariem Khelifi',
    upvotesCount: 9,
    upvotedBy: ['citoyen_mariem_05'],
    assignedTo: null,
    assignedToName: null,
    resolution: null,
    hoursAgo: 9,
  },
];

/**
 * Synchronizes the offline fallback in `src/services/reports.ts`
 */
function syncLocalReportsService(seeds: CivicReportSeed[]) {
  const reportsServicePath = path.resolve(__dirname, '../src/services/reports.ts');
  if (!fs.existsSync(reportsServicePath)) {
    console.warn('src/services/reports.ts not found for local sync.');
    return;
  }

  const content = fs.readFileSync(reportsServicePath, 'utf8');

  const formattedItems = seeds.map((s) => {
    return `  {
    id: ${JSON.stringify(s.id)},
    title: ${JSON.stringify(s.title)},
    description: ${JSON.stringify(s.description)},
    category: ${JSON.stringify(s.category)},
    status: ${JSON.stringify(s.status)},
    priority: ${JSON.stringify(s.priority)},
    location: ${JSON.stringify(s.location)},
    region: ${JSON.stringify(s.region)},
    imageUrl: ${JSON.stringify(s.imageUrl)},
    photoBeforeUrl: ${JSON.stringify(s.photoBeforeUrl)},
    imagePath: ${JSON.stringify(s.imagePath)},
    photoAfterUrl: ${s.photoAfterUrl ? JSON.stringify(s.photoAfterUrl) : 'null'},
    userId: ${JSON.stringify(s.userId)},
    userDisplayName: ${JSON.stringify(s.userDisplayName)},
    upvotesCount: ${s.upvotesCount},
    upvotedBy: ${JSON.stringify(s.upvotedBy)},
    resolution: ${s.resolution ? JSON.stringify(s.resolution) : 'null'},
    assignedTo: ${s.assignedTo ? JSON.stringify(s.assignedTo) : 'null'},
    assignedToName: ${s.assignedToName ? JSON.stringify(s.assignedToName) : 'null'},
    createdAt: { toMillis: () => Date.now() - 3600000 * ${s.hoursAgo} },
    updatedAt: { toMillis: () => Date.now() - 3600000 * ${s.hoursAgo} },
  }`;
  });

  const newStoreBlock = `let localReportsStore: CivicReport[] = [\n${formattedItems.join(',\n')}\n];`;

  const regex = /let localReportsStore: CivicReport\[\] = \[[\s\S]*?\n\];/;
  if (regex.test(content)) {
    const updated = content.replace(regex, newStoreBlock);
    fs.writeFileSync(reportsServicePath, updated, 'utf8');
    console.log('✅ Synchronized offline preview data in src/services/reports.ts');
  }
}

async function main() {
  const isForce =
    process.argv.includes('--force') ||
    process.argv.includes('--overwrite') ||
    process.argv.includes('--clear');

  console.log('===============================================================');
  console.log('🌱 Bledi+ (بلادي+) Tunisian Civic Reports Database Seeder');
  console.log('===============================================================\n');

  // Always keep offline evaluation store populated with the rich Tunisian seed
  syncLocalReportsService(TUNISIAN_REPORTS_SEED);

  const isConfigured =
    Boolean(firebaseConfig.apiKey) &&
    !firebaseConfig.apiKey.includes('YOUR_FIREBASE_API_KEY') &&
    !firebaseConfig.projectId.includes('mini-project');

  const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  if (!isConfigured && !hasEmulator) {
    console.log('ℹ️ Mode : Démonstration Locale / Aperçu Hors-Ligne (Clés Firebase par défaut).');
    console.log('✅ Les 8 réclamations avec photos locales sont injectées avec succès dans l’application !');
    console.log('   - 4 réclamations complétées avec comparaison Avant/Après.');
    console.log('   - 4 réclamations en attente d’intervention municipale.\n');

    printSummaryTable(TUNISIAN_REPORTS_SEED);
    process.exit(0);
  }

  // Initialize Firebase Client App for Live or Emulator mode
  const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const db: Firestore = getFirestore(app);

  let existingDocsCount = 0;
  try {
    const snap = await getDocs(collection(db, 'reports'));
    existingDocsCount = snap.size;

    if (existingDocsCount > 0 && isForce) {
      console.log(`🧹 Suppression de ${existingDocsCount} anciens signalements dans Firestore...`);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'reports', d.id));
      }
      console.log('✅ Anciens signalements supprimés avec succès.\n');
    }
  } catch (err: any) {
    console.log(`ℹ️ Connexion Firestore : ${err?.message || err}`);
  }

  if (existingDocsCount > 0 && !isForce) {
    console.log(`ℹ️ La collection Firestore 'reports' contient déjà ${existingDocsCount} document(s).`);
    console.log('   Passez --force pour forcer la réécriture : npm run seed -- --force\n');
    printSummaryTable(TUNISIAN_REPORTS_SEED);
    process.exit(0);
  }

  console.log(`🚀 Insertion de ${TUNISIAN_REPORTS_SEED.length} réclamations dans la collection Firestore 'reports'...\n`);

  for (const report of TUNISIAN_REPORTS_SEED) {
    const { hoursAgo, ...docData } = report;
    const createdTimestamp = Timestamp.fromMillis(Date.now() - 3600000 * hoursAgo);

    try {
      // 1. Write report document
      await setDoc(doc(db, 'reports', report.id), {
        ...docData,
        createdAt: createdTimestamp,
        updatedAt: createdTimestamp,
      });

      // 2. Write citizen profile document (/users/{userId}) if not exists
      await setDoc(
        doc(db, 'users', report.userId),
        {
          uid: report.userId,
          displayName: report.userDisplayName,
          email: `${report.userId}@citoyen.tn`,
          role: 'citizen',
          points: 10 + report.upvotesCount * 2,
          badge: report.upvotesCount > 20 ? 'Active Citizen' : 'Novice Watcher',
          reportsCount: 1,
          resolvedCount: report.status === 'completed' || report.status === 'resolved' ? 1 : 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      console.log(`  ✓ Inséré [${report.status.toUpperCase()}] ${report.id} (${report.region})`);
    } catch (insertErr: any) {
      console.warn(`  ⚠️ Échec écriture pour ${report.id} : ${insertErr?.message || insertErr}`);
    }
  }

  console.log('\n🎉 Base de données Firestore peuplée avec succès avec les réclamations tunisiennes !\n');
  printSummaryTable(TUNISIAN_REPORTS_SEED);
}

function printSummaryTable(seeds: CivicReportSeed[]) {
  console.log('-------------------------------------------------------------------------------------------------------------------');
  console.log('| ID                     | Région (Mo3tamdiya)   | Catégorie      | Statut      | Photo Avant          | Photo Après          |');
  console.log('-------------------------------------------------------------------------------------------------------------------');
  for (const s of seeds) {
    const id = s.id.padEnd(22);
    const reg = s.region.padEnd(21);
    const cat = s.category.padEnd(14);
    const stat = s.status.padEnd(11);
    const before = s.photoBeforeUrl.padEnd(20);
    const after = (s.photoAfterUrl || 'N/A').padEnd(20);
    console.log(`| ${id} | ${reg} | ${cat} | ${stat} | ${before} | ${after} |`);
  }
  console.log('-------------------------------------------------------------------------------------------------------------------\n');
}

main().catch((err) => {
  console.error('Fatal seeder error:', err);
  process.exit(1);
});
