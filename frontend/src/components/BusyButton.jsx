import Spinner from './Spinner.jsx';

// A button that shows a spinner and a progress label while its action runs.
export default function BusyButton({ busy = false, busyText, children, className = 'btn btn-primary', disabled, type = 'button', ...props }) {
  return (
    <button type={type} className={`${className} btn-busyable`} disabled={busy || disabled} aria-busy={busy || undefined} {...props}>
      {busy && <Spinner />}
      <span>{busy && busyText ? busyText : children}</span>
    </button>
  );
}
