// Loading spinner. With a `label` it announces itself (role="status"); without one it is
// decorative — use that inside buttons whose text already says what is happening.
export default function Spinner({ label, size = 'sm' }) {
  return (
    <span className={`spinner spinner-${size}`} role={label ? 'status' : undefined} aria-hidden={label ? undefined : 'true'}>
      {label && <span className="visually-hidden">{label}</span>}
    </span>
  );
}
