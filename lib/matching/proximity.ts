/**
 * Proximity + fusion helpers (T3 stage 2) -- the TypeScript mirror of the SQL in
 * `0008_matching_rpc.sql`. Scoring runs in Postgres (no round-trips in the hot
 * path); these pure functions keep the exact same constants and math available
 * TS-side for tests, an offline re-score, or a "why this match" explanation.
 *
 * Proximity is a BOUNDED MULTIPLICATIVE BOOST, never a filter (spec C8): the
 * composite is `fit * (1 + LAMBDA * proximity)`, and proximity itself is capped,
 * so it only re-orders near-ties -- it can never gate a candidate out.
 */

/** Boost weight on proximity in the composite score (`score = fit*(1+λ*prox)`). */
export const LAMBDA = 0.15;
/** Weight on the network-closeness term inside proximity. */
export const BETA = 0.3;
/** Reciprocal Rank Fusion constant for the real (vector / FTS) arms. */
export const RRF_K = 60;
/** RRF constant for the recency fallback arm -- large, so it only breaks ties. */
export const RRF_K_RECENCY = 1000;
/** Great-circle decay length scale (km). */
export const GEO_SCALE_KM = 300;
/** Upper bound on proximity, so the boost stays bounded (max ≈ 1 + λ*cap). */
export const PROXIMITY_CAP = 1.3;

/** Discrete proximity tiers (highest wins); mirrors `proximity_tier` in SQL. */
export const TIER = {
  sameFacility: 1.0,
  sameInstitution: 0.8,
  sameCity: 0.5,
} as const;

/** The fields a proximity comparison needs from a profile / submitter. */
export interface Anchor {
  facilityId: string | null;
  institutionId: string | null;
  city: string | null;
  lat: number | null;
  long: number | null;
}

/** Great-circle distance (km) between two lat/long points (Haversine). */
export function haversineKm(
  aLat: number,
  aLong: number,
  bLat: number,
  bLong: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLong = ((bLong - aLong) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLong / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Distance decay, capped at the city tier so the tiers never invert. */
export function geoDecay(distanceKm: number): number {
  return TIER.sameCity * Math.exp(-distanceKm / GEO_SCALE_KM);
}

/** max over the discrete tiers + geo-decay; result in [0, 1]. */
export function proximityTier(candidate: Anchor, anchor: Anchor): number {
  const tiers: number[] = [0];
  if (candidate.facilityId && candidate.facilityId === anchor.facilityId) {
    tiers.push(TIER.sameFacility);
  }
  if (candidate.institutionId && candidate.institutionId === anchor.institutionId) {
    tiers.push(TIER.sameInstitution);
  }
  if (
    candidate.city &&
    anchor.city &&
    candidate.city.toLowerCase() === anchor.city.toLowerCase()
  ) {
    tiers.push(TIER.sameCity);
  }
  if (
    candidate.lat != null &&
    candidate.long != null &&
    anchor.lat != null &&
    anchor.long != null
  ) {
    tiers.push(
      geoDecay(haversineKm(candidate.lat, candidate.long, anchor.lat, anchor.long)),
    );
  }
  return Math.max(...tiers);
}

/** Squash a raw shared-rooms edge weight to [0, 1); mirrors `network_closeness`. */
export function networkCloseness(weight: number | null | undefined): number {
  const w = weight ?? 0;
  return w <= 0 ? 0 : w / (1 + w);
}

/** Combine tier + network term into the capped proximity value used by the boost. */
export function proximity(tier: number, closeness: number): number {
  return Math.min(tier + BETA * closeness, PROXIMITY_CAP);
}

/** One RRF contribution: `1 / (k + rank)` (rank is 1-based). */
export function rrf(rank: number, k: number = RRF_K): number {
  return 1 / (k + rank);
}

/** The composite score: bounded multiplicative proximity boost over fit. */
export function compositeScore(fit: number, proximityValue: number): number {
  return fit * (1 + LAMBDA * Math.min(proximityValue, PROXIMITY_CAP));
}
