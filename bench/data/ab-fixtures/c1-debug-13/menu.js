// Mobile menu: a button toggles a panel. `doc`, `button` and `panel` are passed in, so the
// same code runs in the page (index.html) and under Node (menu.test.mjs).
export function createMenu({ doc, button, panel }) {
  let isOpen = false;

  const render = () => {
    panel.hidden = !isOpen;
    button.ariaExpanded = String(isOpen);
  };

  const onOutsideTap = (event) => {
    if (panel.contains(event.target)) return;
    close();
  };

  const onKeydown = (event) => {
    if (event.key === 'Escape') close();
  };

  function open() {
    isOpen = true;
    render();
    panel.addEventListener('click', onOutsideTap);
    button.addEventListener('keydown', onKeydown);
  }

  function close() {
    isOpen = false;
    render();
    panel.removeEventListener('click', () => onOutsideTap);
    button.removeEventListener('keydown', onKeydown);
  }

  button.addEventListener('click', () => (isOpen ? close() : open()));
  render();

  return { open, close, isOpen: () => isOpen };
}
