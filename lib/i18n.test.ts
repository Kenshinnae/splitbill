import { describe, expect, it } from "vitest";
import { translate } from "./i18n";
import { thaiMessages } from "./translations";

describe("language messages", () => {
  it("translates Thai and restores the English label", () => {
    expect(translate("th", "Start sharing")).toBe("เริ่มแชร์บิล");
    expect(translate("en", "Start sharing")).toBe("Start sharing");
  });
  it("preserves interpolation values, including user-entered titles", () => {
    expect(translate("th", "{title} is ready to finalize.", { title: "Dinner {count}" })).toBe("Dinner {count} พร้อมสรุปบิลแล้ว");
  });
  it("keeps all interpolation placeholders in the Thai dictionary", () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
    for (const [english, thai] of Object.entries(thaiMessages)) expect(placeholders(thai), english).toEqual(placeholders(english));
  });
});
