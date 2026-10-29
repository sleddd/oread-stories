import { describe, it, expect, vi } from "vitest";
import { formatDialValue, describeTimeAgo, initialOf, avatarColorFor, formatTokenCount, debounce } from "../src/lib/format.js";
import { parseRoleplayText } from "../src/lib/parseRoleplayText.js";

describe("formatDialValue", () => {
  it("shows a sign and one decimal place", () => {
    expect(formatDialValue(1.2)).toBe("+1.2");
    expect(formatDialValue(-0.4)).toBe("−0.4");
    expect(formatDialValue(0)).toBe("0.0");
  });
});

describe("describeTimeAgo", () => {
  const now = 1_000_000_000;

  it("describes recent times in words", () => {
    expect(describeTimeAgo(now - 10_000, now)).toBe("just now");
    expect(describeTimeAgo(now - 5 * 60_000, now)).toBe("5m ago");
    expect(describeTimeAgo(now - 3 * 3_600_000, now)).toBe("3h ago");
  });
});

describe("initialOf", () => {
  it("skips a leading 'The' and falls back to a question mark", () => {
    expect(initialOf("The Steady Mentor")).toBe("S");
    expect(initialOf("rowan")).toBe("R");
    expect(initialOf("")).toBe("?");
  });
});

describe("avatarColorFor", () => {
  it("turns warmer characters to a different hue", () => {
    const neutral = avatarColorFor({ values: {}, mood: { p: 0 } });
    const warm = avatarColorFor({ values: { communion: 2 }, mood: { p: 0 } });
    expect(neutral).toMatch(/^hsl\(/);
    expect(warm).not.toBe(neutral);
  });
});

describe("formatTokenCount", () => {
  it("rounds to a readable estimate", () => {
    expect(formatTokenCount(2037)).toBe("~2,037 tokens");
  });
});

describe("debounce", () => {
  it("runs once after the calls stop, and can be cancelled", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const debounced = debounce(callback, 100);
    debounced("first");
    debounced("second");
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("second");

    debounced("third");
    debounced.cancel();
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("parseRoleplayText", () => {
  it("splits actions, bold, speech and code from plain text", () => {
    expect(parseRoleplayText('She *smiles*. "Hello," she says, **firmly**, typing `ls`.')).toEqual([
      { kind: "plain", text: "She " },
      { kind: "action", text: "smiles" },
      { kind: "plain", text: ". " },
      { kind: "speech", text: '"Hello,"' },
      { kind: "plain", text: " she says, " },
      { kind: "bold", text: "firmly" },
      { kind: "plain", text: ", typing " },
      { kind: "code", text: "ls" },
      { kind: "plain", text: "." },
    ]);
  });

  it("returns plain text untouched, and nothing for empty input", () => {
    expect(parseRoleplayText("Just words")).toEqual([{ kind: "plain", text: "Just words" }]);
    expect(parseRoleplayText("")).toEqual([]);
    expect(parseRoleplayText(null)).toEqual([]);
  });
});
