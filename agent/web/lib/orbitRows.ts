/** Compact GP rows shared by the orbit route, the SGP4 worker and the orrery. No dependencies. */

/** [norad, name, objectId, epoch ISO, meanMotion rev/d, ecc, incDeg, raanDeg, argpDeg, maDeg, bstar, ndot, nddot] */
export type GpRow = [number, string, string, string, number, number, number, number, number, number, number, number, number];
export type OrbitSet = { group: string; source: string; fetchedAt: string; rows: GpRow[] };

/** Compact row → OMM object for satellite.js json2satrec. */
export function rowToOmm(r: GpRow) {
  return {
    OBJECT_NAME: r[1],
    OBJECT_ID: r[2],
    EPOCH: r[3],
    MEAN_MOTION: r[4],
    ECCENTRICITY: r[5],
    INCLINATION: r[6],
    RA_OF_ASC_NODE: r[7],
    ARG_OF_PERICENTER: r[8],
    MEAN_ANOMALY: r[9],
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: "U",
    NORAD_CAT_ID: r[0],
    ELEMENT_SET_NO: 999,
    REV_AT_EPOCH: 0,
    BSTAR: r[10],
    MEAN_MOTION_DOT: r[11],
    MEAN_MOTION_DDOT: r[12],
  };
}
