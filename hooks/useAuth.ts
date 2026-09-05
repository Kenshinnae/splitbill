"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase";
import { ensureUserProfile } from "@/lib/bill-service";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u?.email) {
        // Firestore writes may remain pending offline. Never gate Auth/UI on one.
        void ensureUserProfile(u.uid, u.email).catch(() => {
          /* profile sync is best-effort */
        });
      }
    });
    return () => unsub();
  }, []);

  return { user, loading };
}
