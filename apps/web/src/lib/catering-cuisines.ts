/** Top catering / food-truck cuisine options shown in RFQ cuisine picker. */
export const CATERING_CUISINE_OPTIONS = [
  "American",
  "BBQ / Barbecue",
  "Burgers",
  "Tacos / Mexican",
  "Tex-Mex",
  "Latin American",
  "Cuban",
  "Caribbean",
  "Jamaican",
  "Peruvian",
  "Brazilian",
  "Colombian",
  "Argentinian",
  "Italian",
  "Pizza",
  "Mediterranean",
  "Greek",
  "Spanish / Tapas",
  "Middle Eastern",
  "Lebanese",
  "Turkish",
  "Indian",
  "Pakistani",
  "Thai",
  "Vietnamese",
  "Chinese",
  "Japanese",
  "Korean",
  "Filipino",
  "Hawaiian / Poke",
  "Sushi",
  "Ramen / Noodles",
  "Seafood",
  "Cajun / Creole",
  "Southern / Soul Food",
  "Comfort Food",
  "Sandwiches / Deli",
  "Hot Dogs / Street Food",
  "Wings",
  "Fried Chicken",
  "Breakfast / Brunch",
  "Vegan",
  "Vegetarian",
  "Plant-Based",
  "Gluten-Free Friendly",
  "Farm-to-Table",
  "Fusion",
  "Desserts / Sweets",
  "Coffee / Beverages",
  "Vendor recommendation",
] as const;

export type CateringCuisineOption = (typeof CATERING_CUISINE_OPTIONS)[number];

export function parseCuisinesText(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatCuisinesText(selected: string[]): string {
  return selected.join(", ");
}

export function filterCateringCuisines(query: string): CateringCuisineOption[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [...CATERING_CUISINE_OPTIONS];
  }

  return CATERING_CUISINE_OPTIONS.filter((option) => option.toLowerCase().includes(normalized));
}
