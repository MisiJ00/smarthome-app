import { useEffect, useState, type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as Menu from '@radix-ui/react-dropdown-menu';
import clsx from 'clsx';
import { Copy } from 'lucide-react';

import { errorText, lockableActions, secondsUntil } from '@smarthome/core';
import type { IconName } from '@smarthome/theme';

import { Icon } from '../components/Icon';
import '../admin.css';

/** The backend's problem detail, or a general message. */
export { errorText, lockableActions };

export function Panel({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={clsx('panel', 'adm-panel', className)}>
      <header className="panel-head">
        <div className="adm-panel-title">
          <h2>{title}</h2>
          {description && <p className="muted small">{description}</p>}
        </div>
        {actions && <div className="adm-panel-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

/** The "..." button of a table row or panel with its actions (Radix dropdown menu). */
export function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    // Not modal: a dialog opened from the menu must not inherit its pointer lock
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        <button type="button" className="ghost icon-button adm-icon-button" aria-label={label}>
          <Icon name="more" size={18} />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="adm-menu" align="end" sideOffset={4} collisionPadding={8}>
          {children}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function MenuItem({
  icon,
  danger,
  disabled,
  onSelect,
  children,
}: {
  icon?: IconName;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <Menu.Item className={clsx('adm-menu-item', danger && 'adm-menu-item-danger')} disabled={disabled} onSelect={onSelect}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </Menu.Item>
  );
}

export function MenuSeparator() {
  return <Menu.Separator className="adm-menu-separator" />;
}

/** A form (or anything else) in a Radix dialog, styled like the other dialogs (.dialog); open state belongs to the caller. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content className="dialog adm-dialog">
          <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close asChild>
            <button type="button" className="ghost icon-button dialog-close" aria-label="Schließen">
              <Icon name="close" size={18} />
            </button>
          </DialogPrimitive.Close>
          {description ? (
            <DialogPrimitive.Description>{description}</DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="adm-visually-hidden">{title}</DialogPrimitive.Description>
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Coloured state label: ok (green), warn (orange), error (red), or neutral. */
export function StatusBadge({ tone, icon, children }: { tone?: 'ok' | 'warn' | 'error' | 'accent'; icon?: IconName; children: ReactNode }) {
  return (
    <span className={clsx('badge', tone && `badge-${tone}`)}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

/** Shown instead of a table when there is nothing in it. */
export function EmptyState({ icon = 'empty', children }: { icon?: IconName; children: ReactNode }) {
  return (
    <div className="adm-empty">
      <Icon name={icon} size={22} />
      <span>{children}</span>
    </div>
  );
}

/** Placeholder rows while a list loads. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="adm-skeleton" aria-busy="true" aria-label="Lade …">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton adm-skeleton-row" />
      ))}
    </div>
  );
}

/** A value with a copy button, e.g. the setup code. */
export function Copyable({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="copyable adm-copyable">
      <span className="muted">{label}</span>
      <code>{value}</code>
      <button type="button" className="ghost" onClick={copy}>
        {copied ? <Icon name="check" size={16} /> : <Copy size={16} aria-hidden />}
        {copied ? 'Kopiert' : 'Kopieren'}
      </button>
    </div>
  );
}

/** Seconds left until a point in time, updated every second. */
export function useSecondsLeft(until: string | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return secondsUntil(until, now);
}

export { formatTime, roleLabel, ROLE_LABELS } from '@smarthome/core';
