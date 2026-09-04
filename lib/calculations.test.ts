import { describe, expect, it } from "vitest";
import {
  computeParticipantTotals,
  getParticipantShareForItem,
} from "./calculations";
import type { BillItem, Participant, Selection } from "@/types";

const participants: Participant[] = [
  {
    id: "a",
    name: "A",
    isDone: false,
    joinedAt: null,
    updatedAt: null,
  },
  {
    id: "b",
    name: "B",
    isDone: false,
    joinedAt: null,
    updatedAt: null,
  },
];

function sel(
  itemId: string,
  participantId: string,
  selected: boolean,
  claimedQty?: number,
): Selection {
  return {
    id: `${itemId}__${participantId}`,
    itemId,
    participantId,
    selected,
    claimedQty,
    updatedAt: null,
  };
}

describe("split modes", () => {
  it("shared: splits equally among selected", () => {
    const items: BillItem[] = [
      {
        id: "i1",
        name: "Pizza",
        price: 100,
        splitMode: "shared",
        createdAt: null,
        updatedAt: null,
      },
    ];
    const selections = [
      sel("i1", "a", true),
      sel("i1", "b", true),
    ];
    const totals = computeParticipantTotals(items, participants, selections);
    expect(totals.get("a")).toBe(50);
    expect(totals.get("b")).toBe(50);
  });

  it("quantity: splits by claimed units", () => {
    const items: BillItem[] = [
      {
        id: "i1",
        name: "Beer",
        price: 120,
        splitMode: "quantity",
        createdAt: null,
        updatedAt: null,
      },
    ];
    const selections = [
      sel("i1", "a", true, 2),
      sel("i1", "b", true, 1),
    ];
    const totals = computeParticipantTotals(items, participants, selections);
    expect(totals.get("a")).toBeCloseTo(80);
    expect(totals.get("b")).toBeCloseTo(40);
  });

  it("single: full line to one assignee", () => {
    const items: BillItem[] = [
      {
        id: "i1",
        name: "Fee",
        price: 30,
        splitMode: "single",
        createdAt: null,
        updatedAt: null,
      },
    ];
    const selections = [sel("i1", "b", true)];
    const totals = computeParticipantTotals(items, participants, selections);
    expect(totals.get("a")).toBe(0);
    expect(totals.get("b")).toBe(30);
  });

  it("getParticipantShareForItem matches totals", () => {
    const items: BillItem[] = [
      {
        id: "i1",
        name: "X",
        price: 90,
        splitMode: "quantity",
        createdAt: null,
        updatedAt: null,
      },
    ];
    const selections = [
      sel("i1", "a", true, 1),
      sel("i1", "b", true, 2),
    ];
    expect(
      getParticipantShareForItem(items[0]!, selections, "a", participants),
    ).toBeCloseTo(30);
    expect(
      getParticipantShareForItem(items[0]!, selections, "b", participants),
    ).toBeCloseTo(60);
  });
});
