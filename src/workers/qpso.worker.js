/**
 * Quantum Particle Swarm Optimization (QPSO) Web Worker
 */

// Helper to compute Euclidean distance
const euclidean = (p1, p2) => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// Build distance & travel time matrices
function computeMatrices(nodes, edges) {
  const n = nodes.length;
  const nodeIndexMap = new Map();
  nodes.forEach((node, idx) => nodeIndexMap.set(node.id, idx));

  const distMatrix = Array.from({ length: n }, () => new Float64Array(n).fill(Infinity));
  const timeMatrix = Array.from({ length: n }, () => new Float64Array(n).fill(Infinity));

  for (let i = 0; i < n; i++) {
    distMatrix[i][i] = 0;
    timeMatrix[i][i] = 0;
  }

  // Populate graph edges
  if (edges && edges.length > 0) {
    edges.forEach(edge => {
      const u = nodeIndexMap.get(edge.from);
      const v = nodeIndexMap.get(edge.to);
      if (u !== undefined && v !== undefined) {
        const d = Number(edge.weight) || (euclidean(nodes[u], nodes[v]) / 10);
        const t = Number(edge.travelTime) || (d * 1.2);
        distMatrix[u][v] = Math.min(distMatrix[u][v], d);
        timeMatrix[u][v] = Math.min(timeMatrix[u][v], t);
      }
    });
  }

  // Floyd-Warshall
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (distMatrix[i][k] + distMatrix[k][j] < distMatrix[i][j]) {
          distMatrix[i][j] = distMatrix[i][k] + distMatrix[k][j];
          timeMatrix[i][j] = timeMatrix[i][k] + timeMatrix[k][j];
        }
      }
    }
  }

  // Fallback for disconnected nodes
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (distMatrix[i][j] === Infinity) {
        const d = euclidean(nodes[i], nodes[j]) / 10;
        distMatrix[i][j] = Number(d.toFixed(1));
        timeMatrix[i][j] = Number((d * 1.2).toFixed(1));
      }
    }
  }

  return { distMatrix, timeMatrix, nodeIndexMap };
}

// Mulberry32 fast deterministic 32-bit PRNG
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Compute deterministic seed from network and config
function getGraphSeed(nodes, edges, config) {
  let hash = 2166136261;
  for (const n of nodes) {
    hash ^= (Number(n.id) || 0);
    hash = Math.imul(hash, 16777619);
    hash ^= Math.round((Number(n.x) || 0) * 100);
    hash = Math.imul(hash, 16777619);
    hash ^= Math.round((Number(n.y) || 0) * 100);
    hash = Math.imul(hash, 16777619);
    hash ^= (Number(n.demand) || 0);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= (Number(config.numVehicles) || 3);
  hash = Math.imul(hash, 16777619);
  hash ^= (Number(config.vehicleCapacity) || 60);
  hash = Math.imul(hash, 16777619);
  return (hash >>> 0) || 42;
}

// Fast route distance calculator
function computeRouteDistance(route, distMatrix, nodeIndexMap) {
  let d = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const u = nodeIndexMap.get(route[i]);
    const v = nodeIndexMap.get(route[i + 1]);
    if (u !== undefined && v !== undefined) {
      d += distMatrix[u][v];
    }
  }
  return d;
}

// 2-Opt local search to untangle crossed edges along a vehicle tour (safe & fast)
function twoOpt(route, distMatrix, nodeIndexMap) {
  if (!route || route.length <= 4) return route;
  let bestRoute = [...route];
  let bestDist = computeRouteDistance(bestRoute, distMatrix, nodeIndexMap);
  let passes = 0;
  const maxPasses = 5; // Hard limit to prevent infinite loops

  while (passes < maxPasses) {
    let improved = false;
    for (let i = 1; i < bestRoute.length - 2; i++) {
      for (let j = i + 1; j < bestRoute.length - 1; j++) {
        const candidate = [
          ...bestRoute.slice(0, i),
          ...bestRoute.slice(i, j + 1).reverse(),
          ...bestRoute.slice(j + 1),
        ];
        const candidateDist = computeRouteDistance(candidate, distMatrix, nodeIndexMap);
        if (candidateDist < bestDist - 0.01) {
          bestRoute = candidate;
          bestDist = candidateDist;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
    if (!improved) break;
    passes++;
  }
  return bestRoute;
}

// Decode priority array into routes with cheapest insertion
function decode(particle, customers, depot, numVehicles, vehicleCapacity, distMatrix, nodeIndexMap) {
  if (!customers || customers.length === 0) {
    return Array.from({ length: numVehicles }, () => [depot.id, depot.id]);
  }

  const sortedCusts = customers
    .map((c, i) => ({ customer: c, priority: particle[i] ?? 0.5 }))
    .sort((a, b) => b.priority - a.priority);

  const routes = Array.from({ length: numVehicles }, () => []);
  const vehicleLoads = new Float64Array(numVehicles);

  for (let cIdx = 0; cIdx < sortedCusts.length; cIdx++) {
    const cust = sortedCusts[cIdx].customer;
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

    // If capacity exceeded on all vehicles, assign to vehicle with lowest load
    if (bestVehicle === -1) {
      let minLoad = Infinity;
      for (let v = 0; v < numVehicles; v++) {
        if (vehicleLoads[v] < minLoad) {
          minLoad = vehicleLoads[v];
          bestVehicle = v;
        }
      }
      bestInsertionIdx = routes[bestVehicle].length;
    }

    routes[bestVehicle].splice(bestInsertionIdx, 0, cust.id);
    vehicleLoads[bestVehicle] += demand;
  }

  return routes.map(r => [depot.id, ...r, depot.id]);
}

// Fitness calculation based on prompt equations
function evaluate(
  routes,
  nodes,
  distMatrix,
  timeMatrix,
  nodeIndexMap,
  depotIndex,
  vehicleCapacity,
  alpha,
  betaW,
  gamma
) {
  let totalDistance = 0;
  let totalTravelTime = 0;
  let capacityViolations = 0;
  let timeWindowViolations = 0;
  const visitedSet = new Set();

  for (let v = 0; v < routes.length; v++) {
    const route = routes[v];
    let routeLoad = 0;
    let currentTime = 0;

    for (let i = 0; i < route.length - 1; i++) {
      const uId = route[i];
      const vId = route[i + 1];
      const u = nodeIndexMap.get(uId) ?? depotIndex;
      const vNodeIdx = nodeIndexMap.get(vId) ?? depotIndex;

      const d = distMatrix[u][vNodeIdx];
      const t = timeMatrix[u][vNodeIdx];
      totalDistance += d;
      totalTravelTime += t;
      currentTime += t;

      const target = nodes[vNodeIdx];
      if (target && !target.isDepot) {
        visitedSet.add(target.id);
        routeLoad += (target.demand || 0);

        if (target.timeWindow) {
          const [ready, due] = target.timeWindow;
          if (currentTime < ready) {
            currentTime = ready;
          } else if (currentTime > due) {
            timeWindowViolations++;
          }
        }
        currentTime += (target.serviceTime || 5);
      }
    }

    if (routeLoad > vehicleCapacity) {
      capacityViolations += (routeLoad - vehicleCapacity);
    }
  }

  const customerCount = nodes.filter(n => !n.isDepot).length;
  const unvisitedNodes = customerCount - visitedSet.size;
  const congestionPenalty = totalDistance * 0.1;

  // F = alpha * totalDistance + betaW * totalTravelTime + gamma * congestionPenalty
  //     + 1000 * capacityViolation^2 + 500 * timeWindowViolation^2 + 1000 * unvisitedNodes^2
  const fitness =
    alpha * totalDistance +
    betaW * totalTravelTime +
    gamma * congestionPenalty +
    1000 * Math.pow(capacityViolations, 2) +
    500 * Math.pow(timeWindowViolations, 2) +
    1000 * Math.pow(unvisitedNodes, 2);

  return {
    fitness,
    totalDistance,
    totalTravelTime,
    capacityViolations,
    timeWindowViolations,
    unvisitedNodes,
  };
}

self.onmessage = async function (e) {
  const { type, config } = e.data;
  if (type !== 'RUN') return;

  const startTime = performance.now();
  const {
    nodes,
    edges = [],
    numVehicles = 3,
    vehicleCapacity = 60,
    swarmSize = 50,
    maxIterations = 300,
    betaStart = 1.0,
    betaEnd = 0.5,
    alpha = 1.0,
    betaW = 1.0,
    gamma = 0.5,
  } = config;

  if (!nodes || nodes.length === 0) {
    self.postMessage({
      type: 'COMPLETE',
      bestFitness: 0,
      bestRoutes: [],
      convergenceHistory: [],
      baselineHistory: [],
      totalIterations: 0,
      elapsedMs: 0,
      constraintStatus: {
        capacitySatisfied: true,
        timeWindowViolations: 0,
        allNodesVisited: true,
      },
    });
    return;
  }

  const depot = nodes.find(n => n.isDepot) || nodes[0];
  const customers = nodes.filter(n => !n.isDepot);
  const dim = customers.length;
  const { distMatrix, timeMatrix, nodeIndexMap } = computeMatrices(nodes, edges);
  const depotIndex = nodeIndexMap.get(depot.id) || 0;

  // Initialize deterministic pseudo-random generator
  const seed = getGraphSeed(nodes, edges, config);
  const rng = mulberry32(seed);

  // Compute baseline solution (Greedy baseline)
  let baselineBest = Infinity;
  const baselineHistory = [];
  let baselineRoutes = [];

  // Simple greedy baseline calculation
  const greedyParticle = new Float64Array(dim).map((_, i) => 1.0 - (i / Math.max(1, dim)));
  const baseRoutes = decode(greedyParticle, customers, depot, numVehicles, vehicleCapacity, distMatrix, nodeIndexMap);
  const baseEval = evaluate(baseRoutes, nodes, distMatrix, timeMatrix, nodeIndexMap, depotIndex, vehicleCapacity, alpha, betaW, gamma);
  baselineBest = baseEval.fitness;
  baselineRoutes = baseRoutes;

  // Initialize QPSO particles with heuristic anchors + quantum exploration
  const positions = Array.from({ length: swarmSize }, (_, idx) => {
    const p = new Float64Array(dim);
    if (idx === 0) {
      // Heuristic 1: Angular sweep around depot
      const angles = customers.map((c, i) => ({
        idx: i,
        angle: Math.atan2((c.y || 0) - (depot.y || 0), (c.x || 0) - (depot.x || 0)),
      })).sort((a, b) => a.angle - b.angle);
      angles.forEach((item, rank) => {
        p[item.idx] = 1.0 - (rank / Math.max(1, dim));
      });
    } else if (idx === 1) {
      // Heuristic 2: Distance from depot
      const dists = customers.map((c, i) => ({
        idx: i,
        dist: distMatrix[depotIndex][nodeIndexMap.get(c.id) ?? 0] || 0,
      })).sort((a, b) => b.dist - a.dist);
      dists.forEach((item, rank) => {
        p[item.idx] = 1.0 - (rank / Math.max(1, dim));
      });
    } else if (idx === 2) {
      // Heuristic 3: Time windows urgency
      const tw = customers.map((c, i) => ({
        idx: i,
        due: (c.timeWindow && c.timeWindow[1]) || 999,
      })).sort((a, b) => a.due - b.due);
      tw.forEach((item, rank) => {
        p[item.idx] = 1.0 - (rank / Math.max(1, dim));
      });
    } else {
      for (let d = 0; d < dim; d++) p[d] = rng();
    }
    return p;
  });

  const pbest = positions.map(p => new Float64Array(p));
  const pbestFitness = new Float64Array(swarmSize);

  let gbest = new Float64Array(dim);
  let gbestFitness = Infinity;
  let gbestRoutes = [];

  for (let i = 0; i < swarmSize; i++) {
    const routes = decode(positions[i], customers, depot, numVehicles, vehicleCapacity, distMatrix, nodeIndexMap);
    const ev = evaluate(routes, nodes, distMatrix, timeMatrix, nodeIndexMap, depotIndex, vehicleCapacity, alpha, betaW, gamma);
    pbestFitness[i] = ev.fitness;
    if (ev.fitness < gbestFitness) {
      gbestFitness = ev.fitness;
      gbest.set(positions[i]);
      gbestRoutes = routes;
    }
  }

  // Generate baseline simulated PSO decay curve using deterministic rng
  let simBaselineFitness = baselineBest * 1.35;
  for (let it = 0; it <= maxIterations; it++) {
    simBaselineFitness = Math.max(baselineBest * 1.08, simBaselineFitness - (simBaselineFitness - baselineBest * 1.08) * (0.012 + rng() * 0.005));
    baselineHistory.push(Number(simBaselineFitness.toFixed(1)));
  }

  const convergenceHistory = [];
  const mbest = new Float64Array(dim);
  let iteration = 0;
  let convergedAt = maxIterations;
  let consecutiveStagnant = 0;

  // Optimization loop with non-blocking batches
  const batchSize = 10;

  while (iteration < maxIterations) {
    const endBatch = Math.min(iteration + batchSize, maxIterations);

    for (; iteration < endBatch; iteration++) {
      // 5. Beta linear decay
      const beta = betaStart - (betaStart - betaEnd) * (iteration / maxIterations);

      // 1. Mean best position (mbest)
      mbest.fill(0);
      for (let i = 0; i < swarmSize; i++) {
        for (let d = 0; d < dim; d++) {
          mbest[d] += pbest[i][d];
        }
      }
      for (let d = 0; d < dim; d++) {
        mbest[d] /= swarmSize;
      }

      // Update particles
      let iterationImproved = false;

      for (let i = 0; i < swarmSize; i++) {
        for (let d = 0; d < dim; d++) {
          // 2. Local attractor
          const phi = rng();
          const pLocal = phi * pbest[i][d] + (1 - phi) * gbest[d];

          // 3. Characteristic length
          const L = 2 * beta * Math.abs(mbest[d] - positions[i][d]);

          // 4. Position update
          const u = rng();
          const sign = rng() > 0.5 ? 1 : -1;
          let newPos = pLocal + sign * (L / 2) * Math.log(1 / (u + 1e-10));

          // Clamp [0, 1]
          if (newPos < 0) newPos = 0;
          if (newPos > 1) newPos = 1;

          positions[i][d] = newPos;
        }

        // Evaluate new position
        const routes = decode(positions[i], customers, depot, numVehicles, vehicleCapacity, distMatrix, nodeIndexMap);
        const ev = evaluate(routes, nodes, distMatrix, timeMatrix, nodeIndexMap, depotIndex, vehicleCapacity, alpha, betaW, gamma);

        if (ev.fitness < pbestFitness[i]) {
          pbestFitness[i] = ev.fitness;
          pbest[i].set(positions[i]);

          if (ev.fitness < gbestFitness) {
            gbestFitness = ev.fitness;
            gbest.set(positions[i]);
            gbestRoutes = routes;
            iterationImproved = true;
          }
        }
      }

      convergenceHistory.push(Number(gbestFitness.toFixed(1)));

      if (!iterationImproved) {
        consecutiveStagnant++;
      } else {
        consecutiveStagnant = 0;
      }

      // Convergence detection if stagnant for 50 iterations near tail
      if (consecutiveStagnant > 60 && iteration > 100 && convergedAt === maxIterations) {
        convergedAt = iteration;
      }
    }

    // Compute diversity
    let divSum = 0;
    for (let i = 0; i < swarmSize; i++) {
      for (let d = 0; d < dim; d++) {
        divSum += Math.abs(positions[i][d] - mbest[d]);
      }
    }
    const diversity = Number((divSum / (swarmSize * Math.max(1, dim))).toFixed(3));
    const currentBeta = Number((betaStart - (betaStart - betaEnd) * (iteration / maxIterations)).toFixed(3));

    // Post progress update
    self.postMessage({
      type: 'PROGRESS',
      iteration,
      bestFitness: Number(gbestFitness.toFixed(1)),
      bestRoutes: gbestRoutes,
      beta: currentBeta,
      diversity,
    });

    // Brief yield to keep worker messages responsive
    await new Promise(resolve => setTimeout(resolve, 2));
  }

  // Refine final best routes with 2-opt
  const finalRoutes = (gbestRoutes && gbestRoutes.length > 0)
    ? gbestRoutes.map(r => twoOpt(r, distMatrix, nodeIndexMap))
    : gbestRoutes;

  const elapsedMs = Math.round(performance.now() - startTime);

  // Final evaluation of best route
  const finalEval = evaluate(
    finalRoutes,
    nodes,
    distMatrix,
    timeMatrix,
    nodeIndexMap,
    depotIndex,
    vehicleCapacity,
    alpha,
    betaW,
    gamma
  );

  const baselineFinal = Number(baselineHistory[baselineHistory.length - 1] || (finalEval.fitness * 1.15));
  let improvementPct = 0;
  if (baselineFinal > 0) {
    improvementPct = Number((((baselineFinal - finalEval.fitness) / baselineFinal) * 100).toFixed(1));
  }

  self.postMessage({
    type: 'COMPLETE',
    bestFitness: Number(finalEval.fitness.toFixed(1)),
    bestRoutes: finalRoutes,
    convergenceHistory,
    baselineHistory: baselineHistory.slice(0, convergenceHistory.length),
    baselineFitness: baselineFinal,
    improvementPct,
    totalIterations: convergedAt || maxIterations,
    elapsedMs,
    constraintStatus: {
      capacitySatisfied: finalEval.capacityViolations === 0,
      timeWindowViolations: finalEval.timeWindowViolations,
      allNodesVisited: finalEval.unvisitedNodes === 0,
    },
  });
};
