import { useEffect, useRef, useState } from 'react';

/**
 * Dashboard floating action button (Assessment 1, Screen 2): "enables quick task creation or
 * Party creation". Opens a small menu with both choices.
 */
export default function FabMenu({ onNewQuest, onNewParty, canCreateQuest }) {
  const [open, setOpen] = useState(false);
  const questItem = useRef(null);
  const partyItem = useRef(null);
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    (canCreateQuest ? questItem : partyItem).current?.focus();
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onClick = (e) => !wrap.current?.contains(e.target) && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, canCreateQuest]);

  const choose = (action) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="fab-wrap" ref={wrap}>
      {open && (
        <div id="fab-menu" className="fab-menu" role="group" aria-label="Create">
          <button type="button" ref={questItem} className="btn btn-ghost" onClick={choose(onNewQuest)} disabled={!canCreateQuest}>
            New quest
          </button>
          {!canCreateQuest && <p className="hint">Create a party first.</p>}
          <button type="button" ref={partyItem} className="btn btn-ghost" onClick={choose(onNewParty)}>New party</button>
        </div>
      )}
      <button type="button" className="fab" aria-expanded={open} aria-controls="fab-menu" onClick={() => setOpen((o) => !o)}>
        {open ? 'Close' : '+ Create'}
      </button>
    </div>
  );
}
