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
  /** Marker / chip background; every value keeps ≥ 4.5:1 contrast with a white icon. */
  color: string;
  icon: LucideIcon;
};

/** One colour + icon per map category (labels live in messages/*.json → "Categories"). */
export const CATEGORY_STYLES: Record<PlaceCategory, CategoryStyle> = {
  zlobek: { color: "oklch(0.52 0.17 350)", icon: Baby },
  klub_dzieciecy: { color: "oklch(0.5 0.16 320)", icon: ToyBrick },
  przedszkole: { color: "oklch(0.52 0.16 45)", icon: Blocks },
  szkola_podstawowa: { color: "oklch(0.48 0.15 260)", icon: School },
  szkola_ponadpodstawowa: { color: "oklch(0.42 0.15 285)", icon: GraduationCap },
  klub_rodzica: { color: "oklch(0.48 0.14 300)", icon: Users },
  biblioteka: { color: "oklch(0.48 0.1 205)", icon: BookOpen },
  park: { color: "oklch(0.48 0.13 145)", icon: TreePine },
  park_kieszonkowy: { color: "oklch(0.5 0.12 125)", icon: Sprout },
  przystanek: { color: "oklch(0.42 0.03 250)", icon: BusFront },
  park_and_ride: { color: "oklch(0.47 0.09 230)", icon: SquareParking },
  urzad: { color: "oklch(0.53 0.21 27)", icon: Landmark },
  centrum_seniora: { color: "oklch(0.48 0.11 75)", icon: HeartHandshake },
  obiekt_sportowy: { color: "oklch(0.47 0.12 175)", icon: Dumbbell },
  muzeum: { color: "oklch(0.44 0.07 60)", icon: Building2 },
  teatr: { color: "oklch(0.44 0.15 10)", icon: Drama },
};
