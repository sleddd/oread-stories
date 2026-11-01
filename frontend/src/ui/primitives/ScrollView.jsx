// A scrolling container. The ref exposes scrollToEnd() and isNearEnd(), matching how React Native's
// ScrollView is driven, so callers never touch scroll positions directly.
// scrollToEnd({ keepTopVisible }) takes a ref to a child and stops short of the end once that
// child's top would scroll out of view, so a long reply can be read from its first line.
import { forwardRef, useImperativeHandle, useRef } from "react";

const NEAR_END_DISTANCE_PIXELS = 160;
// Room left above a kept-visible child, so its first line isn't flush with the edge.
const KEPT_TOP_MARGIN_PIXELS = 12;

// How far down the container's content the child's top sits.
function contentOffsetOf(child, container) {
  const childTop = child.getBoundingClientRect().top;
  const containerTop = container.getBoundingClientRect().top;
  return childTop - containerTop + container.scrollTop;
}

function scrollTarget(container, keptChild) {
  const endPosition = container.scrollHeight;
  if (!keptChild) {
    return endPosition;
  }
  const keptTopPosition = contentOffsetOf(keptChild, container) - KEPT_TOP_MARGIN_PIXELS;
  return Math.min(endPosition, keptTopPosition);
}

export const ScrollView = forwardRef(function ScrollView(
  { className, style, onScroll, children },
  ref,
) {
  const containerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    scrollToEnd({ keepTopVisible } = {}) {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const target = scrollTarget(container, keepTopVisible?.current);
      // Following never pulls the view back up past where the reader already is.
      container.scrollTop = Math.max(container.scrollTop, target);
    },
    isNearEnd() {
      const container = containerRef.current;
      if (!container) {
        return true;
      }
      const distanceFromEnd = container.scrollHeight - container.scrollTop - container.clientHeight;
      return distanceFromEnd < NEAR_END_DISTANCE_PIXELS;
    },
  }));

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ overflow: "auto", ...style }}
      onScroll={onScroll}
    >
      {children}
    </div>
  );
});
