import * as Dialog from '@radix-ui/react-dialog';

import type { Device } from '@smarthome/api-client';

import { DeviceCard } from '../components/DeviceCard';
import { Icon } from '../components/Icon';

/**
 * All controls of one device (the full DeviceCard) in a Radix dialog: centred on wide screens, a bottom sheet on
 * narrow ones (dashboard.css). `device` undefined: closed. The caller passes the live device, so it stays current.
 */
export function DetailSheet({ device, onClose }: { device: Device | undefined; onClose: () => void }) {
  return (
    <Dialog.Root open={device !== undefined} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay sheet-overlay" />
        <Dialog.Content className="sheet">
          <span className="sheet-grip" aria-hidden />
          <Dialog.Title className="sr-only">{device ? `${device.name}: Optionen` : 'Optionen'}</Dialog.Title>
          <Dialog.Description className="sr-only">Alle Einstellungen dieses Geräts</Dialog.Description>
          <Dialog.Close asChild>
            <button type="button" className="ghost icon-button sheet-close" aria-label="Schließen">
              <Icon name="close" size={18} />
            </button>
          </Dialog.Close>
          {device && <DeviceCard device={device} variant="sheet" />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
