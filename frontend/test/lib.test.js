import { describe, it, expect, vi } from "vitest";
import {
  formatDialValue,
  describeTimeAgo,
  initialOf,
  formatTokenCount,
  debounce,
} from "../src/lib/format.js";
import { parseRoleplayText } from "../src/lib/parseRoleplayText.js";
import { splitRoleplayParagraphs } from "../src/lib/splitRoleplayParagraphs.js";

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

describe("splitRoleplayParagraphs", () => {
  it("gives each action and each spoken line its own paragraph, quoting the speech", () => {
    const reply = "*The door swings shut.* Okay, so I need raspberries. *He turns.* What?";
    expect(splitRoleplayParagraphs(reply)).toEqual([
      { kind: "action", text: "The door swings shut." },
      {
        kind: "speech",
        pieces: [
          { kind: "plain", text: "“" },
          { kind: "plain", text: "Okay, so I need raspberries." },
          { kind: "plain", text: "”" },
        ],
      },
      { kind: "action", text: "He turns." },
      {
        kind: "speech",
        pieces: [
          { kind: "plain", text: "“" },
          { kind: "plain", text: "What?" },
          { kind: "plain", text: "”" },
        ],
      },
    ]);
  });

  it("keeps narration around quoted speech, and curls straight quotes", () => {
    expect(splitRoleplayParagraphs('She waits. "Fine," she says.')).toEqual([
      {
        kind: "mixed",
        pieces: [
          { kind: "plain", text: "She waits. " },
          { kind: "speech", text: "“Fine,”" },
          { kind: "plain", text: " she says." },
        ],
      },
    ]);
  });

  it("starts a paragraph at each line break and keeps stray punctuation with its action", () => {
    expect(splitRoleplayParagraphs("*nods*.\n\n**Now.**")).toEqual([
      { kind: "action", text: "nods." },
      {
        kind: "speech",
        pieces: [
          { kind: "plain", text: "“" },
          { kind: "bold", text: "Now." },
          { kind: "plain", text: "”" },
        ],
      },
    ]);
  });

  it("keeps a short *word* mid-sentence as emphasis, not an action", () => {
    const reply = "*leans back* It's what you think is *useful*, not what you'd *want*. *sighs*";
    expect(splitRoleplayParagraphs(reply)).toEqual([
      { kind: "action", text: "leans back" },
      {
        kind: "speech",
        pieces: [
          { kind: "plain", text: "“" },
          { kind: "plain", text: "It's what you think is " },
          { kind: "emphasis", text: "useful" },
          { kind: "plain", text: ", not what you'd " },
          { kind: "emphasis", text: "want" },
          { kind: "plain", text: "." },
          { kind: "plain", text: "”" },
        ],
      },
      { kind: "action", text: "sighs" },
    ]);
  });

  it("keeps phrases the speaker quotes inside the speech, in single quotes", () => {
    const reply = 'There\'s a difference between "useful" and "oh HELL yes" for you.';
    expect(splitRoleplayParagraphs(reply)).toEqual([
      {
        kind: "speech",
        pieces: [
          { kind: "plain", text: "“" },
          { kind: "plain", text: "There's a difference between " },
          { kind: "quoted", text: "‘useful’" },
          { kind: "plain", text: " and " },
          { kind: "quoted", text: "‘oh HELL yes’" },
          { kind: "plain", text: " for you." },
          { kind: "plain", text: "”" },
        ],
      },
    ]);
  });

  it("still reads dialogue after a comma or a colon as narration around speech", () => {
    const paragraphs = splitRoleplayParagraphs('He shrugs, "Maybe." Then: "Or not."');
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].kind).toBe("mixed");
  });

  it("returns nothing for empty text", () => {
    expect(splitRoleplayParagraphs("")).toEqual([]);
    expect(splitRoleplayParagraphs(null)).toEqual([]);
  });
});
