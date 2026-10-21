import { groupByRoom } from '@smarthome/core';

import { useDevices, useRooms } from '../api';
import { Confirmations } from '../components/Confirmations';
import { DeviceCard } from '../components/DeviceCard';

/** Devices by room, switchable, with live state. */
export function HomePage() {
  const rooms = useRooms();
  const devices = useDevices();
  const groups = groupByRoom(rooms.data ?? [], devices.data ?? []);
  const loading = rooms.isPending || devices.isPending;
  const failed = rooms.isError || devices.isError;

  return (
    <main className="content">
      <Confirmations />
      {loading && <p className="muted">Lade Geräte …</p>}
      {failed && <p className="form-errors">Die Geräte konnten nicht geladen werden.</p>}
      {!loading && !failed && groups.length === 0 && (
        <div className="empty">
          <h2>Noch keine Geräte</h2>
          <p className="muted">Sobald ein Admin Geräte übernommen und dir Rechte gegeben hat, erscheinen sie hier.</p>
        </div>
      )}
      {groups.map((group) => (
        <section key={group.room?.id ?? 'none'} className="room">
          <h2>{group.room?.name ?? 'Ohne Raum'}</h2>
          <div className="grid">
            {group.devices.map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
