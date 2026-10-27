import { API_URL } from '../api/client.js';

/** Explains why the API can't be reached — the most common setup problem in Codespaces. */
export default function ConnectionNotice({ health }) {
  if (health.status === 'ok') return null;
  if (health.status === 'checking') return <p className="hint" role="status">Connecting to the TaskParty server…</p>;
  const inCodespaces = API_URL.includes('.app.github.dev');
  return (
    <div className="notice notice-error" role="alert">
      <p><strong>Can't reach the TaskParty API</strong> at <code>{API_URL || '(VITE_API_URL is not set)'}</code>.</p>
      <p>
        {health.error?.status === 503
          ? 'The API is running but its database is not connected. Check the backend terminal.'
          : inCodespaces
            ? 'Make sure the backend is running, then open the Ports tab and set port 4000 to Public.'
            : 'Make sure the backend is running (npm run dev from the project folder).'}
      </p>
      <button type="button" className="btn btn-ghost" onClick={health.retry}>Try again</button>
    </div>
  );
}
