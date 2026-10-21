import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from './ratelimiter.mjs';

function limiter(opts = {}) {
  let t = 0;
  const rl = new RateLimiter({ capacity: 3, refillPerSec: 1, now: () => t, ...opts });
  return { rl, advance: (ms) => (t += ms) };
}

test('allows a burst up to capacity, then rejects', () => {
  const { rl } = limiter();
  assert.equal(rl.allow('a'), true);
  assert.equal(rl.allow('a'), true);
  assert.equal(rl.allow('a'), true);
  assert.equal(rl.allow('a'), false);
});

test('refills one token per second', () => {
  const { rl, advance } = limiter();
  for (let i = 0; i < 3; i++) rl.allow('a');
  advance(999);
  assert.equal(rl.allow('a'), false);
  advance(1);
  assert.equal(rl.allow('a'), true);
  assert.equal(rl.allow('a'), false);
});

test('never holds more than capacity after a long idle period', () => {
  const { rl, advance } = limiter();
  advance(60_000);
  assert.equal(rl.allow('a'), true);
  assert.equal(rl.allow('a'), true);
  assert.equal(rl.allow('a'), true);
  assert.equal(rl.allow('a'), false);
});

test('keys do not share a bucket', () => {
  const { rl } = limiter();
  for (let i = 0; i < 3; i++) rl.allow('a');
  assert.equal(rl.allow('a'), false);
  assert.equal(rl.allow('b'), true);
});

test('a request costing more than the capacity is never allowed', () => {
  const { rl, advance } = limiter();
  advance(10_000);
  assert.equal(rl.allow('a', 4), false);
});

test('a rejected request does not use up tokens', () => {
  const { rl } = limiter();
  assert.equal(rl.allow('a', 4), false);
  assert.equal(rl.allow('a', 3), true);
});
