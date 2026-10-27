import Avatar, { AVATAR_COLOURS } from './Avatar.jsx';

const COLOUR_NAMES = { teal: 'Teal', indigo: 'Indigo', violet: 'Violet', rose: 'Rose', amber: 'Amber', slate: 'Slate' };

/** Avatar colour choice (registration and profile). A radio group, so it works with the keyboard. */
export default function AvatarPicker({ name, value, onChange, legend = 'Avatar colour (optional)' }) {
  return (
    <fieldset className="field">
      <legend>{legend}</legend>
      <div className="avatar-picker">
        {Object.keys(AVATAR_COLOURS).map((key) => (
          <label key={key} className={`avatar-choice ${value === key ? 'selected' : ''}`}>
            <input type="radio" name="avatar" value={key} checked={value === key} onChange={() => onChange(key)} className="visually-hidden" />
            <Avatar name={name || 'You'} colour={key} />
            <span>{COLOUR_NAMES[key]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
