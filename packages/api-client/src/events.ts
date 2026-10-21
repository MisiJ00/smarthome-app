// Messages of /api/events (WebSocket). Not part of the OpenAPI description, so typed by hand;
// see homeserver-infra/docs/smarthome-backend.md, "Live-Updates".
import type { components } from './schema';

type Schemas = components['schemas'];

export interface Envelope<T extends string, D> {
  type: T;
  /** ISO-8601 */
  ts: string;
  data: D;
}

export interface DeviceState {
  deviceId: number;
  state: Record<string, unknown>;
  lastSeen: string | null;
}

export interface Pairing {
  adapter: string;
  active: boolean;
  endsAt: string | null;
}

/** Payload of each event type. */
export interface LiveEventData {
  hello: { userId: number; name: string; reconnectBefore: string; hint: string };
  'device.state': DeviceState;
  'device.added': Schemas['DeviceResponse'];
  'device.updated': Schemas['DeviceResponse'];
  'device.removed': { deviceId: number };
  'device.discovered': Record<string, unknown>;
  'room.created': Schemas['RoomResponse'];
  'room.updated': Schemas['RoomResponse'];
  'room.deleted': { roomId: number };
  'rooms.reordered': { roomIds: number[] };
  'confirmation.created': Schemas['ConfirmationResponse'];
  'confirmation.approved': Schemas['ConfirmationResponse'];
  'confirmation.rejected': Schemas['ConfirmationResponse'];
  'confirmation.expired': Schemas['ConfirmationResponse'];
  'permissions.changed': Record<string, never>;
  'pairing.started': Pairing;
  'pairing.stopped': Pairing;
  pong: Record<string, never>;
  error: { message: string };
}

export type LiveEvent = { [T in keyof LiveEventData]: Envelope<T, LiveEventData[T]> }[keyof LiveEventData];

export type LiveEventType = LiveEvent['type'];

/** Close codes of /api/events. */
export const CloseCodes = {
  /** Connection too old: reconnect with a new ticket. */
  Reconnect: 4000,
  /** Machine token revoked. */
  TokenRevoked: 4401,
  /** User deactivated or deleted. */
  AccessEnded: 4403,
} as const;
