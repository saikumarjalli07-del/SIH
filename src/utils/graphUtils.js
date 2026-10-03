/**
 * Graph utility functions for QuantaRoute
 */

export const euclideanDistance = (p1, p2) => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Builds distance and time matrices from nodes and edges.
 * Falls back to Euclidean distance scaled appropriately if no direct edge exists.
 */
export const buildDistanceMatrix = (nodes, edges) => {
  const nodeMap = new Map();
  nodes.forEach((n, idx) => nodeMap.set(n.id, { ...n, index: idx }));

  const n = nodes.length;
  const distMatrix = Array.from({ length: n }, () => new Float64Array(n).fill(Infinity));
  const timeMatrix = Array.from({ length: n }, () => new Float64Array(n).fill(Infinity));

  for (let i = 0; i < n; i++) {
    distMatrix[i][i] = 0;
    timeMatrix[i][i] = 0;
  }

  // Populate known edges
  edges.forEach(edge => {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (fromNode !== undefined && toNode !== undefined) {
      const u = fromNode.index;
      const v = toNode.index;
      const w = Number(edge.weight) || (euclideanDistance(fromNode, toNode) / 10);
      distMatrix[u][v] = Math.min(distMatrix[u][v], w);
      // For undirected or directed visualization
      const t = Number(edge.travelTime) || (w * 1.2);
      timeMatrix[u][v] = Math.min(timeMatrix[u][v], t);
    }
  });

  // Floyd-Warshall for shortest paths on network, fallback to Euclidean if disconnected
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

  // If pairs are still disconnected, assign Euclidean distance
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (distMatrix[i][j] === Infinity) {
        const d = euclideanDistance(nodes[i], nodes[j]) / 10;
        distMatrix[i][j] = Number(d.toFixed(1));
        timeMatrix[i][j] = Number((d * 1.2).toFixed(1));
      }
    }
  }

  return { distMatrix, timeMatrix, nodeMap };
};

/**
 * Calculates total route distance and verifies constraints
 */
export const evaluateRoutes = (routes, nodes, distMatrix, timeMatrix, vehicleCapacity) => {
  const nodeIndexMap = new Map(nodes.map((n, idx) => [n.id, idx]));
  const depotIndex = nodes.findIndex(n => n.isDepot) >= 0 ? nodes.findIndex(n => n.isDepot) : 0;

  let totalDistance = 0;
  let totalTravelTime = 0;
  let capacityViolations = 0;
  let timeWindowViolations = 0;
  const visitedCustomerSet = new Set();

  const routeDetails = routes.map((route, vIdx) => {
    let routeDist = 0;
    let routeTime = 0;
    let currentLoad = 0;
    let currentTime = 0;
    let routeTWViolations = 0;

    for (let i = 0; i < route.length - 1; i++) {
      const uId = route[i];
      const vId = route[i + 1];
      const u = nodeIndexMap.get(uId) ?? depotIndex;
      const v = nodeIndexMap.get(vId) ?? depotIndex;

      const d = distMatrix[u][v];
      const t = timeMatrix[u][v];
      routeDist += d;
      routeTime += t;
      currentTime += t;

      const targetNode = nodes[v];
      if (targetNode && !targetNode.isDepot) {
        visitedCustomerSet.add(targetNode.id);
        currentLoad += (targetNode.demand || 0);

        if (targetNode.timeWindow) {
          const [readyTime, dueTime] = targetNode.timeWindow;
          if (currentTime < readyTime) {
            currentTime = readyTime; // Wait until ready
          } else if (currentTime > dueTime) {
            routeTWViolations++;
          }
        }
        currentTime += (targetNode.serviceTime || 5);
      }
    }

    if (currentLoad > vehicleCapacity) {
      capacityViolations += (currentLoad - vehicleCapacity);
    }
    timeWindowViolations += routeTWViolations;
    totalDistance += routeDist;
    totalTravelTime += routeTime;

    return {
      vehicleId: vIdx + 1,
      route,
      distance: Number(routeDist.toFixed(1)),
      travelTime: Number(routeTime.toFixed(1)),
      load: currentLoad,
      isCapacityExceeded: currentLoad > vehicleCapacity,
    };
  });

  const customerNodes = nodes.filter(n => !n.isDepot);
  const unvisitedCount = customerNodes.length - visitedCustomerSet.size;

  return {
    totalDistance: Number(totalDistance.toFixed(1)),
    totalTravelTime: Number(totalTravelTime.toFixed(1)),
    capacityViolations,
    timeWindowViolations,
    unvisitedCount,
    routeDetails,
  };
};
