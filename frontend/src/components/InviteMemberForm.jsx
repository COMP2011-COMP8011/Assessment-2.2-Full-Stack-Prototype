import { useState } from 'react';
import BusyButton from './BusyButton.jsx';

/** Adds a member by email (POST /parties/:partyId/members). */
export default function InviteMemberForm({ onInvite }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ status: 'idle', message: '' });

  async function submit(e) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setState({ status: 'error', message: 'Enter the email address they signed up with.' });
      return;
    }
    setState({ status: 'saving', message: '' });
    try {
      const name = await onInvite(value);
      setEmail('');
      setState({ status: 'done', message: `${name} joined the party.` });
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  }

  return (
    <form className="invite" onSubmit={submit} noValidate>
      <label htmlFor="invite-email">Add a member by email</label>
      <div className="invite-row">
        <input
          id="invite-email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={state.status === 'error'}
          aria-describedby="invite-status"
        />
        <BusyButton type="submit" className="btn btn-ghost" busy={state.status === 'saving'} busyText="Adding…">
          Add member
        </BusyButton>
      </div>
      <p id="invite-status" className={state.status === 'error' ? 'error' : 'hint'} role={state.status === 'error' ? 'alert' : 'status'}>
        {state.message}
      </p>
    </form>
  );
}
