/**
 * VRP Codec: Encodes and decodes continuous particle representations [0, 1] into vehicle routes.
 */

/**
 * Decodes a particle priority vector into vehicle routes.
 *
 * @param {Float64Array|Array<number>} particle - Priority values [0, 1] for each customer
 * @param {Array<Object>} customers - List of customer node objects
 * @param {Object} depot - The depot node
 * @param {number} numVehicles - Number of available vehicles
 * @param {number} vehicleCapacity - Capacity limit per vehicle
 * @param {Array<Float64Array>} distMatrix - Precomputed distance matrix
 * @param {Map<number, number>} nodeIndexMap - Map from node ID to matrix index
 * @returns {Array<Array<number>>} List of routes where each route is [depotId, ...nodeIds, depotId]
 */
/**
 * 2-Opt local search to untangle crossed edges along a vehicle tour
 */
export const twoOpt = (route, distMatrix, nodeIndexMap) => {
  if (route.length <= 4) return route;
  let bestRoute = [...route];
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 1; i < bestRoute.length - 2; i++) {
      for (let j = i + 1; j < bestRoute.length - 1; j++) {
        const u1 = nodeIndexMap.get(bestRoute[i - 1]);
        const v1 = nodeIndexMap.get(bestRoute[i]);
        const u2 = nodeIndexMap.get(bestRoute[j]);
        const v2 = nodeIndexMap.get(bestRoute[j + 1]);

        if (u1 === undefined || v1 === undefined || u2 === undefined || v2 === undefined) continue;

        const currentDist = distMatrix[u1][v1] + distMatrix[u2][v2];
        const newDist = distMatrix[u1][u2] + distMatrix[v1][v2];

        if (newDist < currentDist - 1e-6) {
          const reversed = bestRoute.slice(i, j + 1).reverse();
          bestRoute = [
            ...bestRoute.slice(0, i),
            ...reversed,
            ...bestRoute.slice(j + 1)
          ];
          improved = true;
        }
      }
    }
  }
  return bestRoute;
};

export const decodeParticle = (
  particle,
  customers,
  depot,
  numVehicles,
  vehicleCapacity,
  distMatrix,
  nodeIndexMap
) => {
  if (!customers || customers.length === 0) {
    return Array.from({ length: numVehicles }, () => [depot.id, depot.id]);
  }

  // Create indexed list of customers sorted by particle priority descending
  const indexed = customers.map((c, i) => ({
    customer: c,
    priority: particle[i] ?? 0.5,
  }));

  indexed.sort((a, b) => b.priority - a.priority);

  const routes = Array.from({ length: numVehicles }, () => []);
  const vehicleLoads = new Float64Array(numVehicles);

  // Assign customers to vehicles using best insertion
  for (const item of indexed) {
    const cust = item.customer;
    const demand = cust.demand || 0;
    const custIdx = nodeIndexMap.get(cust.id);

    let bestVehicle = -1;
    let bestInsertionIdx = -1;
    let minAdditionalCost = Infinity;

    for (let v = 0; v < numVehicles; v++) {
      if (vehicleLoads[v] + demand <= vehicleCapacity) {
        const currentRoute = routes[v];
        const fullRoute = [depot.id, ...currentRoute, depot.id];

        for (let pos = 0; pos < fullRoute.length - 1; pos++) {
          const uIdx = nodeIndexMap.get(fullRoute[pos]);
          const nextIdx = nodeIndexMap.get(fullRoute[pos + 1]);
          const addedCost = (uIdx !== undefined && custIdx !== undefined && nextIdx !== undefined)
            ? (distMatrix[uIdx][custIdx] + distMatrix[custIdx][nextIdx] - distMatrix[uIdx][nextIdx])
            : 10;

          if (addedCost < minAdditionalCost) {
            minAdditionalCost = addedCost;
            bestVehicle = v;
            bestInsertionIdx = pos;
          }
        }
      }
    }

    if (bestVehicle === -1) {
      let minLoad = Infinity;
      for (let v = 0; v < numVehicles; v++) {
        if (vehicleLoads[v] < minLoad) {
          minLoad = vehicleLoads[v];
          bestVehicle = v;
          bestInsertionIdx = routes[v].length;
        }
      }
    }

    routes[bestVehicle].splice(bestInsertionIdx, 0, cust.id);
    vehicleLoads[bestVehicle] += demand;
  }

  // Refine each vehicle route with 2-opt
  return routes.map(r => twoOpt([depot.id, ...r, depot.id], distMatrix, nodeIndexMap));
};
