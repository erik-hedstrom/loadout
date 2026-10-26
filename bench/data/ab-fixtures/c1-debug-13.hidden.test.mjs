// The A/B harness's own check for c1-debug-13. It is copied next to the agent's menu.js after a run and
// never put in the agent's folder. It uses the page's contract (createMenu({ doc, button, panel }) from ./menu.js)
// and Node's EventTarget, with no dependency.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createMenu } from './menu.js';

/** An EventTarget that knows how many listeners it holds right now. */
class Counted extends EventTarget {
  entries = [];
  addEventListener(type, fn, options) {
    const capture = options === true || options?.capture === true;
    if (!this.entries.some((e) => e.type === type && e.fn === fn && e.capture === capture)) this.entries.push({ type, fn, capture });
    super.addEventListener(type, fn, options);
  }
  removeEventListener(type, fn, options) {
    const capture = options === true || options?.capture === true;
    this.entries = this.entries.filter((e) => !(e.type === type && e.fn === fn && e.capture === capture));
    super.removeEventListener(type, fn, options);
  }
}

function page() {
  const doc = new Counted();
  doc.activeElement = null;
  // Correct implementations may move focus on open or return it on Escape; neither is required here.
  const element = () => Object.assign(new Counted(), { focus() { doc.activeElement = this; } });
  const button = Object.assign(element(), { contains: (node) => node === button });
  const item = element();
  const panel = Object.assign(element(), { hidden: true, contains: (node) => node === panel || node === item });
  const outside = element();
  // Node's EventTarget does not bubble: repeat the event on `doc` unless a handler stopped it.
  const fire = (target, type, props = {}) => {
    const make = () => Object.defineProperty(Object.assign(new Event(type, { cancelable: true }), props), 'target', { value: target });
    const event = make();
    target.dispatchEvent(event);
    if (target !== doc && !event.cancelBubble) doc.dispatchEvent(make());
  };
  const menu = createMenu({ doc, button, panel });
  return { doc, button, panel, item, outside, fire, menu, listeners: () => doc.entries.length + button.entries.length + panel.entries.length };
}

test('a tap on the button opens the panel', () => {
  const { panel, button, fire } = page();
  fire(button, 'click');
  assert.equal(panel.hidden, false);
  assert.equal(button.ariaExpanded, 'true');
});

test('a tap outside the panel closes it', () => {
  const { panel, button, outside, fire } = page();
  fire(button, 'click');
  fire(outside, 'click');
  assert.equal(panel.hidden, true);
  assert.equal(button.ariaExpanded, 'false');
});

test('Escape closes it, wherever the focus is', () => {
  for (const where of ['doc', 'panel', 'button']) {
    const p = page();
    p.fire(p.button, 'click');
    p.fire(p[where], 'keydown', { key: 'Escape' });
    assert.equal(p.panel.hidden, true, `Escape pressed on ${where}`);
  }
});

test('other keys leave it open', () => {
  const { panel, button, doc, fire } = page();
  fire(button, 'click');
  fire(doc, 'keydown', { key: 'Enter' });
  assert.equal(panel.hidden, false);
});

test('taps inside the panel leave it open', () => {
  const { panel, button, item, fire } = page();
  fire(button, 'click');
  fire(item, 'click');
  fire(panel, 'click');
  assert.equal(panel.hidden, false);
});

test('the menu opens again after it was closed, by either way', () => {
  const { panel, button, outside, doc, fire } = page();
  fire(button, 'click');
  fire(outside, 'click');
  fire(button, 'click');
  assert.equal(panel.hidden, false, 'reopened after an outside tap');
  fire(doc, 'keydown', { key: 'Escape' });
  fire(button, 'click');
  assert.equal(panel.hidden, false, 'reopened after Escape');
  fire(outside, 'click');
  assert.equal(panel.hidden, true, 'an outside tap still closes it the second time');
});

test('a tap on the button closes an open menu', () => {
  const { panel, button, fire } = page();
  fire(button, 'click');
  fire(button, 'click');
  assert.equal(panel.hidden, true);
});

test('listeners added on open are removed on close', () => {
  const p = page();
  const initial = p.listeners();
  for (let i = 0; i < 4; i++) {
    p.fire(p.button, 'click');
    p.fire(i % 2 ? p.doc : p.outside, i % 2 ? 'keydown' : 'click', i % 2 ? { key: 'Escape' } : {});
    assert.equal(p.panel.hidden, true);
    assert.ok(p.listeners() <= initial, `${p.listeners()} listeners remain after cycle ${i + 1}, against ${initial} when the menu was created`);
  }
});
