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
} from 'lucide-react-native';

import type { IconName } from '@smarthome/theme';

import { useColors } from '../lib/theme';

/**
 * The Lucide component per name in `icons` of @smarthome/theme (the same list as the web's components/Icon.tsx).
 * Listed one by one, so the bundle only carries what is used; a new name in the theme makes the type check ask for it.
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
  /** Edge length in dp (default 20). */
  size?: number;
  /** Default: the text colour of the current light/dark mode. */
  color?: string;
  strokeWidth?: number;
  /** Read out by TalkBack; without it the icon is decoration and hidden from it. */
  label?: string;
}

/** A Lucide icon by its purpose, e.g. `<Icon name="light" color={c.on} />`. */
export function Icon({ name, size = 20, color, strokeWidth = 2, label }: IconProps) {
  const c = useColors();
  const Component = components[name];
  return (
    <Component
      size={size}
      color={color ?? c.text}
      strokeWidth={strokeWidth}
      accessible={label !== undefined}
      accessibilityLabel={label}
      accessibilityRole={label ? 'image' : undefined}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    />
  );
}
