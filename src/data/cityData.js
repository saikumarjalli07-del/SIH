/**
 * City coordinates and geographic mappings for QuantaRoute
 * Default: New Delhi Urban Logistics Zone
 */

export const cityZones = {
  delhi: {
    name: 'New Delhi Central Hub',
    center: [28.625, 77.190],
    zoom: 11,
    nodeCoords: {
      // Depot — Connaught Place (true city-centre logistics hub)
      0:  { name: 'Connaught Place Depot',           lat: 28.6315, lng: 77.2167, isDepot: true },

      // North Delhi cluster
      1:  { name: 'Kamla Nagar Market',              lat: 28.6789, lng: 77.2065 },
      2:  { name: 'Model Town Delivery Hub',         lat: 28.7066, lng: 77.1908 },
      3:  { name: 'Rohini Sector-9 Store',           lat: 28.7195, lng: 77.1128 },

      // East Delhi cluster
      4:  { name: 'Laxmi Nagar Commercial Centre',  lat: 28.6314, lng: 77.2783 },
      5:  { name: 'Preet Vihar Supermarket',         lat: 28.6412, lng: 77.2958 },

      // South Delhi cluster
      6:  { name: 'Saket Select City Walk',          lat: 28.5245, lng: 77.2066 },
      7:  { name: 'Greater Kailash-I Market',        lat: 28.5413, lng: 77.2380 },
      8:  { name: 'Hauz Khas Village Hub',           lat: 28.5530, lng: 77.2000 },

      // West Delhi cluster
      9:  { name: 'Janakpuri District Centre',       lat: 28.6212, lng: 77.0854 },
      10: { name: 'Rajouri Garden Market',           lat: 28.6471, lng: 77.1200 },

      // Central / mixed
      11: { name: 'Paharganj Wholesale Hub',         lat: 28.6440, lng: 77.2100 },
    },
  },
};


/**
 * Register a real lat/lng for a dynamically created node (e.g. added via map click or CSV).
 */
export const registerNodeCoord = (nodeId, lat, lng, name = null) => {
  cityZones.delhi.nodeCoords[nodeId] = {
    name: name || `Stop #${nodeId}`,
    lat,
    lng,
  };
};

/**
 * Gets geographic coordinate for a given node ID, falling back to a deterministic offset if dynamic node.
 */
export const getNodeLatLng = (nodeId, baseZone = cityZones.delhi) => {
  const info = baseZone.nodeCoords[nodeId];
  if (info) return [info.lat, info.lng];

  // Unmapped dynamic nodes — deterministic ring fallback
  const baseLat = baseZone.center[0];
  const baseLng = baseZone.center[1];
  const angle = (Number(nodeId) * 55 * Math.PI) / 180;
  const radius = 0.03 + ((Number(nodeId) % 5) * 0.01);
  return [
    Number((baseLat + Math.sin(angle) * radius).toFixed(5)),
    Number((baseLng + Math.cos(angle) * radius * 1.15).toFixed(5)),
  ];
};

export const VEHICLE_COLORS = [
  '#C8F04A', // V1: Electric Lime
  '#00E5FF', // V2: Neon Cyan
  '#FF9F43', // V3: Amber Orange
  '#FF5252', // V4: Coral Red
  '#A855F7', // V5: Cyber Purple
  '#2ED573', // V6: Emerald Green
];

export const getVehicleColor = (idx) => {
  return VEHICLE_COLORS[idx % VEHICLE_COLORS.length];
};

/**
 * Generates clean, simplified route coordinates for smooth vehicle movement along route.
 * Applies subtle parallel lane offset based on vehicle index so multi-vehicle paths do not directly collide.
 */
export const generateRoutePath = (
  routeNodeIds,
  baseZone = cityZones.delhi,
  vehicleIdx = 0,
  totalVehicles = 1
) => {
  if (!routeNodeIds || routeNodeIds.length < 2) return [];

  const points = [];
  // Subtle parallel lane offset in degrees (~60-80 meters in city)
  const offsetScale = totalVehicles > 1 ? (vehicleIdx - (totalVehicles - 1) / 2) * 0.0007 : 0;

  for (let i = 0; i < routeNodeIds.length - 1; i++) {
    const fromCoord = getNodeLatLng(routeNodeIds[i], baseZone);
    const toCoord = getNodeLatLng(routeNodeIds[i + 1], baseZone);

    const dLat = toCoord[0] - fromCoord[0];
    const dLng = toCoord[1] - fromCoord[1];
    const len = Math.sqrt(dLat * dLat + dLng * dLng);

    let offsetLat = 0;
    let offsetLng = 0;
    if (len > 0.00001 && offsetScale !== 0) {
      // Normal perpendicular unit vector
      offsetLat = (-dLng / len) * offsetScale;
      offsetLng = (dLat / len) * offsetScale;
    }

    const pFrom = [fromCoord[0] + offsetLat, fromCoord[1] + offsetLng];
    const pTo = [toCoord[0] + offsetLat, toCoord[1] + offsetLng];

    if (i === 0) points.push(pFrom);
    points.push(pTo);
  }

  return points;
};

