import assert from 'node:assert/strict';
import test from 'node:test';
import { createMenu } from './menu.js';

// A page without a browser: EventTargets stand in for the DOM. Node's EventTarget does not bubble,
// so `fire` repeats the event on `doc` the way a browser would, unless a handler stopped it.
function page() {
  const doc = new EventTarget();
  let focusCount = 0;
  const button = Object.assign(new EventTarget(), {
    contains: (node) => node === button,
    focus: () => { focusCount += 1; },
  });
  const item = new EventTarget();
  const panel = Object.assign(new EventTarget(), { hidden: true, contains: (node) => node === panel || node === item });
  const outside = new EventTarget();
  const fire = (target, type, props = {}) => {
    const make = () => Object.defineProperty(Object.assign(new Event(type, { cancelable: true }), props), 'target', { value: target });
    const event = make();
    target.dispatchEvent(event);
    if (target !== doc && !event.cancelBubble) doc.dispatchEvent(make());
  };
  return { doc, button, panel, item, outside, fire, focusCount: () => focusCount, menu: createMenu({ doc, button, panel }) };
}

test('starts closed', () => {
  const { panel, button } = page();
  assert.equal(panel.hidden, true);
  assert.equal(button.ariaExpanded, 'false');
});

test('a tap on the button opens the panel', () => {
  const { panel, button, fire } = page();
  fire(button, 'click');
  assert.equal(panel.hidden, false);
  assert.equal(button.ariaExpanded, 'true');
});

test('a tap outside closes the panel', () => {
  const { panel, button, outside, fire } = page();
  fire(button, 'click');
  fire(outside, 'click');
  assert.equal(panel.hidden, true);
  assert.equal(button.ariaExpanded, 'false');
});

test('Escape closes the panel and returns focus to the button', () => {
  const { panel, button, item, fire, focusCount } = page();
  fire(button, 'click');
  fire(item, 'keydown', { key: 'Escape' });
  assert.equal(panel.hidden, true);
  assert.equal(button.ariaExpanded, 'false');
  assert.equal(focusCount(), 1);
});

test('interactions inside the panel do not close it', () => {
  const { panel, button, item, fire } = page();
  fire(button, 'click');
  fire(item, 'click');
  assert.equal(panel.hidden, false);
  assert.equal(button.ariaExpanded, 'true');
});
