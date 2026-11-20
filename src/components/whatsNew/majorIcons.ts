import {
  Backpack, Brain, CalendarClock, Coins, Drama, Globe, Heart, Hourglass, Image, Map, MessageSquare, Monitor,
  NotebookPen, Palette, Puzzle, Rocket, Route, Search, Shield, Smartphone, Sparkles, Star, Swords, Volume2, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react';
import { ELEMENT_ICONS } from '@/lib/elementIcons';

/** Lucide components by the names `MAJOR_ICONS` holds. Element icons come from their own map. */
export const MAJOR_ICON_COMPONENTS: Readonly<Record<string, LucideIcon>> = {
  Backpack, Brain, CalendarClock, Coins, Drama, Globe, Heart, Hourglass, Image, Map, MessageSquare, Monitor,
  NotebookPen, Palette, Puzzle, Rocket, Route, Search, Shield, Smartphone, Sparkles, Star, Swords, Volume2, Wrench, Zap,
  MapPin: ELEMENT_ICONS.location,
  User: ELEMENT_ICONS.entity,
  Users: ELEMENT_ICONS.entities,
  Package: ELEMENT_ICONS.item,
};

/** The icon a Major tile shows for an unmapped emoji. */
export const DEFAULT_MAJOR_ICON: LucideIcon = Sparkles;

export function majorIconComponent(name: string | null): LucideIcon {
  return (name && MAJOR_ICON_COMPONENTS[name]) || DEFAULT_MAJOR_ICON;
}
