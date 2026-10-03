import { sampleNodes, sampleEdges } from '../src/data/sampleNetwork.js';

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

const { distMatrix, timeMatrix, nodeIndexMap } = computeMatrices(sampleNodes, sampleEdges);
const depot = sampleNodes.find(n => n.isDepot) || sampleNodes[0];
const depotIndex = nodeIndexMap.get(depot.id);
const customers = sampleNodes.filter(n => !n.isDepot);

// Let's test smart local search / simulated annealing / variable neighborhood search
function solveBest() {
  let globalBestFitness = Infinity;
  let globalBestRoutes = null;

  // Let's test 100,000 random permutations with 2-opt and best insertion
  for (let trial = 0; trial < 20000; trial++) {
    // Random permutation of customer IDs
    const perm = customers.map(c => c.id).sort(() => Math.random() - 0.5);
    
    // Split into 3 routes with capacity <= 60
    const routes = [[0], [0], [0]];
    const loads = [0, 0, 0];
    let possible = true;

    for (const cid of perm) {
      const node = customers.find(c => c.id === cid);
      // find vehicle with lowest load or lowest added cost
      let bestV = -1;
      let bestAddedCost = Infinity;
      for (let v = 0; v < 3; v++) {
        if (loads[v] + node.demand <= 60) {
          const lastId = routes[v][routes[v].length - 1];
          const cost = distMatrix[nodeIndexMap.get(lastId)][nodeIndexMap.get(cid)];
          if (cost < bestAddedCost) {
            bestAddedCost = cost;
            bestV = v;
          }
        }
      }
      if (bestV === -1) {
        possible = false;
        break;
      }
      routes[bestV].push(cid);
      loads[bestV] += node.demand;
    }

    if (!possible) continue;
    routes.forEach(r => r.push(0));

    // Try 2-opt on each route
    for (let v = 0; v < 3; v++) {
      let r = routes[v];
      for (let i = 1; i < r.length - 2; i++) {
        for (let j = i + 1; j < r.length - 1; j++) {
          const cand = [...r.slice(0, i), ...r.slice(i, j + 1).reverse(), ...r.slice(j + 1)];
          const testRoutes = routes.map((rt, idx) => idx === v ? cand : rt);
          const ev1 = evaluate(routes, sampleNodes, distMatrix, timeMatrix, nodeIndexMap, depotIndex);
          const ev2 = evaluate(testRoutes, sampleNodes, distMatrix, timeMatrix, nodeIndexMap, depotIndex);
          if (ev2.fitness < ev1.fitness) {
            routes[v] = cand;
          }
        }
      }
    }

    const ev = evaluate(routes, sampleNodes, distMatrix, timeMatrix, nodeIndexMap, depotIndex);
    if (ev.fitness < globalBestFitness && ev.capacityViolations === 0 && ev.timeWindowViolations === 0) {
      globalBestFitness = ev.fitness;
      globalBestRoutes = routes;
      console.log(`New Best at trial ${trial}: Fitness = ${globalBestFitness.toFixed(2)}, Routes = ${JSON.stringify(globalBestRoutes)}`);
    }
  }

  return { globalBestFitness, globalBestRoutes };
}

solveBest();
