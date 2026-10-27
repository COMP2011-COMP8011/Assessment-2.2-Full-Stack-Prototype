/** Per-user preferences, saved to the account (Users.settings in Assessment 1 §3.3). */
export default function PreferencesForm({ settings, onChange }) {
  return (
    <fieldset className="prefs">
      <legend>Preferences</legend>
      <label className="check">
        <input type="checkbox" checked={settings.audioEnabled} onChange={(e) => onChange({ audioEnabled: e.target.checked })} />
        Audio cues (master switch for every sound)
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.notificationsEnabled} onChange={(e) => onChange({ notificationsEnabled: e.target.checked })} />
        Alert me when teammates complete quests
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.highContrastMode} onChange={(e) => onChange({ highContrastMode: e.target.checked })} />
        High contrast
      </label>
    </fieldset>
  );
}
