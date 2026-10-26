# site-menu

The small-screen menu of a marketing site. `menu.js` exports
`createMenu({ doc, button, panel })`; `index.html` wires it to the page.

- `button` toggles `panel`. `panel.hidden` and `button.ariaExpanded` show the state.
- `doc`, `button` and `panel` are passed in, so the tests run under Node with
  `EventTarget`s instead of a browser.

Run the tests with `npm test` (Node 22 or later, no dependencies).

Known problem: on phones the menu opens, but it does not close when you tap
outside it or press Escape.
