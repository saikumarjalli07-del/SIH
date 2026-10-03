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

// Find best TSP route for a subset of customers starting and ending at depot
function solveTSP(subsetIds) {
  if (subsetIds.length === 0) return { route: [0, 0], cost: 0 };
  
  function permute(arr) {
    if (arr.length <= 1) return [arr];
    const res = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = permute([...arr.slice(0, i), ...arr.slice(i + 1)]);
      for (const p of rest) res.push([arr[i], ...p]);
    }
    return res;
  }

  const perms = permute(subsetIds);
  let bestRoute = null;
  let bestCost = Infinity;

  for (const p of perms) {
    const full = [0, ...p, 0];
    let dist = 0;
    for (let i = 0; i < full.length - 1; i++) {
      dist += distMatrix[nodeIndexMap.get(full[i])][nodeIndexMap.get(full[i+1])];
    }
    if (dist < bestCost) {
      bestCost = dist;
      bestRoute = full;
    }
  }
  return { route: bestRoute, cost: bestCost };
}

// Partition 11 customers into 3 sets
let bestOverallFitness = Infinity;
let bestOverallRoutes = null;

function partition(idx, groups, loads) {
  if (idx === customers.length) {
    // evaluate this 3-partition
    const routes = groups.map(g => solveTSP(g).route);
    const ev = evaluate(routes, sampleNodes, distMatrix, timeMatrix, nodeIndexMap, depotIndex);
    if (ev.fitness < bestOverallFitness) {
      bestOverallFitness = ev.fitness;
      bestOverallRoutes = routes;
      console.log(`NEW ABSOLUTE MINIMUM: Fitness = ${bestOverallFitness.toFixed(2)}, Routes = ${JSON.stringify(bestOverallRoutes)}`);
    }
    return;
  }

  const cust = customers[idx];
  for (let g = 0; g < 3; g++) {
    if (loads[g] + cust.demand <= 60) {
      groups[g].push(cust.id);
      loads[g] += cust.demand;
      partition(idx + 1, groups, loads);
      groups[g].pop();
      loads[g] -= cust.demand;
    }
    // Symmetry breaking: if group is empty, don't try subsequent empty groups
    if (groups[g].length === 0) break;
  }
}

console.log("Searching absolute global optimum across all valid partitions...");
partition(0, [[], [], []], [0, 0, 0]);
console.log("Global optimum found:", bestOverallFitness, bestOverallRoutes);
