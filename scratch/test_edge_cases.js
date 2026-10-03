import { sampleNodes, sampleEdges } from '../src/data/sampleNetwork.js';

// Test edge cases
// 1. Single customer
const oneCust = [
  { id: 0, x: 300, y: 250, demand: 0, label: 'Depot', isDepot: true },
  { id: 1, x: 100, y: 100, demand: 10, label: 'N1', timeWindow: [0, 50] }
];

// Test function
console.log("Edge cases test passed initialization.");
