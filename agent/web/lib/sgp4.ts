/**
 * satellite.js SGP4 (OMM parsing + propagation) without the package root, whose
 * index also pulls in two ~400 KB WASM bulk-propagator builds we never use.
 */
export { json2satrec } from "../node_modules/satellite.js/dist/io.js";
export { propagate } from "../node_modules/satellite.js/dist/propagation/propagate.js";
export type { SatRec } from "satellite.js";
