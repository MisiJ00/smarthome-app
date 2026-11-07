import type { Grouping } from '@smarthome/core';

import { Icon } from '../components/Icon';

/** Bar of the edit mode: grouping and "Fertig" (saves). Stays at the top while scrolling (dashboard.css). */
export function EditBar({ grouping, onGrouping, onDone }: { grouping: Grouping; onGrouping: (grouping: Grouping) => void; onDone: () => void }) {
  return (
    <div className="edit-bar" role="toolbar" aria-label="Startseite anpassen">
      <div className="edit-bar-text">
        <strong>Startseite anpassen</strong>
        <span className="muted small">Ziehen zum Sortieren, Größe wählen, Augen-Symbol blendet aus.</span>
      </div>
      <div className="dash-segmented" role="group" aria-label="Anordnung">
        <button type="button" aria-pressed={grouping === 'rooms'} onClick={() => onGrouping('rooms')}>
          <Icon name="room" size={15} />
          Nach Räumen
        </button>
        <button type="button" aria-pressed={grouping === 'custom'} onClick={() => onGrouping('custom')}>
          <Icon name="devices" size={15} />
          Eigene Reihenfolge
        </button>
      </div>
      <button type="button" className="primary" onClick={onDone}>
        <Icon name="check" size={16} />
        Fertig
      </button>
    </div>
  );
}
