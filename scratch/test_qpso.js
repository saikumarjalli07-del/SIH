import { sampleNodes, sampleEdges } from '../src/data/sampleNetwork.js';

// Helper to compute Euclidean distance
const euclidean = (p1, p2) => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

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

    let bestVehicle = -1;
    let minAdditionalCost = Infinity;

    for (let v = 0; v < numVehicles; v++) {
      if (vehicleLoads[v] + demand <= vehicleCapacity) {
        const currentRoute = routes[v];
        const lastNodeId = currentRoute.length > 0 ? currentRoute[currentRoute.length - 1] : depot.id;
        const lastIdx = nodeIndexMap.get(lastNodeId);
        const custIdx = nodeIndexMap.get(cust.id);
        const cost = (lastIdx !== undefined && custIdx !== undefined) ? distMatrix[lastIdx][custIdx] : 10;

        if (cost < minAdditionalCost) {
          minAdditionalCost = cost;
          bestVehicle = v;
        }
      }
    }

    if (bestVehicle === -1) {
      let minLoad = Infinity;
      for (let v = 0; v < numVehicles; v++) {
        if (vehicleLoads[v] < minLoad) {
          minLoad = vehicleLoads[v];
          bestVehicle = v;
        }
      }
    }

    routes[bestVehicle].push(cust.id);
    vehicleLoads[bestVehicle] += demand;
  }

  return routes.map(r => [depot.id, ...r, depot.id]);
}

function evaluate(routes, nodes, distMatrix, timeMatrix, nodeIndexMap, depotIndex, vehicleCapacity, alpha, betaW, gamma) {
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

function runQPSO(nodes, edges) {
  const numVehicles = 3;
  const vehicleCapacity = 60;
  const swarmSize = 50;
  const maxIterations = 300;
  const betaStart = 1.0;
  const betaEnd = 0.5;
  const alpha = 1.0;
  const betaW = 1.0;
  const gamma = 0.5;

  const depot = nodes.find(n => n.isDepot) || nodes[0];
  const customers = nodes.filter(n => !n.isDepot);
  const dim = customers.length;
  const { distMatrix, timeMatrix, nodeIndexMap } = computeMatrices(nodes, edges);
  const depotIndex = nodeIndexMap.get(depot.id) || 0;

  const positions = Array.from({ length: swarmSize }, () => {
    const p = new Float64Array(dim);
    for (let d = 0; d < dim; d++) p[d] = Math.random();
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

  const mbest = new Float64Array(dim);
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const beta = betaStart - (betaStart - betaEnd) * (iteration / maxIterations);
    mbest.fill(0);
    for (let i = 0; i < swarmSize; i++) {
      for (let d = 0; d < dim; d++) {
        mbest[d] += pbest[i][d];
      }
    }
    for (let d = 0; d < dim; d++) {
      mbest[d] /= swarmSize;
    }

    for (let i = 0; i < swarmSize; i++) {
      for (let d = 0; d < dim; d++) {
        const phi = Math.random();
        const pLocal = phi * pbest[i][d] + (1 - phi) * gbest[d];
        const L = 2 * beta * Math.abs(mbest[d] - positions[i][d]);
        const u = Math.random();
        const sign = Math.random() > 0.5 ? 1 : -1;
        let newPos = pLocal + sign * (L / 2) * Math.log(1 / (u + 1e-10));
        if (newPos < 0) newPos = 0;
        if (newPos > 1) newPos = 1;
        positions[i][d] = newPos;
      }

      const routes = decode(positions[i], customers, depot, numVehicles, vehicleCapacity, distMatrix, nodeIndexMap);
      const ev = evaluate(routes, nodes, distMatrix, timeMatrix, nodeIndexMap, depotIndex, vehicleCapacity, alpha, betaW, gamma);

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

console.log("Testing 5 runs of current QPSO:");
for (let r = 1; r <= 5; r++) {
  const res = runQPSO(sampleNodes, sampleEdges);
  console.log(`Run ${r}: Fitness = ${res.gbestFitness.toFixed(2)}, Routes = ${JSON.stringify(res.gbestRoutes)}`);
}
