// Token bucket, one bucket per key. `now` is injectable so tests can control time.
export class RateLimiter {
  constructor({ capacity, refillPerSec, now = () => Date.now() }) {
    this.capacity = capacity;
    this.refillPerSec = refillPerSec;
    this.now = now;
    this.tokens = capacity;
    this.last = now();
  }

  allow(key, cost = 1) {
    const t = this.now();
    const elapsed = t - this.last;
    this.tokens = this.tokens + elapsed * this.refillPerSec;
    this.last = t;

    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    return false;
  }
}
