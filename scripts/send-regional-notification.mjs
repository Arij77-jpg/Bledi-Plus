#!/usr/bin/env node
/**
 * Regional Push Notification Dispatch Service (`scripts/send-regional-notification.mjs`)
 * ======================================================================================
 * Production Cloud Function & CLI dispatch utility for Bledi+:
 * When a citizen creates a report in a municipal Délégation (e.g., "Sousse Médina"),
 * this script finds all verified municipal admins and employees assigned to that region
 * (or Super-Admins with 'ALL') and pushes a high-priority incident alert to their devices.
 *
 * Usage:
 *   node send-regional-notification.mjs --region "Sousse Médina" --title "Fuite d'eau urgente" --category "water"
 *   node send-regional-notification.mjs --report-id "rep_sousse_001"
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
 * Sends messages to Expo Push Notification gateway
 */
export async function sendExpoPushNotifications(messages) {
  if (!messages || messages.length === 0) {
    console.log('[PUSH] No valid recipient push tokens found.');
    return [];
  }

  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  const results = [];
  for (const chunk of chunks) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk),
    });

    const data = await response.json();
    results.push(data);
  }

  return results;
}

/**
 * Dispatch regional alert to municipal staff assigned to `region`
 */
export async function dispatchRegionalAlert({
  region,
  title,
  category = 'infrastructure',
  reportId,
}) {
  const db = admin.firestore();

  console.log(`[+] Querying municipal staff for regional jurisdiction: "${region}"...`);

  // Query staff users (admin and employee)
  const staffSnapshot = await db
    .collection('users')
    .where('role', 'in', ['admin', 'employee'])
    .get();

  const recipients = [];

  staffSnapshot.forEach((doc) => {
    const user = doc.data();
    const userRegion = user.assignedRegion || 'Sousse Médina';
    const isSuper = user.isSuperAdmin === true || userRegion === 'ALL';

    const hasAuthority =
      isSuper ||
      userRegion.toLowerCase().trim() === region.toLowerCase().trim() ||
      userRegion === 'ALL';

    if (hasAuthority && user.pushToken && typeof user.pushToken === 'string') {
      recipients.push({
        uid: doc.id,
        name: user.displayName,
        email: user.email,
        pushToken: user.pushToken,
        region: userRegion,
      });
    }
  });

  console.log(`[+] Found ${recipients.length} authorized staff recipients.`);

  if (recipients.length === 0) {
    console.log('[!] No active push tokens registered for this region yet.');
    return { dispatched: 0, recipients: [] };
  }

  const messages = recipients.map((r) => ({
    to: r.pushToken,
    sound: 'default',
    title: `🚨 Bledi+ Alerte - ${region}`,
    body: `${title} (${category.toUpperCase()})`,
    data: {
      reportId,
      region,
      category,
    },
    priority: 'high',
    channelId: 'civic_regional_alerts',
  }));

  const pushResult = await sendExpoPushNotifications(messages);
  console.log('[SUCCESS] Push notifications sent to Expo gateway:', JSON.stringify(pushResult, null, 2));

  return {
    dispatched: messages.length,
    recipients: recipients.map((r) => ({ email: r.email, region: r.region })),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || (!args.region && !args['report-id'])) {
    console.log(`
Bledi+ Regional Incident Push Notification Dispatcher
-----------------------------------------------------
Options:
  --region <region>           Required: Target Délégation (e.g., "Sousse Médina", "Hammam Sousse")
  --title <title>             Incident headline
  --category <category>       Category: infrastructure | sanitation | lighting | water | other
  --report-id <id>            Optional report ID
  --service-account <path>    Path to serviceAccountKey.json
`);
    process.exit(args.help ? 0 : 1);
  }

  initializeFirebaseAdmin(args['service-account']);
  const db = admin.firestore();

  let region = args.region;
  let title = args.title || 'Nouvel incident signalé par un citoyen sur Bledi+';
  let category = args.category || 'infrastructure';
  let reportId = args['report-id'];

  if (args['report-id'] && !args.region) {
    const docSnap = await db.collection('reports').doc(args['report-id']).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      region = data.region;
      title = data.title;
      category = data.category;
    } else {
      console.error(`[ERROR] Report "${args['report-id']}" not found in Firestore.`);
      process.exit(1);
    }
  }

  const result = await dispatchRegionalAlert({
    region,
    title,
    category,
    reportId,
  });

  console.log('[COMPLETE]', JSON.stringify(result, null, 2));
  process.exit(0);
}

const isCliEntry = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isCliEntry) {
  main().catch((err) => {
    console.error('[ERROR] Dispatch failed:', err.message);
    process.exit(1);
  });
}
