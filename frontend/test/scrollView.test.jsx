// ScrollView following: jsdom does no layout, so each test sets the sizes and positions it needs.
import { describe, it, expect } from "vitest";
import { createRef } from "react";
import { render } from "@testing-library/react";
import { ScrollView, View } from "../src/ui/primitives/index.js";

const VIEW_HEIGHT = 500;
const CONTENT_HEIGHT = 3000;

function renderScroller() {
  const scrollerRef = createRef();
  const replyRef = createRef();
  const { container } = render(
    <ScrollView ref={scrollerRef}>
      <View ref={replyRef}>A long reply</View>
    </ScrollView>,
  );
  const scrollingElement = container.firstChild;
  Object.defineProperty(scrollingElement, "scrollHeight", { value: CONTENT_HEIGHT });
  Object.defineProperty(scrollingElement, "clientHeight", { value: VIEW_HEIGHT });
  scrollingElement.getBoundingClientRect = () => ({ top: 0 });
  return { scrollerRef, replyRef, scrollingElement };
}

// Places the reply's top this far down the content, given where the view is scrolled to.
function placeReplyAt(replyRef, scrollingElement, contentOffset) {
  replyRef.current.getBoundingClientRect = () => {
    return { top: contentOffset - scrollingElement.scrollTop };
  };
}

describe("ScrollView", () => {
  it("scrolls to the end when nothing is kept in view", () => {
    const { scrollerRef, scrollingElement } = renderScroller();
    scrollerRef.current.scrollToEnd();
    expect(scrollingElement.scrollTop).toBe(CONTENT_HEIGHT);
  });

  it("stops where a long reply's first line would leave the top of the view", () => {
    const { scrollerRef, replyRef, scrollingElement } = renderScroller();
    placeReplyAt(replyRef, scrollingElement, 1000);

    scrollerRef.current.scrollToEnd({ keepTopVisible: replyRef });

    expect(scrollingElement.scrollTop).toBeLessThan(1000);
    expect(scrollingElement.scrollTop).toBeGreaterThan(1000 - 50);
  });

  it("never pulls the view back up while following", () => {
    const { scrollerRef, replyRef, scrollingElement } = renderScroller();
    scrollingElement.scrollTop = 1500;
    placeReplyAt(replyRef, scrollingElement, 1000);

    scrollerRef.current.scrollToEnd({ keepTopVisible: replyRef });

    expect(scrollingElement.scrollTop).toBe(1500);
  });
});
