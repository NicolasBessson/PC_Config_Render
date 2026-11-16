import { z } from "zod";
import offersJson from "../../../data/offers.json";

/*
 * Offres commerciales (roadmap V2, tâche 6.1). La structure est prête ; le
 * fichier data/offers.json est vide tant qu'aucun prix n'a été relevé.
 * Une offre n'est jamais affichée sans sa date de relevé.
 */
export const offerSchema = z.object({
  componentId: z.string(),
  retailerId: z.string(),
  retailerName: z.string(),
  price: z.number().positive(),
  currency: z.enum(["CHF", "EUR"]),
  url: z.string().url(),
  /** Date du relevé (ISO, AAAA-MM-JJ). */
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** `null` = disponibilité inconnue. */
  inStock: z.boolean().nullable(),
  /** Lien affilié : à signaler clairement à l'utilisateur. */
  affiliate: z.boolean(),
});
export type Offer = z.infer<typeof offerSchema>;

export const offers: Offer[] = z.array(offerSchema).parse(offersJson);

/** Au-delà de ce délai, un prix n'est plus présenté comme actuel. */
export const OFFER_MAX_AGE_DAYS = 14;

export function isFresh(offer: Offer, today: Date): boolean {
  const age = (today.getTime() - new Date(offer.checkedAt).getTime()) / 86_400_000;
  return age >= 0 && age <= OFFER_MAX_AGE_DAYS;
}

/**
 * Offres connues d'un composant, de la moins chère à la plus chère. Le
 * classement ne dépend que du prix : jamais de la rémunération d'affiliation.
 */
export function offersFor(componentId: string, list: Offer[] = offers): Offer[] {
  return list.filter((offer) => offer.componentId === componentId).sort((a, b) => a.price - b.price || a.retailerId.localeCompare(b.retailerId));
}
