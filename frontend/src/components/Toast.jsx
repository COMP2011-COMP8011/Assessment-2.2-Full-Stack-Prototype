// Messages after an action. Assessment 1 §2.2: success/failure messages appear in
// aria-live="assertive" regions; errors also use role="alert". The close control has a
// text label (icon-only buttons are not allowed, §2.1).
export default function Toast({ message, tone = 'info', onDismiss }) {
  const isError = tone === 'error';
  return (
    <div className={`toast ${isError ? 'toast-error' : ''}`} role={isError ? 'alert' : 'status'} aria-live="assertive" aria-atomic="true">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" className="toast-close" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}
