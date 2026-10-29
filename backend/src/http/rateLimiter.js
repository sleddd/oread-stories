// Counts requests per key (a user id) in fixed time windows, so one account can't keep the
// server's shared local models busy for everyone else. Counts live in this process only: with
// several server instances each one limits on its own, which still bounds the load per instance.
export function createRateLimiter({ limit, windowMilliseconds, now = Date.now }) {
  // key → { windowStart, count }
  const windowsByKey = new Map();

  function forgetExpiredWindows(currentTime) {
    for (const [key, window] of windowsByKey) {
      if (currentTime - window.windowStart >= windowMilliseconds) {
        windowsByKey.delete(key);
      }
    }
  }

  // Records one request. Returns { isAllowed, retryAfterSeconds }.
  function hit(key) {
    const currentTime = now();
    let window = windowsByKey.get(key);
    if (!window || currentTime - window.windowStart >= windowMilliseconds) {
      forgetExpiredWindows(currentTime);
      window = { windowStart: currentTime, count: 0 };
      windowsByKey.set(key, window);
    }
    window.count += 1;
    if (window.count <= limit) {
      return { isAllowed: true, retryAfterSeconds: 0 };
    }
    const millisecondsLeft = window.windowStart + windowMilliseconds - currentTime;
    return { isAllowed: false, retryAfterSeconds: Math.ceil(millisecondsLeft / 1000) };
  }

  return { hit };
}
