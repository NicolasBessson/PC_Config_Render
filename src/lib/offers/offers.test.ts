import { describe, expect, it } from "vitest";
import { isFresh, offers, offersFor, offerSchema, type Offer } from "./index";

const offer = (overrides: Partial<Offer>): Offer => ({
  componentId: "rtx-5070", retailerId: "a", retailerName: "Revendeur A", price: 550, currency: "CHF",
  url: "https://example.com/rtx-5070", checkedAt: "2026-11-10", inStock: null, affiliate: false, ...overrides,
});

describe("offres vendeurs", () => {
  it("aucune offre n'est livrée tant qu'aucun prix n'a été relevé", () => {
    expect(offers).toEqual([]);
    expect(offersFor("rtx-5070")).toEqual([]);
  });

  it("classe par prix, sans tenir compte de l'affiliation", () => {
    const list = [offer({ retailerId: "cher-affilie", price: 600, affiliate: true }), offer({ retailerId: "moins-cher", price: 540 }), offer({ componentId: "autre" })];
    expect(offersFor("rtx-5070", list).map((o) => o.retailerId)).toEqual(["moins-cher", "cher-affilie"]);
  });

  it("un prix ancien n'est pas présenté comme actuel", () => {
    expect(isFresh(offer({ checkedAt: "2026-11-10" }), new Date("2026-11-16"))).toBe(true);
    expect(isFresh(offer({ checkedAt: "2026-10-01" }), new Date("2026-11-16"))).toBe(false);
    expect(isFresh(offer({ checkedAt: "2026-12-01" }), new Date("2026-11-16"))).toBe(false); // date future : invalide
  });

  it("refuse une offre sans date ou sans lien valide", () => {
    expect(offerSchema.safeParse(offer({ checkedAt: "hier" })).success).toBe(false);
    expect(offerSchema.safeParse(offer({ url: "pas-une-url" })).success).toBe(false);
  });
});
