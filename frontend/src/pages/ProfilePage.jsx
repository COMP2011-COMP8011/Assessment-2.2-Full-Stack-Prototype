import { useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import AvatarPicker from '../components/AvatarPicker.jsx';
import BusyButton from '../components/BusyButton.jsx';
import PreferencesForm from '../components/PreferencesForm.jsx';
import { formatXp } from '../logic/xp.js';

const memberSince = (iso) => (iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

/** The signed-in user's profile (GET /users/me), editable name and avatar, preferences and Log out. */
export default function ProfilePage({ user, partyCount, onSaveProfile, onPreferences, onLogout, onError }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatar, setAvatar] = useState(user.avatar);
  const [state, setState] = useState({ status: 'idle', message: '', field: '' });
  const changed = displayName.trim() !== user.displayName || avatar !== user.avatar;

  async function save(e) {
    e.preventDefault();
    if (!displayName.trim()) {
      setState({ status: 'error', message: 'Enter the name your party will see.', field: 'displayName' });
      onError?.();
      return;
    }
    setState({ status: 'saving', message: '', field: '' });
    try {
      await onSaveProfile({ displayName: displayName.trim(), avatar });
      setState({ status: 'done', message: 'Profile saved. Your parties and quests show the new details.', field: '' });
    } catch (error) {
      setState({ status: 'error', message: error.message, field: error.details?.[0]?.field || '' });
      onError?.();
    }
  }

  return (
    <>
      <header className="banner">
        <h1>Your profile</h1>
        <p>How your party sees you, and how TaskParty behaves for you.</p>
      </header>

      <section className="profile-card" aria-labelledby="profile-name">
        <Avatar name={user.displayName} colour={user.avatar} size="lg" />
        <div>
          <h2 id="profile-name">{user.displayName}</h2>
          <p className="profile-email">{user.email}</p>
          <dl className="profile-facts">
            <div><dt>Total XP</dt><dd>{formatXp(user.totalXpEarned)}</dd></div>
            <div><dt>Parties</dt><dd>{partyCount}</dd></div>
            <div><dt>Member since</dt><dd>{memberSince(user.createdAt)}</dd></div>
          </dl>
        </div>
      </section>

      <div className="profile-grid">
        <form className="panel" onSubmit={save} noValidate aria-labelledby="edit-heading">
          <h2 id="edit-heading">Edit profile</h2>
          <div className="field">
            <label htmlFor="pf-name">Display name</label>
            <input
              id="pf-name"
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-invalid={state.field === 'displayName'}
              aria-describedby="pf-status"
            />
          </div>
          <AvatarPicker name={displayName} value={avatar} onChange={setAvatar} legend="Avatar colour" />
          <p id="pf-status" className={state.status === 'error' ? 'error' : 'hint'} role={state.status === 'error' ? 'alert' : 'status'}>
            {state.message}
          </p>
          <BusyButton type="submit" busy={state.status === 'saving'} busyText="Saving…" disabled={!changed}>Save profile</BusyButton>
        </form>

        <div className="panel">
          <h2>Settings</h2>
          <PreferencesForm settings={user.settings} onChange={onPreferences} />
          <div className="logout-row">
            <p className="hint">Signed in as {user.email}.</p>
            <button type="button" className="btn btn-ghost" onClick={() => onLogout()}>Log out</button>
          </div>
        </div>
      </div>
    </>
  );
}
