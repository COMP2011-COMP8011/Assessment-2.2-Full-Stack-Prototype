// Initials badge. The colour is the avatar the user picked at registration.
// Every colour keeps white initials above WCAG AA contrast (4.5:1).
export const AVATAR_COLOURS = {
  teal: '#007A7A',
  indigo: '#3949AB',
  violet: '#6A3FA0',
  rose: '#B3264A',
  amber: '#8A5A00',
  slate: '#475569',
};

export function initialsOf(name = '') {
  const letters = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase());
  return letters.join('') || '?';
}

export default function Avatar({ name, colour = 'teal', online, size = 'md' }) { // size: xs | sm | md | lg
  const label = online === undefined ? name : `${name}, ${online ? 'online' : 'offline'}`;
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ '--avatar-bg': AVATAR_COLOURS[colour] ?? AVATAR_COLOURS.teal }}
      role="img"
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">{initialsOf(name)}</span>
      {online && <span className="avatar-dot" aria-hidden="true" />}
    </span>
  );
}
