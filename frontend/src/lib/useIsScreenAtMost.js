// Whether the window is this many pixels wide or narrower, kept up to date as it's resized.
// Pages use it to choose between the phone and desktop layouts of a component.
import { useEffect, useState } from "react";
import { isScreenAtMost, watchScreenAtMost } from "../platform/index.js";

export function useIsScreenAtMost(width) {
  const [isAtMost, setIsAtMost] = useState(() => isScreenAtMost(width));
  useEffect(() => watchScreenAtMost(width, setIsAtMost), [width]);
  return isAtMost;
}
