// A scrolling container. The ref exposes scrollToEnd() and isNearEnd(), matching how React Native's
// ScrollView is driven, so callers never touch scroll positions directly.
import { forwardRef, useImperativeHandle, useRef } from "react";

const NEAR_END_DISTANCE_PIXELS = 160;

export const ScrollView = forwardRef(function ScrollView(
  { className, style, onScroll, children },
  ref,
) {
  const containerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    scrollToEnd() {
      const container = containerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
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
