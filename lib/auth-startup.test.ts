import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  states: [] as unknown[],
  callback: undefined as ((user: unknown) => void) | undefined,
  profile: vi.fn(() => new Promise<void>(() => {})),
}));
vi.mock("react", () => ({
  useState: () => [null, (value: unknown) => mocks.states.push(value)],
  useEffect: (effect: () => unknown) => effect(),
}));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: (_auth: unknown, callback: typeof mocks.callback) => { mocks.callback = callback; return () => {}; } }));
vi.mock("@/lib/firebase", () => ({ getFirebaseAuth: () => ({}) }));
vi.mock("@/lib/bill-service", () => ({ ensureUserProfile: mocks.profile }));
import { useAuth } from "@/hooks/useAuth";
it("opens the authenticated UI even when the Firestore profile write never settles", () => {
  useAuth();
  const user = { uid: "test", email: "test@example.com" };
  mocks.callback!(user);
  expect(mocks.states).toEqual([user, false]);
  expect(mocks.profile).toHaveBeenCalledWith(user.uid, user.email);
  mocks.callback!(null);
  expect(mocks.states.slice(-2)).toEqual([null, false]);
});
