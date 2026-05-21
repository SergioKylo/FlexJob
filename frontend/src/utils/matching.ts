import type { Opportunity, SortMode } from "../types";

export function getMatchScore(item: Opportunity) {
  const payScore = Math.min(item.pay / 14, 1) * 35;
  const distanceScore = Math.max(0, 1 - item.distance / 6) * 35;
  const ratingScore = (item.rating / 5) * 30;
  return Math.round(payScore + distanceScore + ratingScore);
}

export function sortOpportunities(items: Opportunity[], sortMode: SortMode) {
  return [...items].sort((a, b) => {
    if (sortMode === "pay") return b.pay - a.pay;
    if (sortMode === "distance") return a.distance - b.distance;
    if (sortMode === "rating") return b.rating - a.rating;
    return getMatchScore(b) - getMatchScore(a);
  });
}
