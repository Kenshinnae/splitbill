import type {
  BillItem,
  ItemSplitMode,
  Participant,
  ParticipantTotalSummary,
  Selection,
} from "@/types";

export type ItemAssignmentState = "unassigned" | "assigned";

export function getItemSplitMode(item: BillItem): ItemSplitMode {
  return item.splitMode ?? "shared";
}

function selectionMap(
  selections: Selection[],
): Map<string, Map<string, Selection>> {
  const byItem = new Map<string, Map<string, Selection>>();
  for (const s of selections) {
    let inner = byItem.get(s.itemId);
    if (!inner) {
      inner = new Map();
      byItem.set(s.itemId, inner);
    }
    inner.set(s.participantId, s);
  }
  return byItem;
}

function claimedUnits(s: Selection | undefined): number {
  if (!s) return 0;
  const q = s.claimedQty;
  if (typeof q !== "number" || Number.isNaN(q)) return 0;
  return Math.max(0, Math.floor(q));
}

export interface ItemWithAssignment {
  item: BillItem;
  mode: ItemSplitMode;
  assignment: ItemAssignmentState;
  /** Shared mode */
  selectorCount: number;
  sharePerPerson: number | null;
  /** Quantity mode */
  totalClaimedUnits: number;
  /** Single mode */
  assigneeId: string | null;
}

export function computeItemAssignments(
  items: BillItem[],
  participants: Participant[],
  selections: Selection[],
): ItemWithAssignment[] {
  const sm = selectionMap(selections);

  return items.map((item) => {
    const mode = getItemSplitMode(item);
    const rowMap = sm.get(item.id) ?? new Map();

    if (mode === "shared") {
      const selectedIds: string[] = [];
      for (const p of participants) {
        if (rowMap.get(p.id)?.selected) selectedIds.push(p.id);
      }
      const count = selectedIds.length;
      if (count === 0) {
        return {
          item,
          mode,
          assignment: "unassigned",
          selectorCount: 0,
          sharePerPerson: null,
          totalClaimedUnits: 0,
          assigneeId: null,
        };
      }
      return {
        item,
        mode,
        assignment: "assigned",
        selectorCount: count,
        sharePerPerson: item.price / count,
        totalClaimedUnits: 0,
        assigneeId: null,
      };
    }

    if (mode === "quantity") {
      let total = 0;
      for (const p of participants) {
        total += claimedUnits(rowMap.get(p.id));
      }
      if (total <= 0) {
        return {
          item,
          mode,
          assignment: "unassigned",
          selectorCount: 0,
          sharePerPerson: null,
          totalClaimedUnits: 0,
          assigneeId: null,
        };
      }
      return {
        item,
        mode,
        assignment: "assigned",
        selectorCount: 0,
        sharePerPerson: null,
        totalClaimedUnits: total,
        assigneeId: null,
      };
    }

    // single
    const assignees: string[] = [];
    for (const p of participants) {
      if (rowMap.get(p.id)?.selected) assignees.push(p.id);
    }
    if (assignees.length !== 1) {
      return {
        item,
        mode,
        assignment: "unassigned",
        selectorCount: assignees.length,
        sharePerPerson: null,
        totalClaimedUnits: 0,
        assigneeId: null,
      };
    }
    return {
      item,
      mode,
      assignment: "assigned",
      selectorCount: 1,
      sharePerPerson: item.price,
      totalClaimedUnits: 0,
      assigneeId: assignees[0]!,
    };
  });
}

export function computeParticipantTotals(
  items: BillItem[],
  participants: Participant[],
  selections: Selection[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const p of participants) {
    totals.set(p.id, 0);
  }

  const sm = selectionMap(selections);

  for (const item of items) {
    const mode = getItemSplitMode(item);
    const rowMap = sm.get(item.id) ?? new Map();

    if (mode === "shared") {
      const selected: string[] = [];
      for (const p of participants) {
        if (rowMap.get(p.id)?.selected) selected.push(p.id);
      }
      if (selected.length === 0) continue;
      const each = item.price / selected.length;
      for (const pid of selected) {
        totals.set(pid, (totals.get(pid) ?? 0) + each);
      }
      continue;
    }

    if (mode === "quantity") {
      let totalUnits = 0;
      const unitsByP = new Map<string, number>();
      for (const p of participants) {
        const u = claimedUnits(rowMap.get(p.id));
        if (u > 0) {
          unitsByP.set(p.id, u);
          totalUnits += u;
        }
      }
      if (totalUnits <= 0) continue;
      for (const [pid, u] of unitsByP) {
        const share = item.price * (u / totalUnits);
        totals.set(pid, (totals.get(pid) ?? 0) + share);
      }
      continue;
    }

    // single
    let assignee: string | null = null;
    let count = 0;
    for (const p of participants) {
      if (rowMap.get(p.id)?.selected) {
        assignee = p.id;
        count += 1;
      }
    }
    if (count === 1 && assignee) {
      totals.set(assignee, (totals.get(assignee) ?? 0) + item.price);
    }
  }

  return totals;
}

/** Per-participant share for one item (for labels in the room). */
export function getParticipantShareForItem(
  item: BillItem,
  selections: Selection[],
  participantId: string,
  participants: Participant[],
): number {
  const sm = selectionMap(selections);
  const rowMap = sm.get(item.id) ?? new Map();
  const mode = getItemSplitMode(item);

  if (mode === "shared") {
    const selected = participants.filter((p) => rowMap.get(p.id)?.selected);
    if (selected.length === 0) return 0;
    if (!rowMap.get(participantId)?.selected) return 0;
    return item.price / selected.length;
  }

  if (mode === "quantity") {
    let totalUnits = 0;
    for (const p of participants) {
      totalUnits += claimedUnits(rowMap.get(p.id));
    }
    if (totalUnits <= 0) return 0;
    const mine = claimedUnits(rowMap.get(participantId));
    if (mine <= 0) return 0;
    return item.price * (mine / totalUnits);
  }

  const selected = participants.filter((p) => rowMap.get(p.id)?.selected);
  if (selected.length !== 1) return 0;
  if (selected[0]!.id !== participantId) return 0;
  return item.price;
}

export function buildFinalSummary(
  items: BillItem[],
  participants: Participant[],
  selections: Selection[],
): ParticipantTotalSummary[] {
  const totals = computeParticipantTotals(items, participants, selections);

  const itemCountByParticipant = new Map<string, number>();
  for (const p of participants) {
    itemCountByParticipant.set(p.id, 0);
  }

  for (const item of items) {
    for (const p of participants) {
      const share = getParticipantShareForItem(
        item,
        selections,
        p.id,
        participants,
      );
      if (share > 0) {
        itemCountByParticipant.set(
          p.id,
          (itemCountByParticipant.get(p.id) ?? 0) + 1,
        );
      }
    }
  }

  return participants.map((p) => ({
    participantId: p.id,
    name: p.name,
    assignedItemsCount: itemCountByParticipant.get(p.id) ?? 0,
    totalOwed: totals.get(p.id) ?? 0,
  }));
}
