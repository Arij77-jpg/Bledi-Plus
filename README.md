# بلادي+ (Bledi+) — Citizen Reporting & Municipal Governance

> **"تصويرة منّك، وبلادنا تزيان بينا"**  
> *Taswira mennek, w bledna tizyen bina* — "Une photo de vous, et notre pays s'embellit grâce à nous"

A production-grade mobile application for civic issue reporting and municipal intervention tracking in Tunisia, built with **React Native (Expo SDK 58, Expo Router)**, **TypeScript**, and **Firebase (Auth Custom Claims, Cloud Firestore, Storage)** following a strict **Zero-Trust RBAC Security Architecture**.

---

## 🛡️ Zero-Trust Security Architecture

### 1. Role-Based Access Control (Firebase Custom Claims)
User roles (`citizen`, `employee`, `admin`) are stored cryptographically in signed Firebase Auth ID Tokens (`request.auth.token.role`)—**never** read from client-writable Firestore documents:
- **`citizen`**: Public registration allowed (`app/(auth)/register.tsx` locks signup to `citizen`). Reads all reports & comments, creates reports defaulted strictly to `status: 'pending'`, edits only their own safe profile fields (`displayName`, `photoURL`), and toggles their own UID in `upvotedBy` (`+1` / `-1`).
- **`employee` (Municipal Worker)**: Pre-provisioned out-of-band only. Can transition incidents `pending -> in_progress -> resolved` and upload resolution photos strictly to `reports/{reportId}/resolution_proof/`. Marking a ticket `resolved` **requires** attaching `photoAfterUrl`.
- **`admin`**: Pre-provisioned out-of-band only. Full administrative access to triage priorities, assign/reassign crews, delete spam reports, and manage user records.

### 2. Provisioning Admin & Employee Accounts
Use the server-only Node.js Firebase Admin SDK script in `scripts/set-custom-claims.mjs`:
```bash
cd scripts && npm install
node set-custom-claims.mjs --create --email admin@municipality.gov --password "StrongPassword!26" --name "City Admin" --role admin
node set-custom-claims.mjs --create --email worker@municipality.gov --password "StrongPassword!26" --name "Officer Ahmed" --role employee
```
*Note: `firebase-admin` and `serviceAccountKey.json` must never be bundled into the React Native app.*

### 3. Hardware-Backed Auth Persistence (`expo-secure-store`)
`src/services/secureStorage.ts` implements a UTF-8 byte-safe chunked persistence adapter over iOS Keychain / Android Keystore (`expo-secure-store`), replacing plaintext `AsyncStorage` for Firebase Auth JWT persistence.

### 4. Protected Expo Router Routes
- `/(tabs)/*` & `/report/*`: Protected by `<ProtectedRoute>` requiring authenticated sessions.
- `/employee/*`: Protected by `<ProtectedRoute allowedRoles={['employee', 'admin']} />`.
- `/admin/*`: Strictly protected by `<ProtectedRoute allowedRoles={['admin']} />`.

---

## 📂 Project Directory Structure

```text
projet mobile/
├── app/
│   ├── _layout.tsx                     # Root stack & AuthProvider
│   ├── (auth)/                         # Citizen-only registration & secure login
│   ├── (tabs)/                         # Protected Citizen Feed, Live Map, New Report, Profile
│   ├── employee/                       # RBAC-guarded Municipal Employee dispatch & resolve screens
│   ├── admin/                          # Strict Admin-only triage, assignment & moderation console
│   └── report/                         # Authenticated report detail, Before/After proof & comments
├── scripts/
│   ├── package.json                    # Server-only firebase-admin setup
│   ├── set-custom-claims.mjs           # CLI utility to mint custom claims & revoke refresh tokens
│   └── README.md
├── src/
│   ├── components/
│   │   ├── ProtectedRoute.tsx          # Expo Router RBAC redirect wrapper
│   │   ├── ResolutionModalContent.tsx  # Mandatory After-photo resolution form
│   │   └── ...                         # ReportCard, MediaUploadBox, UpvoteButton, Badges
│   ├── context/AuthContext.tsx         # Custom Claims JWT extraction via onIdTokenChanged
│   ├── services/
│   │   ├── firebase.ts                 # Modular Firebase SDK using encrypted SecureStore persistence
│   │   ├── secureStorage.ts            # Chunked iOS Keychain / Android Keystore adapter
│   │   └── reports.ts                  # Validated Storage/Firestore mutations & upvote transactions
│   └── utils/errors.ts                 # Security-safe Firebase error sanitizer
├── firestore.rules                     # Custom-Claim RBAC, schema & differential-update rules
└── storage.rules                       # 5 MB ceiling, JPEG/PNG MIME check & resolution_proof/ lock
```

---

## ⚡ Quick Start & Rules Deployment

1. Configure your Firebase Web SDK credentials in `src/services/firebase.ts`.
2. Deploy Firestore & Storage rules:
```bash
firebase deploy --only firestore:rules,storage
```
3. Launch Expo:
```bash
npx expo start
```
