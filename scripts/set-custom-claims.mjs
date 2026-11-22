#!/usr/bin/env node
/**
 * Firebase Admin SDK Custom Claims Provisioning Utility
 * =====================================================
 * Securely assigns verified RBAC roles (`admin`, `employee`, `citizen`) via
 * Firebase Auth Custom Claims (`request.auth.token.role`).
 *
 * SECURITY PRINCIPLE:
 * Never bundle `firebase-admin` or Service Account private keys into the
 * React Native client app. Execute this script strictly in a trusted operator
 * environment or convert `assignRoleClaim` into a privileged Cloud Function.
 *
 * Usage examples:
 *   export GOOGLE_APPLICATION_CREDENTIALS="./serviceAccountKey.json"
 *   node set-custom-claims.mjs --email officer@municipality.gov --role employee
 *   node set-custom-claims.mjs --uid AbCdEf123456 --role admin
 *   node set-custom-claims.mjs --email new.staff@municipality.gov --role employee --create --password "TempPassword!23" --name "Officer Ahmed"
 *   node set-custom-claims.mjs --uid AbCdEf123456 --role citizen --revoke
 */

import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ALLOWED_ROLES = new Set(['citizen', 'employee', 'admin']);

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

  // Uses GOOGLE_APPLICATION_CREDENTIALS or GCP runtime metadata
  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

/**
 * Core provisioning routine (reusable inside Cloud Functions / Admin scripts).
 */
export async function assignRoleClaim({
  uid,
  email,
  role,
  region,
  isSuperAdmin = false,
  createIfMissing = false,
  password,
  displayName,
  revokeExistingTokens = true,
}) {
  if (!ALLOWED_ROLES.has(role)) {
    throw new Error(`Invalid role "${role}". Allowed roles: citizen, employee, admin.`);
  }
  if (!uid && !email) {
    throw new Error('Must supply either --uid or --email.');
  }

  const auth = admin.auth();
  const db = admin.firestore();
  let userRecord;

  if (uid) {
    userRecord = await auth.getUser(uid);
  } else {
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (err) {
      if (err.code === 'auth/user-not-found' && createIfMissing) {
        if (!password || password.length < 8) {
          throw new Error('Creating a pre-provisioned account requires --password (min 8 chars).');
        }
        userRecord = await auth.createUser({
          email,
          password,
          displayName: displayName || (role === 'admin' ? 'City Administrator' : 'Municipal Employee'),
          emailVerified: true,
        });
        console.log(`[+] Created new pre-provisioned Auth user: ${userRecord.uid} (${email})`);
      } else {
        throw err;
      }
    }
  }

  const assignedRegion = isSuperAdmin ? 'ALL' : (region || (role === 'admin' ? 'Sousse Médina' : null));
  const superAdminFlag = Boolean(isSuperAdmin || assignedRegion === 'ALL');

  // 1. Set cryptographically signed Custom Claim evaluated by Firestore/Storage rules
  await auth.setCustomUserClaims(userRecord.uid, {
    role,
    assignedRegion,
    isSuperAdmin: superAdminFlag,
    claimsAssignedAt: Date.now(),
  });

  // 2. Revoke active refresh tokens so stale role privileges terminate immediately
  if (revokeExistingTokens) {
    await auth.revokeRefreshTokens(userRecord.uid);
  }

  // 3. Synchronize read-only profile mirror in Firestore (never authoritative for access control)
  const userRef = db.collection('users').doc(userRecord.uid);
  const snap = await userRef.get();

  if (!snap.exists) {
    await userRef.set({
      uid: userRecord.uid,
      email: userRecord.email || email || '',
      displayName: userRecord.displayName || displayName || 'Municipal User',
      photoURL: userRecord.photoURL || null,
      role,
      assignedRegion,
      isSuperAdmin: superAdminFlag,
      points: 0,
      badge: 'Novice Watcher',
      reportsCount: 0,
      resolvedCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await userRef.update({
      role,
      assignedRegion,
      isSuperAdmin: superAdminFlag,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return {
    uid: userRecord.uid,
    email: userRecord.email,
    role,
    assignedRegion,
    isSuperAdmin: superAdminFlag,
    tokensRevoked: revokeExistingTokens,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || (!args.uid && !args.email)) {
    console.log(`
Firebase Custom Claims Provisioning Script
------------------------------------------
Options:
  --uid <uid>                 Target Firebase Auth UID
  --email <email>             Target user email (looked up via Firebase Auth)
  --role <role>               Required: citizen | employee | admin
  --region <region>           Municipal jurisdiction (e.g. "Sousse Médina", "Hammam Sousse")
  --super-admin               Assign global municipal authority across all delegations (region="ALL")
  --service-account <path>    Path to serviceAccountKey.json (optional if GOOGLE_APPLICATION_CREDENTIALS set)
  --create                    Create account if email does not exist (for Admin/Employee pre-provisioning)
  --password <pass>           Initial password when using --create (min 8 chars)
  --name <displayName>        Display name when using --create
  --revoke                    Explicitly confirm refresh-token revocation (enabled by default; pass --no-revoke to skip)
`);
    process.exit(args.help ? 0 : 1);
  }

  const role = String(args.role || '').toLowerCase();
  initializeFirebaseAdmin(args['service-account']);

  const result = await assignRoleClaim({
    uid: args.uid ? String(args.uid) : undefined,
    email: args.email ? String(args.email) : undefined,
    role,
    region: args.region ? String(args.region) : undefined,
    isSuperAdmin: Boolean(args['super-admin']),
    createIfMissing: Boolean(args.create),
    password: args.password ? String(args.password) : undefined,
    displayName: args.name ? String(args.name) : undefined,
    revokeExistingTokens: args['no-revoke'] ? false : true,
  });

  console.log('[SUCCESS] Custom claim provisioned:', JSON.stringify(result, null, 2));
  console.log('Note: The user must sign in again or call getIdTokenResult(true) to obtain the updated JWT.');
  process.exit(0);
}

const isCliEntry = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isCliEntry) {
  main().catch((err) => {
    console.error('[ERROR] Failed to assign custom claims:', err.message);
    process.exit(1);
  });
}
