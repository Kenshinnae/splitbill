import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytes,
  listAll,
  deleteObject,
} from "firebase/storage";
import type {
  Bill,
  BillItem,
  BillStatus,
  ItemSplitMode,
  ParsedLineItem,
  Participant,
} from "@/types";
import { getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from "@/lib/firebase";
import { toUserFacingFirebaseError } from "@/lib/firebase-client-errors";

export function billDocRef(billId: string) {
  return doc(getFirebaseDb(), "bills", billId);
}

export function itemsCol(billId: string) {
  return collection(getFirebaseDb(), "bills", billId, "items");
}

export function participantsCol(billId: string) {
  return collection(getFirebaseDb(), "bills", billId, "participants");
}

export function selectionsCol(billId: string) {
  return collection(getFirebaseDb(), "bills", billId, "selections");
}

export function selectionDocId(itemId: string, participantId: string) {
  return `${itemId}__${participantId}`;
}

export async function ensureUserProfile(uid: string, email: string) {
  const uref = doc(getFirebaseDb(), "users", uid);
  await setDoc(
    uref,
    {
      uid,
      email,
      role: "owner",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function createDraftBill(ownerId: string, title: string) {
  const col = collection(getFirebaseDb(), "bills");
  const bref = doc(col);
  await setDoc(bref, {
    ownerId,
    title: title.trim() || "New bill",
    imageUrl: null,
    status: "draft" as BillStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    finalizedAt: null,
  });
  return bref.id;
}

export async function getBill(billId: string): Promise<Bill | null> {
  const snap = await getDoc(billDocRef(billId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Bill;
}

export async function updateBillTitle(billId: string, title: string) {
  await updateDoc(billDocRef(billId), {
    title: title.trim() || "Untitled bill",
    updatedAt: serverTimestamp(),
  });
}

function isRetryableStorageError(err: unknown): boolean {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code)
      : "";
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    code.includes("retry-limit-exceeded") ||
    code.includes("canceled") ||
    code.includes("unknown") ||
    code.includes("unavailable") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("failed to fetch") ||
    msg.includes("internal error")
  );
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/** Upload receipt image with auth refresh + retries (Storage is often flaky on mobile). */
export async function uploadBillReceiptImage(
  billId: string,
  file: File,
): Promise<string> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Sign in again, then re-upload the receipt.");
  }

  // Force a fresh ID token so Storage rules see a valid auth.uid.
  await user.getIdToken(true);

  const storage = getFirebaseStorage();
  const safeName = (file.name.replace(/[^\w.-]+/g, "_") || "receipt").replace(
    /\.(heic|heif)$/i,
    ".jpg",
  );
  const contentType =
    file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
  const path = `bills/${billId}/${Date.now()}_${safeName}`;
  const sref = ref(storage, path);

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        await user.getIdToken(true);
        await sleep(400 * attempt);
      }
      await uploadBytes(sref, file, {
        contentType,
        customMetadata: { billId, uploadedBy: user.uid },
      });
      return await getDownloadURL(sref);
    } catch (err) {
      lastErr = err;
      if (attempt < 2 && isRetryableStorageError(err)) continue;
      break;
    }
  }

  const raw =
    lastErr instanceof Error ? lastErr.message : "Could not upload receipt image.";
  throw new Error(toUserFacingFirebaseError(raw));
}

export async function setBillImageUrl(billId: string, imageUrl: string) {
  await updateDoc(billDocRef(billId), {
    imageUrl,
    updatedAt: serverTimestamp(),
  });
}

export async function replaceItemsFromParsed(
  billId: string,
  lines: ParsedLineItem[],
) {
  const db = getFirebaseDb();
  const icol = itemsCol(billId);
  const existing = await getDocs(icol);
  const batch = writeBatch(db);
  existing.forEach((d) => batch.delete(d.ref));
  for (const line of lines) {
    const iref = doc(icol);
    batch.set(iref, {
      name: line.name,
      price: line.price,
      splitMode: "shared",
      ...(line.qty != null ? { qty: line.qty } : {}),
      ...(line.notes?.length ? { notes: line.notes } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  batch.update(billDocRef(billId), { updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function addBillItem(
  billId: string,
  name: string,
  price: number,
  extras?: { qty?: number; notes?: string[] },
) {
  await addDoc(itemsCol(billId), {
    name: name.trim(),
    price,
    splitMode: "shared",
    ...(extras?.qty != null ? { qty: extras.qty } : {}),
    ...(extras?.notes?.length ? { notes: extras.notes } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(billDocRef(billId), { updatedAt: serverTimestamp() });
}

export async function updateBillItem(
  billId: string,
  itemId: string,
  patch: {
    name?: string;
    price?: number;
    qty?: number;
    notes?: string[];
    splitMode?: ItemSplitMode;
  },
) {
  const iref = doc(getFirebaseDb(), "bills", billId, "items", itemId);
  await updateDoc(iref, { ...patch, updatedAt: serverTimestamp() });
  await updateDoc(billDocRef(billId), { updatedAt: serverTimestamp() });
}

export async function deleteBillItem(billId: string, itemId: string) {
  await deleteDoc(doc(getFirebaseDb(), "bills", billId, "items", itemId));
  const sdocs = await getDocs(selectionsCol(billId));
  const batch = writeBatch(getFirebaseDb());
  sdocs.forEach((d) => {
    const data = d.data() as { itemId?: string };
    if (data.itemId === itemId) batch.delete(d.ref);
  });
  batch.update(billDocRef(billId), { updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function addParticipant(billId: string, name: string) {
  const pref = await addDoc(participantsCol(billId), {
    name: name.trim(),
    isDone: false,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(billDocRef(billId), { updatedAt: serverTimestamp() });
  return pref.id;
}

export async function removeParticipant(billId: string, participantId: string) {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, "bills", billId, "participants", participantId));
  const sdocs = await getDocs(selectionsCol(billId));
  const batch = writeBatch(db);
  sdocs.forEach((d) => {
    const data = d.data() as { participantId?: string };
    if (data.participantId === participantId) batch.delete(d.ref);
  });
  batch.update(billDocRef(billId), { updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function setParticipantDone(
  billId: string,
  participantId: string,
  isDone: boolean,
) {
  const pref = doc(getFirebaseDb(), "bills", billId, "participants", participantId);
  await updateDoc(pref, { isDone, updatedAt: serverTimestamp() });
  await updateDoc(billDocRef(billId), { updatedAt: serverTimestamp() });
}

export async function addGuestParticipant(billId: string, name: string) {
  return addParticipant(billId, name);
}

export async function clearSelectionsForItem(billId: string, itemId: string) {
  const db = getFirebaseDb();
  const snap = await getDocs(selectionsCol(billId));
  const batch = writeBatch(db);
  snap.forEach((d) => {
    const data = d.data() as { itemId?: string };
    if (data.itemId === itemId) batch.delete(d.ref);
  });
  batch.update(billDocRef(billId), { updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function setSelection(
  billId: string,
  itemId: string,
  participantId: string,
  selected: boolean,
  options?: { claimedQty?: number },
) {
  const db = getFirebaseDb();
  const sid = selectionDocId(itemId, participantId);
  const sref = doc(db, "bills", billId, "selections", sid);
  await setDoc(
    sref,
    {
      itemId,
      participantId,
      selected,
      claimedQty: options?.claimedQty ?? 0,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await updateDoc(billDocRef(billId), { updatedAt: serverTimestamp() });
}

export async function setClaimedQuantity(
  billId: string,
  itemId: string,
  participantId: string,
  units: number,
) {
  const u = Math.max(0, Math.floor(Number(units)));
  await setSelection(billId, itemId, participantId, u > 0, { claimedQty: u });
}

export async function assignSingleItem(
  billId: string,
  itemId: string,
  assigneeId: string | null,
) {
  const db = getFirebaseDb();
  const q = query(selectionsCol(billId), where("itemId", "==", itemId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach((d) => {
    batch.update(d.ref, {
      selected: false,
      claimedQty: 0,
      updatedAt: serverTimestamp(),
    });
  });
  if (assigneeId) {
    const sid = selectionDocId(itemId, assigneeId);
    const sref = doc(db, "bills", billId, "selections", sid);
    batch.set(
      sref,
      {
        itemId,
        participantId: assigneeId,
        selected: true,
        claimedQty: 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
  batch.update(billDocRef(billId), { updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function startSharing(billId: string) {
  await updateDoc(billDocRef(billId), {
    status: "active",
    updatedAt: serverTimestamp(),
  });
}

export async function finalizeBill(billId: string) {
  await updateDoc(billDocRef(billId), {
    status: "completed",
    finalizedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Equality-only query — no composite index. Sort with `sortBillsByUpdatedAtDesc`. */
export function billsForOwnerQuery(ownerId: string) {
  return query(
    collection(getFirebaseDb(), "bills"),
    where("ownerId", "==", ownerId),
  );
}

export function sortBillsByUpdatedAtDesc(bills: Bill[]): Bill[] {
  return [...bills].sort((a, b) => {
    const ta = a.updatedAt?.toMillis?.() ?? 0;
    const tb = b.updatedAt?.toMillis?.() ?? 0;
    return tb - ta;
  });
}

async function deleteCollectionDocs(
  colRef: ReturnType<typeof collection>,
) {
  const db = getFirebaseDb();
  // Firestore batches cap at 500 ops; delete in chunks.
  for (;;) {
    const snap = await getDocs(colRef);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < 400) return;
  }
}

/** Delete bill document, all subcollections, and receipt images in Storage. */
export async function deleteBill(billId: string) {
  const db = getFirebaseDb();
  const subcols = ["items", "participants", "selections", "activity"] as const;
  for (const name of subcols) {
    await deleteCollectionDocs(collection(db, "bills", billId, name));
  }

  try {
    const folder = ref(getFirebaseStorage(), `bills/${billId}`);
    const listed = await listAll(folder);
    await Promise.all(listed.items.map((item) => deleteObject(item)));
  } catch {
    /* Storage cleanup is best-effort */
  }

  await deleteDoc(billDocRef(billId));
}

export type { Bill, BillItem, Participant };
