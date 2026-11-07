import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { HexColorInput, HexColorPicker } from 'react-colorful';

import {
  DEFAULT_APPEARANCE,
  contrast,
  deriveColors,
  paletteIds,
  palettes,
  type AppearanceMode,
  type AppearanceStyle,
  type IconName,
  type PaletteId,
  type Scheme,
} from '@smarthome/theme';

import { Icon } from '../components/Icon';
import { modeIcon, modeName, useAppearance } from '../components/theme';

const MODES: AppearanceMode[] = ['system', 'light', 'dark', 'black'];
const STYLES: { id: AppearanceStyle; name: string; text: string; icon: IconName }[] = [
  { id: 'vivid', name: 'Kräftig', text: 'Verläufe, Leuchten in der Akzentfarbe, farbiger Hintergrund', icon: 'vivid' },
  { id: 'calm', name: 'Ruhig', text: 'Flach und zurückhaltend, getönte Flächen statt Verläufe', icon: 'calm' },
];

/**
 * Arrow keys in a radio group (like native radio buttons): Left/Up and Right/Down move to the previous/next option and
 * select it, Home/End to the first/last. Only the selected option is in the tab order.
 */
function radioKeys(event: KeyboardEvent<HTMLElement>) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  if (step === undefined && event.key !== 'Home' && event.key !== 'End') {
    return;
  }
  const radios = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
  const current = radios.indexOf(document.activeElement as HTMLElement);
  let next = event.key === 'Home' ? 0 : event.key === 'End' ? radios.length - 1 : current + (step ?? 0);
  next = (next + radios.length) % radios.length;
  event.preventDefault();
  radios[next]?.focus();
  radios[next]?.click();
}

/** Colour world, mode and style; every change shows at once and is remembered in this browser. */
export function AppearancePage() {
  const { appearance, scheme, colors, setAppearance, updateAppearance } = useAppearance();
  // Own colours start from the current accent, so switching to "Eigene Farben" does not jump
  const custom = appearance.custom ?? { accent: colors.accent, accent2: colors.accent2 };
  const setCustom = (change: Partial<typeof custom>) => updateAppearance({ palette: 'custom', custom: { ...custom, ...change } });

  return (
    <main className="content appearance">
      <header className="page-head">
        <div>
          <h1>Darstellung</h1>
          <p>Farbwelt, Helligkeit und Stil. Änderungen wirken sofort.</p>
        </div>
        <button type="button" className="ghost" onClick={() => setAppearance({ ...DEFAULT_APPEARANCE })}>
          <Icon name="refresh" size={16} />
          Zurücksetzen
        </button>
      </header>

      <section className="settings-section" aria-labelledby="palette-title">
        <h2 id="palette-title">Farbwelt</h2>
        <div className="palette-grid" role="radiogroup" aria-labelledby="palette-title" onKeyDown={radioKeys}>
          {paletteIds.map((id) => (
            <PaletteCard
              key={id}
              id={id}
              scheme={scheme}
              selected={appearance.palette === id}
              onSelect={() => updateAppearance({ palette: id })}
            />
          ))}
          <PaletteCard id="custom" scheme={scheme} custom={custom} selected={appearance.palette === 'custom'} onSelect={() => setCustom({})} />
        </div>
      </section>

      {appearance.palette === 'custom' && (
        <section className="settings-section card" aria-labelledby="custom-title">
          <h2 id="custom-title">
            <Icon name="customColor" size={18} />
            Eigene Farben
          </h2>
          <div className="color-pickers">
            <ColorField label="Akzent" value={custom.accent} onChange={(accent) => setCustom({ accent })} />
            <ColorField label="Verlaufsende" value={custom.accent2} onChange={(accent2) => setCustom({ accent2 })} />
          </div>
          {colors.adjusted && (
            <p className="banner banner-info adjusted-note" role="status">
              <Icon name="info" size={18} />
              Deine Farben wurden leicht angepasst, damit sie auf dem Hintergrund sichtbar und Beschriftungen lesbar bleiben.
            </p>
          )}
          <p className="hint">
            Schrift auf der Akzentfarbe: {colors.accentText === '#ffffff' ? 'weiß' : 'dunkel'} (Kontrast{' '}
            <span className="num">{contrast(colors.accentText, colors.accent).toFixed(1).replace('.', ',')}</span> : 1). Sie
            wechselt von selbst, damit Beschriftungen lesbar bleiben.
          </p>
        </section>
      )}

      <section className="settings-section" aria-labelledby="mode-title">
        <h2 id="mode-title">Modus</h2>
        <div className="choice-group" role="radiogroup" aria-labelledby="mode-title" onKeyDown={radioKeys}>
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={appearance.mode === mode}
              tabIndex={appearance.mode === mode ? 0 : -1}
              className="choice"
              onClick={() => updateAppearance({ mode })}
            >
              <Icon name={modeIcon[mode]} size={18} />
              {modeName[mode]}
            </button>
          ))}
        </div>
        <p className="hint">„Schwarz“ ist ein echtes Schwarz für OLED-Bildschirme.</p>
      </section>

      <section className="settings-section" aria-labelledby="style-title">
        <h2 id="style-title">Stil</h2>
        <div className="style-grid" role="radiogroup" aria-labelledby="style-title" onKeyDown={radioKeys}>
          {STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              role="radio"
              aria-checked={appearance.style === style.id}
              tabIndex={appearance.style === style.id ? 0 : -1}
              className="style-card"
              onClick={() => updateAppearance({ style: style.id })}
            >
              <span className="style-icon" aria-hidden="true">
                <Icon name={style.icon} size={20} />
              </span>
              <span>
                <strong>{style.name}</strong>
                <span className="muted">{style.text}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

/** A preset as a card with a small live preview (ground, a switched-on and a switched-off tile) in the current mode. */
function PaletteCard({
  id,
  scheme,
  custom,
  selected,
  onSelect,
}: {
  id: PaletteId | 'custom';
  scheme: Scheme;
  custom?: { accent: string; accent2: string };
  selected: boolean;
  onSelect: () => void;
}) {
  const c = deriveColors(id, scheme, custom);
  const name = id === 'custom' ? 'Eigene Farben' : palettes[id].name;
  const preview = {
    '--p-bg': c.bg,
    '--p-surface': c.surface,
    '--p-surface-2': c.surface2,
    '--p-accent-2': c.accent2,
    '--p-text': c.text,
    '--p-muted': c.muted,
    '--p-accent': c.accent,
    '--p-accent-text': c.accentText,
    '--p-on-soft': c.onSoft,
    '--p-on': c.on,
    '--p-gradient': `linear-gradient(135deg, ${c.accent}, ${c.accent2})`,
  } as CSSProperties;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      className="palette-card"
      onClick={onSelect}
      style={preview}
    >
      {/* a miniature of the start page in this colour world: greeting, room chips, a lit and a dark tile, a wide one */}
      <span className="palette-preview" aria-hidden="true">
        <span className="palette-greeting" />
        <span className="palette-chips">
          <span className="palette-chip palette-chip-on" />
          <span className="palette-chip" />
          <span className="palette-chip" />
        </span>
        <span className="palette-tiles">
          <span className="palette-tile palette-tile-on">
            <Icon name="light" size={14} />
            <span className="palette-line" />
          </span>
          <span className="palette-tile">
            <Icon name={id === 'custom' ? 'customColor' : 'plug'} size={14} />
            <span className="palette-line" />
          </span>
          <span className="palette-tile palette-tile-wide">
            <Icon name="climate" size={14} />
            <span className="palette-temp">21°</span>
            <span className="palette-range" />
          </span>
        </span>
      </span>
      <span className="palette-name">
        <span className="palette-swatch" aria-hidden="true" />
        {name}
        {selected && <Icon name="check" size={18} />}
      </span>
    </button>
  );
}

/** Colour picker with a hex field; typing waits for a complete value. */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const picker = useRef<HTMLDivElement>(null);
  // react-colorful names its two sliders "Color" and "Hue"; give them German names with the field's label
  useEffect(() => {
    const [area, hue] = picker.current?.querySelectorAll('[role="slider"]') ?? [];
    area?.setAttribute('aria-label', `${label}: Sättigung und Helligkeit`);
    hue?.setAttribute('aria-label', `${label}: Farbton`);
  });
  return (
    <div className="color-field">
      <label htmlFor={id}>{label}</label>
      <div ref={picker} role="group" aria-label={label}>
        <HexColorPicker color={value} onChange={onChange} />
      </div>
      <div className="color-input">
        <span className="color-swatch" style={{ background: value }} aria-hidden="true" />
        <HexColorInput id={id} color={value} onChange={onChange} prefixed aria-label={`${label} als Hex-Wert`} />
      </div>
    </div>
  );
}
