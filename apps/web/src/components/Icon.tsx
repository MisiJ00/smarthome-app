import {
  Activity,
  Battery,
  Blinds,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Cpu,
  DoorOpen,
  Droplets,
  Ellipsis,
  Eye,
  EyeOff,
  Feather,
  Flame,
  Gauge,
  Heater,
  House,
  Inbox,
  Info,
  KeyRound,
  LayoutGrid,
  Lightbulb,
  Lock,
  LockOpen,
  LogOut,
  Minus,
  Monitor,
  Moon,
  MoonStar,
  Palette,
  Pencil,
  Pipette,
  Plug,
  Plus,
  Power,
  Radar,
  Radio,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Snowflake,
  Sparkles,
  Sun,
  Thermometer,
  ToggleRight,
  Trash2,
  TriangleAlert,
  User,
  Users,
  WifiOff,
  Wind,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import type { IconName } from '@smarthome/theme';

/**
 * The Lucide component per name in `icons` of @smarthome/theme. Listed one by one (not the whole icon set), so the
 * bundle only carries what is used; a new name in the theme makes the type check ask for an entry here.
 */
const components: Record<IconName, LucideIcon> = {
  light: Lightbulb,
  plug: Plug,
  switch: ToggleRight,
  lock: Lock,
  unlock: LockOpen,
  sensor: Thermometer,
  cover: Blinds,
  climate: Heater,
  device: Cpu,
  room: House,
  approval: ShieldCheck,
  phone: Smartphone,
  settings: Settings,
  admin: Users,
  logout: LogOut,
  live: Radio,
  temperature: Thermometer,
  humidity: Droplets,
  battery: Battery,
  brightness: Sun,
  power: Power,
  energy: Zap,
  motion: Activity,
  contact: DoorOpen,
  heat: Flame,
  cool: Snowflake,
  auto: Gauge,
  fan: Wind,
  plus: Plus,
  minus: Minus,
  home: House,
  devices: LayoutGrid,
  account: User,
  rights: KeyRound,
  audit: ScrollText,
  more: Ellipsis,
  next: ChevronRight,
  add: Plus,
  edit: Pencil,
  delete: Trash2,
  refresh: RefreshCw,
  search: Search,
  check: Check,
  close: X,
  info: Info,
  warning: TriangleAlert,
  empty: Inbox,
  clock: Clock,
  offline: WifiOff,
  themeLight: Sun,
  themeDark: Moon,
  themeSystem: Monitor,
  themeBlack: MoonStar,
  appearance: Palette,
  vivid: Sparkles,
  calm: Feather,
  customColor: Pipette,
  eye: Eye,
  eyeOff: EyeOff,
  up: ChevronUp,
  down: ChevronDown,
  pairing: Radar,
  found: Sparkles,
};

export interface IconProps {
  name: IconName;
  /** Edge length in px (default 20). */
  size?: number;
  className?: string;
  /** Read out instead of being hidden from screen readers; without it the icon is decoration. */
  label?: string;
  strokeWidth?: number;
}

/** A Lucide icon by its purpose, e.g. `<Icon name="light" />`. Takes the colour of the surrounding text. */
export function Icon({ name, size = 20, className, label, strokeWidth = 2 }: IconProps) {
  const Component = components[name];
  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      className={className ? `icon ${className}` : 'icon'}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    />
  );
}
