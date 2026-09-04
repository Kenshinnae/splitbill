"use client";

import {
  onSnapshot,
  orderBy,
  query,
  collection,
  type Unsubscribe,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { billDocRef, itemsCol, participantsCol } from "@/lib/bill-service";
import {
  logFirebasePermissionHint,
  toUserFacingFirebaseError,
} from "@/lib/firebase-client-errors";
import { getFirebaseDb } from "@/lib/firebase";
import type { Bill, BillItem, Participant, Selection } from "@/types";

export interface RealtimeBillState {
  bill: Bill | null;
  items: BillItem[];
  participants: Participant[];
  selections: Selection[];
  loading: boolean;
  error: string | null;
}

const CONNECT_STALL_MS = 28_000;

export function useRealtimeBill(billId: string | null): RealtimeBillState {
  const [bill, setBill] = useState<Bill | null>(null);
  const [items, setItems] = useState<BillItem[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [loading, setLoading] = useState(() => Boolean(billId));
  const [error, setError] = useState<string | null>(null);
  const billSnapReceivedRef = useRef(false);

  useEffect(() => {
    if (!billId) {
      queueMicrotask(() => {
        setBill(null);
        setItems([]);
        setParticipants([]);
        setSelections([]);
        setLoading(false);
        setError(null);
      });
      return;
    }

    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });

    billSnapReceivedRef.current = false;
    const stallTimer = window.setTimeout(() => {
      if (!billSnapReceivedRef.current) {
        setError(
          "Could not connect (timed out). In-app browsers such as Messenger often block the live database. Open this link in Safari or Chrome, then try again.",
        );
        setLoading(false);
      }
    }, CONNECT_STALL_MS);

    const unsubs: Unsubscribe[] = [];

    try {
      const db = getFirebaseDb();

      unsubs.push(
        onSnapshot(
          billDocRef(billId),
          (snap) => {
            billSnapReceivedRef.current = true;
            clearTimeout(stallTimer);
            if (!snap.exists()) {
              setBill(null);
              setError("Bill not found.");
              setLoading(false);
              return;
            }
            setBill({ id: snap.id, ...snap.data() } as Bill);
            setLoading(false);
            setError(null);
          },
          (err) => {
            billSnapReceivedRef.current = true;
            clearTimeout(stallTimer);
            logFirebasePermissionHint(err.message);
            setError(toUserFacingFirebaseError(err.message));
            setLoading(false);
          },
        ),
      );

      const iq = query(itemsCol(billId), orderBy("createdAt", "asc"));
      unsubs.push(
        onSnapshot(
          iq,
          (snap) => {
            setItems(
              snap.docs.map(
                (d) => ({ id: d.id, ...d.data() }) as BillItem,
              ),
            );
          },
          (err) => {
            logFirebasePermissionHint(err.message);
            setError(toUserFacingFirebaseError(err.message));
          },
        ),
      );

      const pq = query(participantsCol(billId), orderBy("joinedAt", "asc"));
      unsubs.push(
        onSnapshot(
          pq,
          (snap) => {
            setParticipants(
              snap.docs.map(
                (d) => ({ id: d.id, ...d.data() }) as Participant,
              ),
            );
          },
          (err) => {
            logFirebasePermissionHint(err.message);
            setError(toUserFacingFirebaseError(err.message));
          },
        ),
      );

      unsubs.push(
        onSnapshot(
          collection(db, "bills", billId, "selections"),
          (snap) => {
            setSelections(
              snap.docs.map(
                (d) => ({ id: d.id, ...d.data() }) as Selection,
              ),
            );
          },
          (err) => {
            logFirebasePermissionHint(err.message);
            setError(toUserFacingFirebaseError(err.message));
          },
        ),
      );
    } catch (e) {
      clearTimeout(stallTimer);
      queueMicrotask(() => {
        setError(e instanceof Error ? e.message : "Failed to subscribe.");
        setLoading(false);
      });
    }

    return () => {
      clearTimeout(stallTimer);
      unsubs.forEach((u) => u());
    };
  }, [billId]);

  return useMemo(
    () => ({ bill, items, participants, selections, loading, error }),
    [bill, items, participants, selections, loading, error],
  );
}
