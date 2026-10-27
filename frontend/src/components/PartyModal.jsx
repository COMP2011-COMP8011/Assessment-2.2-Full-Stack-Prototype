import { useEffect, useRef, useState } from 'react';
import BusyButton from './BusyButton.jsx';

export default function PartyModal({ onSubmit, onClose, onError }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const first = useRef(null);

  useEffect(() => {
    first.current?.focus(); // focus the first field once, when the dialog opens
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give the party a name.');
      onError?.();
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() });
    } catch (err) {
      setError(err.message);
      onError?.();
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="party-modal-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="party-modal-title">Create a party</h2>
        <form onSubmit={submit} noValidate aria-busy={saving || undefined}>
          <div className="field">
            <label htmlFor="p-name">Party name</label>
            <input id="p-name" ref={first} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} aria-invalid={!!error} aria-describedby={error ? 'p-name-err' : undefined} />
            {error && <p id="p-name-err" className="error" role="alert">{error}</p>}
          </div>
          <div className="field">
            <label htmlFor="p-desc">Description (optional, Markdown)</label>
            <textarea id="p-desc" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <BusyButton type="submit" busy={saving} busyText="Creating…">Create party</BusyButton>
          </div>
        </form>
      </div>
    </div>
  );
}
