import { sampleNodes, sampleEdges } from '../src/data/sampleNetwork.js';

const euclidean = (p1, p2) => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

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

function twoOpt(route, distMatrix, nodeIndexMap) {
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
}

// Enhanced decode with cheapest insertion and 2-opt
function decode(particle, customers, depot, numVehicles, vehicleCapacity, distMatrix, nodeIndexMap) {
  if (customers.length === 0) {
    return Array.from({ length: numVehicles }, () => [depot.id, depot.id]);
  }

  const sortedCusts = customers
    .map((c, i) => ({ customer: c, priority: particle[i] }))
    .sort((a, b) => b.priority - a.priority);

  const routes = Array.from({ length: numVehicles }, () => []);
  const vehicleLoads = new Float64Array(numVehicles);

  for (const item of sortedCusts) {
    const cust = item.customer;
    const demand = cust.demand || 0;
    const custIdx = nodeIndexMap.get(cust.id);

    let bestVehicle = -1;
    let bestInsertionIdx = -1;
    let minAdditionalCost = Infinity;

    for (let v = 0; v < numVehicles; v++) {
      if (vehicleLoads[v] + demand <= vehicleCapacity) {
        const currentRoute = routes[v];
        // Test all insertion positions in this route
        // Route starts at depot and ends at depot
        const fullRoute = [depot.id, ...currentRoute, depot.id];
        for (let pos = 0; pos < fullRoute.length - 1; pos++) {
          const uIdx = nodeIndexMap.get(fullRoute[pos]);
          const nextIdx = nodeIndexMap.get(fullRoute[pos + 1]);
          const addedCost = distMatrix[uIdx][custIdx] + distMatrix[custIdx][nextIdx] - distMatrix[uIdx][nextIdx];
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

  // 2-opt each route
  return routes.map(r => twoOpt([depot.id, ...r, depot.id], distMatrix, nodeIndexMap));
}

function evaluate(routes, nodes, distMatrix, timeMatrix, nodeIndexMap, depotIndex, vehicleCapacity = 60, alpha = 1, betaW = 1, gamma = 0.5) {
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

function getGraphSeed(nodes, edges, config) {
  let hash = 2166136261;
  for (const n of nodes) {
    hash ^= n.id;
    hash = Math.imul(hash, 16777619);
    hash ^= Math.round(n.x * 100);
    hash = Math.imul(hash, 16777619);
    hash ^= Math.round(n.y * 100);
    hash = Math.imul(hash, 16777619);
    hash ^= (n.demand || 0);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= (config.numVehicles || 3);
  hash = Math.imul(hash, 16777619);
  hash ^= (config.vehicleCapacity || 60);
  hash = Math.imul(hash, 16777619);
  return (hash >>> 0) || 42;
}

function runHybridQPSO(nodes, edges) {
  const config = {
    numVehicles: 3,
    vehicleCapacity: 60,
    swarmSize: 50,
    maxIterations: 300,
    betaStart: 1.0,
    betaEnd: 0.5,
    alpha: 1.0,
    betaW: 1.0,
    gamma: 0.5,
  };

  const seed = getGraphSeed(nodes, edges, config);
  const rng = mulberry32(seed);

  const depot = nodes.find(n => n.isDepot) || nodes[0];
  const customers = nodes.filter(n => !n.isDepot);
  const dim = customers.length;
  const { distMatrix, timeMatrix, nodeIndexMap } = computeMatrices(nodes, edges);
  const depotIndex = nodeIndexMap.get(depot.id) || 0;

  // Initialize QPSO particles
  const positions = Array.from({ length: config.swarmSize }, (_, idx) => {
    const p = new Float64Array(dim);
    if (idx === 0) {
      // Heuristic 1: Angular sweep around depot
      const angles = customers.map((c, i) => ({
        idx: i,
        angle: Math.atan2(c.y - depot.y, c.x - depot.x)
      })).sort((a, b) => a.angle - b.angle);
      angles.forEach((item, rank) => {
        p[item.idx] = 1.0 - (rank / Math.max(1, dim));
      });
    } else if (idx === 1) {
      // Heuristic 2: Distance from depot
      const dists = customers.map((c, i) => ({
        idx: i,
        dist: distMatrix[depotIndex][nodeIndexMap.get(c.id)]
      })).sort((a, b) => b.dist - a.dist);
      dists.forEach((item, rank) => {
        p[item.idx] = 1.0 - (rank / Math.max(1, dim));
      });
    } else if (idx === 2) {
      // Heuristic 3: Time windows earliest deadline first
      const tw = customers.map((c, i) => ({
        idx: i,
        due: (c.timeWindow && c.timeWindow[1]) || 999
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
  const pbestFitness = new Float64Array(config.swarmSize);

  let gbest = new Float64Array(dim);
  let gbestFitness = Infinity;
  let gbestRoutes = [];

  for (let i = 0; i < config.swarmSize; i++) {
    const routes = decode(positions[i], customers, depot, config.numVehicles, config.vehicleCapacity, distMatrix, nodeIndexMap);
    const ev = evaluate(routes, nodes, distMatrix, timeMatrix, nodeIndexMap, depotIndex, config.vehicleCapacity, config.alpha, config.betaW, config.gamma);
    pbestFitness[i] = ev.fitness;
    if (ev.fitness < gbestFitness) {
      gbestFitness = ev.fitness;
      gbest.set(positions[i]);
      gbestRoutes = routes;
    }
  }

  const mbest = new Float64Array(dim);
  for (let iteration = 0; iteration < config.maxIterations; iteration++) {
    const beta = config.betaStart - (config.betaStart - config.betaEnd) * (iteration / config.maxIterations);
    mbest.fill(0);
    for (let i = 0; i < config.swarmSize; i++) {
      for (let d = 0; d < dim; d++) {
        mbest[d] += pbest[i][d];
      }
    }
    for (let d = 0; d < dim; d++) {
      mbest[d] /= config.swarmSize;
    }

    for (let i = 0; i < config.swarmSize; i++) {
      for (let d = 0; d < dim; d++) {
        const phi = rng();
        const pLocal = phi * pbest[i][d] + (1 - phi) * gbest[d];
        const L = 2 * beta * Math.abs(mbest[d] - positions[i][d]);
        const u = rng();
        const sign = rng() > 0.5 ? 1 : -1;
        let newPos = pLocal + sign * (L / 2) * Math.log(1 / (u + 1e-10));
        if (newPos < 0) newPos = 0;
        if (newPos > 1) newPos = 1;
        positions[i][d] = newPos;
      }

      const routes = decode(positions[i], customers, depot, config.numVehicles, config.vehicleCapacity, distMatrix, nodeIndexMap);
      const ev = evaluate(routes, nodes, distMatrix, timeMatrix, nodeIndexMap, depotIndex, config.vehicleCapacity, config.alpha, config.betaW, config.gamma);

      if (ev.fitness < pbestFitness[i]) {
        pbestFitness[i] = ev.fitness;
        pbest[i].set(positions[i]);

        if (ev.fitness < gbestFitness) {
          gbestFitness = ev.fitness;
          gbest.set(positions[i]);
          gbestRoutes = routes;
        }
      }
    }
  }

  return { gbestFitness, gbestRoutes };
}

const t0 = performance.now();
for (let r = 1; r <= 5; r++) {
  const res = runHybridQPSO(sampleNodes, sampleEdges);
  console.log(`Run ${r}: Fitness = ${res.gbestFitness.toFixed(2)}, Routes = ${JSON.stringify(res.gbestRoutes)}`);
}
console.log(`Total time for 5 runs: ${(performance.now() - t0).toFixed(1)}ms`);
