# Beam Tracker v0.6.1

Firebase cloud version of Beam Tracker, built from the tested v0.5 workflow.

## What changed
- Firebase Authentication with email/password sign-in.
- Cloud Firestore stores the Beam Tracker data under the signed-in user's account.
- Local device storage remains as a safety cache.
- First sign-in on a device can import the existing V0.5 local data into the new Firebase account.
- Firestore IndexedDB persistence is enabled when the browser supports it, so the app can continue working with cached data when connectivity is unavailable.
- Existing V0.5 workflow is preserved: one open service visit per machine, multiple daily work logs, resumable inspections, machine status, and permanent history.

## Firebase setup
1. In Firebase Console, enable **Authentication → Sign-in method → Email/Password**.
2. Create **Cloud Firestore Database**.
3. Apply the rules in `firestore.rules`:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

4. Open the app from GitHub Pages over HTTPS.
5. Create your Beam Tracker account, then use **Create Account**.
6. If this is the device containing your V0.5 records, choose **Import** when the app asks.

## Important
The Firebase web configuration is client-side configuration; the Firestore security rules are what restrict database access to the authenticated user's own data.

## V0.6.1 fix
- Fixed Create Account / Sign In buttons to use explicit module event listeners instead of relying only on inline onclick handlers.
- Updated service-worker cache version.
