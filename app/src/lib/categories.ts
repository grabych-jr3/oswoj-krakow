import {
  Baby,
  BookOpen,
  Building2,
  BusFront,
  Drama,
  Dumbbell,
  GraduationCap,
  HeartHandshake,
  Landmark,
  School,
  SquareParking,
  Sprout,
  ToyBrick,
  TreePine,
  Users,
  Blocks,
  type LucideIcon,
} from "lucide-react";
import type { PlaceCategory } from "@/contracts/place";

export type CategoryStyle = {
  /** Marker / chip background as hex (MapLibre paint does not accept oklch); every value keeps ≥ 4.5:1 contrast with a white icon. */
  color: string;
  icon: LucideIcon;
};

/** One colour + icon per map category (labels live in messages/*.json → "Categories"). */
export const CATEGORY_STYLES: Record<PlaceCategory, CategoryStyle> = {
  zlobek: { color: "#ab3276", icon: Baby },
  klub_dzieciecy: { color: "#8a3d9a", icon: ToyBrick },
  przedszkole: { color: "#af4000", icon: Blocks },
  szkola_podstawowa: { color: "#2559b0", icon: School },
  szkola_ponadpodstawowa: { color: "#483a9a", icon: GraduationCap },
  klub_rodzica: { color: "#6b46a0", icon: Users },
  biblioteka: { color: "#006d78", icon: BookOpen },
  park: { color: "#207029", icon: TreePine },
  park_kieszonkowy: { color: "#546e0d", icon: Sprout },
  przystanek: { color: "#414f5d", icon: BusFront },
  park_and_ride: { color: "#0c6383", icon: SquareParking },
  urzad: { color: "#c90f1a", icon: Landmark },
  centrum_seniora: { color: "#815200", icon: HeartHandshake },
  obiekt_sportowy: { color: "#006f57", icon: Dumbbell },
  muzeum: { color: "#6f4928", icon: Building2 },
  teatr: { color: "#921f3f", icon: Drama },
};
