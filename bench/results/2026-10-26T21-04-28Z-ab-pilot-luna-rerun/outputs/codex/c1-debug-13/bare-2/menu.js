// Mobile menu: a button toggles a panel. `doc`, `button` and `panel` are passed in, so the
// same code runs in the page (index.html) and under Node (menu.test.mjs).
export function createMenu({ doc, button, panel }) {
  let isOpen = false;

  const render = () => {
    panel.hidden = !isOpen;
    button.ariaExpanded = String(isOpen);
  };

  const onOutsideTap = (event) => {
    if (panel.contains(event.target) || button.contains(event.target)) return;
    close();
  };

  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      close();
      button.focus();
    }
  };

  function open() {
    isOpen = true;
    render();
    doc.addEventListener('click', onOutsideTap);
    doc.addEventListener('keydown', onKeydown);
  }

  function close() {
    isOpen = false;
    render();
    doc.removeEventListener('click', onOutsideTap);
    doc.removeEventListener('keydown', onKeydown);
  }

  button.addEventListener('click', () => (isOpen ? close() : open()));
  render();

  return { open, close, isOpen: () => isOpen };
}
