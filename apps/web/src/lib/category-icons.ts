import {
  Megaphone,
  Landmark,
  Laptop2,
  Stethoscope,
  HeartHandshake,
  Cog,
  GraduationCap,
  Truck,
  Users,
  Headset,
  Scale,
  Factory,
  Hotel,
  Sprout,
  HardHat,
  Building2,
  Radio,
  ShoppingBag,
  Home,
  ClipboardList,
  ShieldCheck,
  Bus,
  Zap,
  Wifi,
  Briefcase,
  type LucideIcon,
} from 'lucide-react';

// Keyed by the exact icon key stored on Category.icon — never a raw Lucide
// import name a user could mistype into a broken render. Unknown/legacy keys
// fall back to Briefcase.
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Megaphone,
  Landmark,
  Laptop2,
  Stethoscope,
  HeartHandshake,
  Cog,
  GraduationCap,
  Truck,
  Users,
  Headset,
  Scale,
  Factory,
  Hotel,
  Sprout,
  HardHat,
  Building2,
  Radio,
  ShoppingBag,
  Home,
  ClipboardList,
  ShieldCheck,
  Bus,
  Zap,
  Wifi,
  Briefcase,
};

export function categoryIcon(key: string | null | undefined): LucideIcon {
  return (key && CATEGORY_ICONS[key]) || Briefcase;
}
