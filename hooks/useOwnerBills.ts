"use client";

import { onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  billsForOwnerQuery,
  sortBillsByUpdatedAtDesc,
} from "@/lib/bill-service";
import {
  logFirebasePermissionHint,
  toUserFacingFirebaseError,
} from "@/lib/firebase-client-errors";
import type { Bill } from "@/types";

export function useOwnerBills(ownerId: string | undefined) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId) {
      queueMicrotask(() => {
        setBills([]);
        setLoading(false);
      });
      return;
    }
    queueMicrotask(() => setLoading(true));
    const q = billsForOwnerQuery(ownerId);
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Bill,
        );
        setBills(sortBillsByUpdatedAtDesc(list));
        setLoading(false);
        setError(null);
      },
      (err) => {
        logFirebasePermissionHint(err.message);
        setError(toUserFacingFirebaseError(err.message));
        setLoading(false);
      },
    );
    return () => unsub();
  }, [ownerId]);

  return { bills, loading, error };
}
