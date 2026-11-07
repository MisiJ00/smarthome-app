import { useState } from 'react';
import clsx from 'clsx';
import { motion, MotionConfig } from 'motion/react';

import type { Device } from '@smarthome/api-client';
import { arrangeDevices, deviceKey, greeting, groupByRoom, homeFacts, homeSummary, powerSummary, pruneLayout, setGrouping, tileSize, withFullOrder, type DashboardLayout, type HomeFacts, type RoomGroup } from '@smarthome/core';

import { useDevices, useMe, useRooms } from '../api';
import { Confirmations } from '../components/Confirmations';
import { DeviceCard } from '../components/DeviceCard';
import { Icon } from '../components/Icon';
import { DetailSheet } from '../dashboard/DetailSheet';
import { DeviceTile } from '../dashboard/DeviceTile';
import { EditBar } from '../dashboard/EditBar';
import { EditBoard } from '../dashboard/EditBoard';
import { useDashboardLayout } from '../dashboard/useDashboardLayout';
import '../devices.css';
import '../dashboard/dashboard.css';

/** Filter value of the devices without room (rooms have numeric ids). */
const NO_ROOM = 'none';

/**
 * The dashboard: devices as tiles in the user's order and sizes (docs/DESIGN-V2.md, 2–4), filterable by room, with
 * live state. "Anpassen" switches to the edit mode; "Fertig" saves the layout for this user in this browser.
 */
export function HomePage() {
  const me = useMe();
  const rooms = useRooms();
  const devices = useDevices();
  const roomList = rooms.data ?? [];
  const deviceList = devices.data ?? [];
  const { layout, save } = useDashboardLayout(me.data?.id);
  /** The layout being edited; null outside the edit mode. */
  const [draft, setDraft] = useState<DashboardLayout | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const loading = rooms.isPending || devices.isPending;
  const failed = rooms.isError || devices.isError;
  const hidden = new Set(layout.hidden);
  const visible = deviceList.filter((d) => !hidden.has(deviceKey(d)));
  // Chips and the summary go by room, whatever the grouping
  const roomGroups = groupByRoom(roomList, visible);
  const keyOf = (group: RoomGroup) => (group.room?.id !== undefined ? String(group.room.id) : NO_ROOM);
  const known = new Set(roomList.map((r) => r.id));
  const roomKeyOf = (d: Device) => (d.roomId != null && known.has(d.roomId) ? String(d.roomId) : NO_ROOM);
  // A room that has gone (or lost its devices) shows everything again
  const selected = roomGroups.some((g) => keyOf(g) === filter) ? filter : null;
  const filtered = selected === null ? deviceList : deviceList.filter((d) => roomKeyOf(d) === selected);
  const groups = arrangeDevices(filtered, layout, roomList);
  const details = deviceList.find((d) => deviceKey(d) === detailsId);
  const editing = draft !== null;

  const startEditing = () => {
    setFilter(null);
    // with all devices in the order, moving works with plain indexes
    setDraft(withFullOrder(layout, deviceList, roomList));
  };
  const finishEditing = () => {
    if (draft) {
      // ids of devices that are gone do not need to stay in the stored layout
      save(pruneLayout(draft, deviceList.map(deviceKey)));
    }
    setDraft(null);
  };

  return (
    <MotionConfig reducedMotion="user">
      <main className={clsx('content', 'dashboard', editing && 'dashboard-editing')}>
        <header className="home-head">
          <div className="page-head">
            <div className="home-greeting">
              <h1>{greeting(me.data?.name)}</h1>
              {!loading && !failed && homeSummary(roomGroups) && <SummaryFacts facts={homeFacts(roomGroups)} />}
            </div>
            {!editing && !loading && deviceList.length > 0 && (
              <button type="button" className="ghost dash-customize" onClick={startEditing}>
                <Icon name="edit" size={16} />
                Anpassen
              </button>
            )}
          </div>
          {!editing && roomGroups.length > 1 && (
            <nav className="room-chips" aria-label="Räume">
              <button type="button" className="chip room-chip" aria-pressed={selected === null} onClick={() => setFilter(null)}>
                {selected === null && <ChipMarker />}
                <span className="room-chip-label">Alle</span>
              </button>
              {roomGroups.map((group) => (
                <button
                  key={keyOf(group)}
                  type="button"
                  className="chip room-chip"
                  aria-pressed={selected === keyOf(group)}
                  onClick={() => setFilter(keyOf(group))}
                >
                  {selected === keyOf(group) && <ChipMarker />}
                  <span className="room-chip-label">{group.room?.name ?? 'Ohne Raum'}</span>
                  <span className="room-chip-count">{group.devices.length}</span>
                </button>
              ))}
            </nav>
          )}
        </header>

        {editing ? (
          <>
            <EditBar grouping={draft.grouping} onGrouping={(g) => setDraft(setGrouping(draft, g))} onDone={finishEditing} />
            <EditBoard devices={deviceList} rooms={roomList} layout={draft} onChange={setDraft} />
          </>
        ) : (
          <>
            <Confirmations />
            {loading && <SkeletonTiles />}
            {failed && (
              <p className="home-error" role="alert">
                <Icon name="warning" size={18} />
                Die Geräte konnten nicht geladen werden.
              </p>
            )}
            {!loading && !failed && deviceList.length === 0 && (
              <div className="home-empty">
                <span className="home-empty-icon">
                  <Icon name="home" size={30} />
                </span>
                <h2>Noch keine Geräte</h2>
                <p className="muted">Sobald ein Admin Geräte übernommen und dir Rechte gegeben hat, erscheinen sie hier.</p>
              </div>
            )}
            {!loading && !failed && deviceList.length > 0 && groups.length === 0 && (
              <div className="home-empty">
                <span className="home-empty-icon">
                  <Icon name="empty" size={30} />
                </span>
                <h2>Alles ausgeblendet</h2>
                <p className="muted">Unter „Anpassen“ kannst du Geräte wieder einblenden.</p>
              </div>
            )}
            {groups.map((group) => (
              <section key={group.room?.id ?? 'none'} className="room">
                {layout.grouping === 'rooms' && (
                  <h2>
                    {group.room?.name ?? 'Ohne Raum'}
                    <span className="muted">{group.devices.length}</span>
                  </h2>
                )}
                <div className="dash-grid">
                  {group.devices.map((device) => {
                    const size = tileSize(layout, device);
                    const open = () => setDetailsId(deviceKey(device));
                    return size === 'l' ? (
                      <div key={device.id} className="tile-l">
                        <DeviceCard device={device} />
                      </div>
                    ) : (
                      <DeviceTile key={device.id} device={device} size={size} onDetails={open} />
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
        <DetailSheet device={details} onClose={() => setDetailsId(null)} />
      </main>
    </MotionConfig>
  );
}

/** The summary ("2 Geräte an · 20,8 °C Wohnzimmer") as separate facts with an icon each. */
function SummaryFacts({ facts }: { facts: HomeFacts }) {
  return (
    <ul className="home-facts">
      {facts.switchable > 0 && (
        <li className={clsx(facts.onCount > 0 && 'home-fact-on')}>
          <Icon name="power" size={15} />
          {powerSummary(facts.onCount)}
        </li>
      )}
      {facts.temperature && (
        <li>
          <Icon name="temperature" size={15} />
          {facts.temperature.room ? `${facts.temperature.value} ${facts.temperature.room}` : facts.temperature.value}
        </li>
      )}
    </ul>
  );
}

/** The highlight behind the selected room chip; slides to the next chip (shared layout animation). */
function ChipMarker() {
  return <motion.span layoutId="room-chip-marker" className="room-chip-marker" transition={{ type: 'spring', stiffness: 520, damping: 38 }} aria-hidden />;
}

/** Placeholder tiles while rooms and devices load. */
function SkeletonTiles() {
  return (
    <section className="room" aria-busy="true" aria-label="Lade Geräte …">
      <div className="skeleton skeleton-line" style={{ width: 140, height: 18 }} />
      <div className="dash-grid">
        {['s', 's', 'm', 's', 'm'].map((size, i) => (
          <div key={i} className={`tile tile-${size} tile-skeleton`} aria-hidden>
            <div className="skeleton skeleton-circle" style={{ width: 44, height: 44 }} />
            <div className="skeleton skeleton-line" style={{ width: '70%' }} />
            <div className="skeleton skeleton-line" style={{ width: '40%' }} />
          </div>
        ))}
      </div>
    </section>
  );
}
