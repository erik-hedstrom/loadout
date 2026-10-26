import assert from 'node:assert/strict';
import test from 'node:test';
import { createMenu } from './menu.js';

// A page without a browser: EventTargets stand in for the DOM. Node's EventTarget does not bubble,
// so `fire` repeats the event on `doc` the way a browser would, unless a handler stopped it.
function page() {
  const doc = new EventTarget();
  const button = Object.assign(new EventTarget(), { contains: (node) => node === button });
  const item = new EventTarget();
  const panel = Object.assign(new EventTarget(), { hidden: true, contains: (node) => node === panel || node === item });
  const outside = new EventTarget();
  const fire = (target, type, props = {}) => {
    const make = () => Object.defineProperty(Object.assign(new Event(type, { cancelable: true }), props), 'target', { value: target });
    const event = make();
    target.dispatchEvent(event);
    if (target !== doc && !event.cancelBubble) doc.dispatchEvent(make());
  };
  return { doc, button, panel, item, outside, fire, menu: createMenu({ doc, button, panel }) };
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

test('a tap inside the open panel leaves it open', () => {
  const { panel, item, fire, menu } = page();
  menu.open();
  fire(item, 'click');
  assert.equal(panel.hidden, false);
  assert.equal(menu.isOpen(), true);
});

test('a tap outside closes the panel', () => {
  const { panel, outside, fire, menu } = page();
  menu.open();
  fire(outside, 'click');
  assert.equal(panel.hidden, true);
  assert.equal(menu.isOpen(), false);
});

test('Escape closes the panel', () => {
  const { panel, doc, fire, menu } = page();
  menu.open();
  fire(doc, 'keydown', { key: 'Escape' });
  assert.equal(panel.hidden, true);
  assert.equal(menu.isOpen(), false);
});

test('the toggle stays open on its opening click and toggles closed on the next click', () => {
  const { panel, button, fire, menu } = page();
  fire(button, 'click');
  assert.equal(panel.hidden, false);
  fire(button, 'click');
  assert.equal(panel.hidden, true);
  assert.equal(menu.isOpen(), false);
});
