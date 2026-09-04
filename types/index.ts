import type { Timestamp } from "firebase/firestore";

export type BillStatus = "draft" | "active" | "completed" | "closed";

/** How line total is split among participants. */
export type ItemSplitMode = "shared" | "quantity" | "single";

export interface Bill {
  id: string;
  ownerId: string;
  title: string;
  imageUrl: string | null;
  /** Copied from owner profile at finalize time for guest-visible pay QR. */
  ownerPaymentQrUrl?: string | null;
  status: BillStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  finalizedAt: Timestamp | null;
}

export interface BillItem {
  id: string;
  name: string;
  price: number;
  /** Quantity from receipt OCR; optional for legacy items. */
  qty?: number;
  /** Modifier lines (e.g. ไม่เอาน้ำแข็ง) attached during parsing. */
  notes?: string[];
  /**
   * shared: line total ÷ everyone who checks the item.
   * quantity: line total × (your units ÷ sum of all claimed units).
   * single: full line total to one assignee.
   */
  splitMode?: ItemSplitMode;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Participant {
  id: string;
  name: string;
  isDone: boolean;
  joinedAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Selection {
  id: string;
  itemId: string;
  participantId: string;
  selected: boolean;
  /** Units consumed for `quantity` split mode (non-negative integer). */
  claimedQty?: number;
  updatedAt: Timestamp | null;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: "owner";
  paymentQrUrl?: string | null;
  displayName?: string;
  notifyEnabled?: boolean;
}

export interface ParsedLineItem {
  name: string;
  price: number;
  qty?: number;
  notes?: string[];
}

export interface ParticipantTotalSummary {
  participantId: string;
  name: string;
  assignedItemsCount: number;
  totalOwed: number;
}
