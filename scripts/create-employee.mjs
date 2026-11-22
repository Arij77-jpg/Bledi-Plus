#!/usr/bin/env node
/**
 * Municipal Employee Provisioning Utility & Cloud Function Module (`scripts/create-employee.mjs`)
 * =========================================================================================
 *
 * Provides two deployment targets:
 * 1. Privileged CLI execution for system administrators & DevOps pipelines.
 * 2. Exported Firebase Cloud Functions (v2) Callable handler `createEmployeeAccountCallable`
 *    strictly verifying caller's Custom Claim `role === 'admin'`.
 *
 * Security Principle:
 * Sets cryptographically signed Custom Claims `{ role: 'employee', assignedRegion, isActive: true }`
 * and creates the corresponding Firestore `/users/{uid}` document.
 *
 * CLI Usage:
 *   node create-employee.mjs --name "Chiheb Mansour" --email "chiheb@blediplus.tn" --region "Sousse Médina" --password "TempPass123"
 */

import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function initializeFirebaseAdmin(serviceAccountPath) {
  if (admin.apps.length > 0) return admin.app();

  if (serviceAccountPath) {
    const absolutePath = resolve(serviceAccountPath);
    const serviceAccount = JSON.parse(readFileSync(absolutePath, 'utf8'));
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

/**
 * Server-side worker provisioning logic
 */
export async function provisionMunicipalWorker({
  displayName,
  email,
  password,
  assignedRegion,
  serviceAccountPath,
}) {
  initializeFirebaseAdmin(serviceAccountPath);
  const auth = admin.auth();
  const db = admin.firestore();

  const trimmedEmail = email.toLowerCase().trim();
  const trimmedName = displayName.trim();
  const trimmedRegion = assignedRegion.trim();

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(trimmedEmail);
    console.log(`[Provision] Existing user found (UID: ${userRecord.uid}). Updating record...`);
    if (password) {
      await auth.updateUser(userRecord.uid, {
        displayName: trimmedName,
        password,
      });
    }
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log(`[Provision] Creating new Auth record for ${trimmedEmail}...`);
      userRecord = await auth.createUser({
        email: trimmedEmail,
        password: password || 'BlediPlus2026!',
        displayName: trimmedName,
        emailVerified: true,
      });
    } else {
      throw err;
    }
  }

  // 1. Set Authoritative Custom Claims
  const claims = {
    role: 'employee',
    assignedRegion: trimmedRegion,
    isActive: true,
  };

  await auth.setCustomUserClaims(userRecord.uid, claims);
  console.log(`[Provision] Custom Claims stamped on token:`, claims);

  // 2. Synchronize Firestore Document (/users/{uid})
  await db.collection('users').doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
      email: trimmedEmail,
      displayName: trimmedName,
      role: 'employee',
      assignedRegion: trimmedRegion,
      isActive: true,
      points: 0,
      badge: 'Civic Guardian',
      reportsCount: 0,
      resolvedCount: 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`[Provision] Firestore /users/${userRecord.uid} synchronized successfully.`);
  return { uid: userRecord.uid, email: trimmedEmail, assignedRegion: trimmedRegion };
}

/**
 * Cloud Function Callable Definition (Firebase Functions v2)
 *
 * Example index.ts:
 *   import { onCall, HttpsError } from "firebase-functions/v2/https";
 *   import { createEmployeeAccountCallable } from "./create-employee.mjs";
 *   export const createEmployeeAccount = createEmployeeAccountCallable;
 */
export function createCallableHandler() {
  return async (request) => {
    // Zero-Trust: Caller MUST possess verified admin custom claim
    if (!request.auth || request.auth.token.role !== 'admin') {
      throw new Error('PERMISSION_DENIED: Seul un administrateur vérifié peut créer des comptes employés.');
    }

    const { displayName, email, password, assignedRegion } = request.data || {};
    if (!displayName || !email || !password || !assignedRegion) {
      throw new Error('INVALID_ARGUMENT: displayName, email, password, et assignedRegion sont requis.');
    }

    return await provisionMunicipalWorker({
      displayName,
      email,
      password,
      assignedRegion,
    });
  };
}

// Direct CLI Invocation Execution
const isDirectCli = process.argv[1]?.endsWith('create-employee.mjs');
if (isDirectCli) {
  const args = parseArgs(process.argv.slice(2));

  if (!args.email || !args.name || !args.region) {
    console.log(`
Usage:
  node create-employee.mjs --email <email> --name <name> --region <region> [--password <password>] [--service-account <path>]

Example:
  node create-employee.mjs --email chiheb@blediplus.tn --name "Chiheb Mansour" --region "Sousse Médina" --password "TempPass123"
    `);
    process.exit(1);
  }

  provisionMunicipalWorker({
    displayName: args.name,
    email: args.email,
    password: args.password,
    assignedRegion: args.region,
    serviceAccountPath: args['service-account'],
  })
    .then((result) => {
      console.log('\n✅ SUCCÈS : Agent municipal provisionné :', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ ERREUR :', err.message);
      process.exit(1);
    });
}
