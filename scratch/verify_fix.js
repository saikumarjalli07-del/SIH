import { sampleNodes, sampleEdges } from '../src/data/sampleNetwork.js';
import { decodeParticle, twoOpt } from '../src/utils/vrpCodec.js';

// Let's verify multiple consecutive runs of the algorithm using the exact updated code logic
const euclidean = (p1, p2) => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

function evaluate(
  routes,
  nodes,
  distMatrix,
  timeMatrix,
  nodeIndexMap,
  depotIndex,
  vehicleCapacity,
  alpha = 1.0,
  betaW = 1.0,
  gamma = 0.5
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

function runOptimizer(nodes, edges) {
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

  const depot = nodes.find(n => n.isDepot) || nodes[0];
  const customers = nodes.filter(n => !n.isDepot);
  const dim = customers.length;
  const { distMatrix, timeMatrix, nodeIndexMap } = computeMatrices(nodes, edges);
  const depotIndex = nodeIndexMap.get(depot.id) || 0;

  const seed = getGraphSeed(nodes, edges, config);
  const rng = mulberry32(seed);

  const positions = Array.from({ length: config.swarmSize }, (_, idx) => {
    const p = new Float64Array(dim);
    if (idx === 0) {
      const angles = customers.map((c, i) => ({
        idx: i,
        angle: Math.atan2((c.y || 0) - (depot.y || 0), (c.x || 0) - (depot.x || 0)),
      })).sort((a, b) => a.angle - b.angle);
      angles.forEach((item, rank) => {
        p[item.idx] = 1.0 - (rank / Math.max(1, dim));
      });
    } else if (idx === 1) {
      const dists = customers.map((c, i) => ({
        idx: i,
        dist: distMatrix[depotIndex][nodeIndexMap.get(c.id) ?? 0] || 0,
      })).sort((a, b) => b.dist - a.dist);
      dists.forEach((item, rank) => {
        p[item.idx] = 1.0 - (rank / Math.max(1, dim));
      });
    } else if (idx === 2) {
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
  const pbestFitness = new Float64Array(config.swarmSize);

  let gbest = new Float64Array(dim);
  let gbestFitness = Infinity;
  let gbestRoutes = [];

  for (let i = 0; i < config.swarmSize; i++) {
    const routes = decodeParticle(positions[i], customers, depot, config.numVehicles, config.vehicleCapacity, distMatrix, nodeIndexMap);
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

      const routes = decodeParticle(positions[i], customers, depot, config.numVehicles, config.vehicleCapacity, distMatrix, nodeIndexMap);
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

  const finalEval = evaluate(gbestRoutes, nodes, distMatrix, timeMatrix, nodeIndexMap, depotIndex, config.vehicleCapacity, config.alpha, config.betaW, config.gamma);
  return {
    bestFitness: Number(gbestFitness.toFixed(1)),
    bestRoutes: gbestRoutes,
    violations: {
      capacity: finalEval.capacityViolations,
      timeWindow: finalEval.timeWindowViolations,
      unvisited: finalEval.unvisitedNodes,
    }
  };
}

console.log("Testing 5 consecutive optimizer runs:");
const results = [];
for (let run = 1; run <= 5; run++) {
  const res = runOptimizer(sampleNodes, sampleEdges);
  results.push(res);
  console.log(`Run ${run}: Fitness=${res.bestFitness}, Violations=${JSON.stringify(res.violations)}, Routes=${JSON.stringify(res.bestRoutes)}`);
}

// Verify exact determinism and optimality
const first = results[0];
const allIdentical = results.every(r => r.bestFitness === first.bestFitness && JSON.stringify(r.bestRoutes) === JSON.stringify(first.bestRoutes));
console.log("All 5 runs produced identical result:", allIdentical);
console.log("Zero violations:", first.violations.capacity === 0 && first.violations.timeWindow === 0 && first.violations.unvisited === 0);
