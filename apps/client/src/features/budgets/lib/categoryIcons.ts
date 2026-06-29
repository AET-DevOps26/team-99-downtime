import {
  CarIcon,
  CircleDashedIcon,
  ClapperboardIcon,
  HeartPulseIcon,
  LandmarkIcon,
  PlaneIcon,
  PlugIcon,
  ShieldIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  TagIcon,
  UtensilsIcon,
  type LucideIcon,
} from 'lucide-react';

export interface CategoryIconDef {
  Icon: LucideIcon;
  className: string;
}

const ICONS: Record<string, CategoryIconDef> = {
  insurance: { Icon: ShieldIcon, className: 'bg-blue-50 text-blue-600' },
  groceries: { Icon: ShoppingCartIcon, className: 'bg-emerald-50 text-emerald-600' },
  transportation: { Icon: CarIcon, className: 'bg-sky-50 text-sky-600' },
  healthcare: { Icon: HeartPulseIcon, className: 'bg-rose-50 text-rose-600' },
  'dining out': { Icon: UtensilsIcon, className: 'bg-orange-50 text-orange-600' },
  entertainment: { Icon: ClapperboardIcon, className: 'bg-amber-50 text-amber-600' },
  'debt & loans': { Icon: LandmarkIcon, className: 'bg-red-50 text-red-600' },
  utilities: { Icon: PlugIcon, className: 'bg-violet-50 text-violet-600' },
  travel: { Icon: PlaneIcon, className: 'bg-cyan-50 text-cyan-600' },
  uncategorized: { Icon: CircleDashedIcon, className: 'bg-muted text-muted-foreground' },
  shopping: { Icon: ShoppingBagIcon, className: 'bg-fuchsia-50 text-fuchsia-600' },
};

export function iconFor(name: string): CategoryIconDef {
  return (
    ICONS[name.trim().toLowerCase()] ?? {
      Icon: TagIcon,
      className: 'bg-muted text-muted-foreground',
    }
  );
}
