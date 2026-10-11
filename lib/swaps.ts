import { CATEGORY_LABELS } from './bubble';

/**
 * Swap table. For a purchase in `from`, the alternative is bought in category `to` at
 * `amountMultiplier` of the original spend. Emissions are spend-based, so a swap saves carbon
 * through the target category's factor and/or the lower spend. EPA publishes one factor for all
 * ground passenger transport, so taxi -> transit saves through the fare, not the factor.
 */
export type Swap = {
  id: string;
  from: string;
  label: string;
  to: string;
  amountMultiplier: number;
  note: string;
};

export const SWAPS: Swap[] = [
  { id: 'bus', from: 'rideshare_taxi', label: 'Take the bus', to: 'public_transit', amountMultiplier: 0.2, note: 'A typical bus fare is about a fifth of a ride' },
  { id: 'carpool-bus', from: 'gasoline', label: 'Bus one trip a week', to: 'public_transit', amountMultiplier: 0.25, note: 'Replaces a quarter of a tank with fares' },
  { id: 'cook', from: 'restaurants', label: 'Cook at home', to: 'groceries', amountMultiplier: 0.35, note: 'Groceries for the same meal cost about a third' },
  { id: 'refurb', from: 'electronics', label: 'Buy refurbished', to: 'electronics', amountMultiplier: 0.65, note: 'Refurbished typically costs about 65% of new (assumed)' },
  { id: 'thrift', from: 'apparel', label: 'Thrift it', to: 'apparel', amountMultiplier: 0.4, note: 'Secondhand typically costs about 40% of new (assumed)' },
  { id: 'train', from: 'travel_air', label: 'Take the train or bus', to: 'public_transit', amountMultiplier: 0.4, note: 'Ground travel for the same trip, assumed 40% of the fare' },
  { id: 'family-plan', from: 'subscriptions_digital', label: 'Share a family plan', to: 'subscriptions_digital', amountMultiplier: 0.5, note: 'Split a plan with a friend (assumed)' },
];

export const swapsFor = (category: string) => SWAPS.filter((s) => s.from === category);
export const swapById = (id: string) => SWAPS.find((s) => s.id === id);
export const swapTargetLabel = (s: Swap) => CATEGORY_LABELS[s.to] ?? s.to;
