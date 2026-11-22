# Server-Side RBAC Provisioning (`scripts/`)

**Zero-Trust Rule:** `firebase-admin` and `serviceAccountKey.json` must **never** live inside the React Native bundle or client repository commits.

## 1. Setup (Admin Machine Only)
```bash
cd scripts
npm install
```

Download a Service Account private key from **Firebase Console > Project Settings > Service Accounts > Generate new private key**, save it outside version control (e.g., `../serviceAccountKey.json` and ensure it is in `.gitignore`), and set:
```bash
# PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccountKey.json"
```

## 2. Provision Initial Admin & Municipal Employees
```bash
# Pre-provision a new Admin account
node set-custom-claims.mjs --create --email chief.admin@municipality.gov --password "StrongAdminPassword!2026" --name "Chief Administrator" --role admin

# Pre-provision a new Municipal Field Worker (Employee)
node set-custom-claims.mjs --create --email worker.ahmed@municipality.gov --password "StrongWorkerPassword!2026" --name "Officer Ahmed" --role employee

# Promote an existing citizen UID or revoke privileges back to citizen
node set-custom-claims.mjs --uid <FIREBASE_UID> --role employee
node set-custom-claims.mjs --uid <FIREBASE_UID> --role citizen --revoke
```
