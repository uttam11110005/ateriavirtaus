import type { SpecialDiet } from "./types";

export const DIET_LABEL: Record<SpecialDiet, string> = {
  lactoseFree: "Lactose-free",
  glutenFree: "Gluten-free",
  vegetarian: "Vegetarian",
  allergy: "Allergy-specific",
};

export const TYPE_LABEL = { school: "School", daycare: "Day-care" } as const;
