/* =========================================================
   Firebase configuration
   =========================================================
   Fill this in with YOUR Firebase project's config to enable
   shared, real-time cloud storage — so anyone who opens your
   GitHub Pages URL sees and edits the SAME inventory, live,
   from any device, for free.

   Where to get these values:
   1. Go to https://console.firebase.google.com and create a
      free project (no credit card required).
   2. In the project, click the "</>" (Web) icon to register
      a web app.
   3. Firebase shows you a firebaseConfig object — copy the
      values below.
   4. Enable Firestore: left sidebar → Build → Firestore
      Database → Create database → Start in test mode
      (see README.md for production-safe security rules).

   It is safe to commit this file publicly, INCLUDING the
   apiKey. Firebase web config values are not secret — access
   to your data is controlled by Firestore Security Rules
   (see README.md), not by hiding this file.

   Until you fill these in, the app automatically falls back
   to storing data only in this browser (localStorage).
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyCfk39IKGx_ZLUV_bgff0EhoXOf8vIDys4",
  authDomain: "haldia-lpg-inventory.firebaseapp.com",
  projectId: "haldia-lpg-inventory",
  storageBucket: "haldia-lpg-inventory.firebasestorage.app",
  messagingSenderId: "260105854006",
  appId: "1:260105854006:web:b770a86b74e6061ba84c97"
};
