import {
  BookOpen,
  Braces,
  ChartColumn,
  CircleUserRound,
  Earth,
  Folder,
  LayoutTemplate,
  MapPin,
  Package,
  PersonStanding,
  Play,
  Smile,
  ToggleRight,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * The one icon each world element type wears on every surface. Import from here, never from `lucide-react`.
 * Data tables read `ELEMENT_ICONS`; JSX reads the component aliases below.
 * `entities` is for a tab or heading that lists many entities; a single entity uses `entity`.
 */
export const ELEMENT_ICONS = {
  trait: ToggleRight,
  entity: User,
  entities: Users,
  item: Package,
  location: MapPin,
  stat: ChartColumn,
  dictionary: BookOpen,
  placeholder: Braces,
  blueprint: LayoutTemplate,
  persona: CircleUserRound,
  avatar: PersonStanding,
  mascot: Smile,
  opening: Play,
  world: Earth,
  group: Folder,
} as const satisfies Record<string, LucideIcon>;

/** The same icons as JSX components, for a call site that renders one directly. */
export const {
  trait: TraitIcon,
  entity: EntityIcon,
  entities: EntitiesIcon,
  item: ItemIcon,
  location: LocationIcon,
  stat: StatIcon,
  dictionary: DictionaryIcon,
  placeholder: PlaceholderIcon,
  blueprint: BlueprintIcon,
  persona: PersonaIcon,
  avatar: AvatarIcon,
  mascot: MascotIcon,
  opening: OpeningIcon,
  world: WorldIcon,
  group: GroupIcon,
} = ELEMENT_ICONS;
