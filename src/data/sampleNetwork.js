export const sampleNodes = [
  // id  x    y    demand  label       zone
  { id: 0,  x: 360, y: 215, demand: 0,  label: 'Depot',  isDepot: true },                        // CP — centre
  { id: 1,  x: 340, y: 120, demand: 12, label: 'N1',  timeWindow: [0,  80] },  // Kamla Nagar — North
  { id: 2,  x: 295, y: 65,  demand: 8,  label: 'N2',  timeWindow: [10, 90] },  // Model Town — Far North
  { id: 3,  x: 110, y: 45,  demand: 15, label: 'N3',  timeWindow: [0,  70] },  // Rohini — Far NW
  { id: 4,  x: 515, y: 215, demand: 10, label: 'N4',  timeWindow: [20,100] },  // Laxmi Nagar — East
  { id: 5,  x: 555, y: 195, demand: 18, label: 'N5',  timeWindow: [0,  60] },  // Preet Vihar — Far East
  { id: 6,  x: 340, y: 430, demand: 7,  label: 'N6',  timeWindow: [30,110] },  // Saket — South
  { id: 7,  x: 430, y: 395, demand: 14, label: 'N7',  timeWindow: [0,  80] },  // GK-I — South-East
  { id: 8,  x: 325, y: 375, demand: 9,  label: 'N8',  timeWindow: [15, 95] },  // Hauz Khas — South-Central
  { id: 9,  x: 55,  y: 235, demand: 11, label: 'N9',  timeWindow: [0,  75] },  // Janakpuri — Far West
  { id: 10, x: 140, y: 185, demand: 6,  label: 'N10', timeWindow: [10, 85] },  // Rajouri Garden — West
  { id: 11, x: 345, y: 190, demand: 13, label: 'N11', timeWindow: [5,  90] },  // Paharganj — Near Depot
];

// Helper to calculate Euclidean distance
const calcDist = (n1, n2) => {
  const dx = n1.x - n2.x;
  const dy = n1.y - n2.y;
  return Number((Math.sqrt(dx * dx + dy * dy) / 10).toFixed(1));
};

// Edges connect geographically adjacent nodes only — no cross-city leaps
const pairs = [
  // Depot → cluster entry points
  [0, 11], [0, 1],  [0, 4],  [0, 8],  [0, 9],
  // North cluster
  [1, 2],  [1, 11], [1, 10],
  [2, 3],
  [3, 10],
  // East cluster
  [4, 5],  [4, 7],
  // South cluster
  [6, 7],  [6, 8],  [6, 0],
  [7, 8],
  [8, 0],
  // West cluster
  [9, 10],
  [10, 1],
  // Paharganj hub
  [11, 4],
];


export const sampleEdges = pairs.map(([fromId, toId]) => {
  const n1 = sampleNodes.find(n => n.id === fromId);
  const n2 = sampleNodes.find(n => n.id === toId);
  const dist = calcDist(n1, n2);
  return {
    id: `e-${fromId}-${toId}`,
    from: fromId,
    to: toId,
    weight: dist,
    travelTime: Number((dist * 1.2).toFixed(1)),
    congestion: 1.0,
  };
});

export const sampleNetwork = {
  nodes: sampleNodes,
  edges: sampleEdges,
};
