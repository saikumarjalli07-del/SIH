import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cityZones, getNodeLatLng, generateRoutePath, getVehicleColor, VEHICLE_COLORS } from '../../data/cityData';

export const CityMap = ({
  nodes = [],
  routes = [],
  simulationProgress = 0,
  isSimulating = false,
  showTraffic = false,
  selectedVehicle = null,
  onSelectVehicle = null,
  addMode = false,
  onMapClick = null,
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const vehiclesLayerRef = useRef(null);
  const [clickPreview, setClickPreview] = useState(null); // { lat, lng, x, y }

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: cityZones.delhi.center,
        zoom: cityZones.delhi.zoom,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 16, className: 'esri-dark-tiles' }
      ).addTo(map);

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 16, className: 'esri-dark-reference' }
      ).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      vehiclesLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle map click for adding stops
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleClick = (e) => {
      if (!addMode || !onMapClick) return;
      const { lat, lng } = e.latlng;
      const containerPoint = map.latLngToContainerPoint([lat, lng]);
      setClickPreview({ lat, lng, x: containerPoint.x, y: containerPoint.y });
    };

    map.on('click', handleClick);
    return () => map.off('click', handleClick);
  }, [addMode, onMapClick]);

  // Change cursor based on addMode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.getContainer().style.cursor = addMode ? 'crosshair' : '';
  }, [addMode]);

  // Update static markers and route lines
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // Map which vehicle visits each node
    const nodeVehicleMap = new Map();
    routes.forEach((route, vIdx) => {
      route.forEach((nId) => {
        if (!nodeVehicleMap.has(nId)) nodeVehicleMap.set(nId, []);
        nodeVehicleMap.get(nId).push(vIdx);
      });
    });

    // 1. Render Route Polyline Casing and Foreground lines
    // First render all non-selected (background), then render selected (foreground)
    const renderOrder = [...routes.keys()].sort((a, b) => {
      if (selectedVehicle === null) return 0;
      if (a === selectedVehicle) return 1;
      if (b === selectedVehicle) return -1;
      return 0;
    });

    renderOrder.forEach((vIdx) => {
      const route = routes[vIdx];
      if (!route || route.length < 2) return;

      const isFocused = selectedVehicle === vIdx;
      const isDimmed = selectedVehicle !== null && !isFocused;
      const color = getVehicleColor(vIdx);
      const waypoints = generateRoutePath(route, cityZones.delhi, vIdx, routes.length);

      if (waypoints.length > 1) {
        // Dark casing line under each path for separation & non-overlapping depth
        L.polyline(waypoints, {
          color: '#0A0A0A',
          weight: isFocused ? 7 : isDimmed ? 3 : 5,
          opacity: isDimmed ? 0.2 : 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(layerGroup);

        // Crisp colored route line
        const polyline = L.polyline(waypoints, {
          color,
          weight: isFocused ? 4 : isDimmed ? 1.5 : 2.5,
          opacity: isDimmed ? 0.25 : 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(layerGroup);

        if (onSelectVehicle) {
          polyline.on('click', () => {
            onSelectVehicle(isFocused ? null : vIdx);
          });
        }
      }
    });

    // 2. Traffic Overlay
    if (showTraffic) {
      const congestionSegments = [
        [[28.6304, 77.2177], [28.6430, 77.1780]],
        [[28.6230, 77.2435], [28.5910, 77.2510]],
      ];
      congestionSegments.forEach((segment) => {
        L.polyline(segment, { color: '#E85D3A', weight: 4, opacity: 0.6, dashArray: '4, 8' }).addTo(layerGroup);
      });
    }

    // 3. Node & Depot Markers
    nodes.forEach((node) => {
      const [lat, lng] = getNodeLatLng(node.id);
      const isDepot = Boolean(node.isDepot);
      const assignedVehicles = nodeVehicleMap.get(node.id) || [];
      const isNodeDimmed = selectedVehicle !== null && !isDepot && !assignedVehicles.includes(selectedVehicle);
      const isNodeFocused = selectedVehicle !== null && assignedVehicles.includes(selectedVehicle);

      const nodeBorderColor = isDepot
        ? '#C8F04A'
        : assignedVehicles.length > 0
          ? getVehicleColor(assignedVehicles[0])
          : '#4A4A4A';

      const markerHtml = isDepot
        ? `<div style="
            width: 28px; height: 28px;
            background: #151515;
            border: 2px solid #C8F04A;
            border-radius: 4px;
            display: flex; align-items: center; justify-content: center;
            color: #C8F04A; font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 700;
            box-shadow: 0 0 14px rgba(200, 240, 74, 0.45);
            transition: all 0.2s ease;
          ">DEP</div>`
        : `<div style="
            width: 22px; height: 22px;
            background: #181818;
            border: ${isNodeFocused ? '2px' : '1.5px'} solid ${nodeBorderColor};
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            color: ${isNodeDimmed ? '#666' : '#EDEDED'};
            font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: ${isNodeFocused ? '700' : '500'};
            opacity: ${isNodeDimmed ? 0.35 : 1.0};
            box-shadow: ${isNodeFocused ? `0 0 10px ${nodeBorderColor}` : '0 2px 5px rgba(0,0,0,0.5)'};
            transition: all 0.2s ease;
          ">${node.id}</div>`;

      const customIcon = L.divIcon({
        className: 'custom-map-marker',
        html: markerHtml,
        iconSize: [isDepot ? 28 : 22, isDepot ? 28 : 22],
        iconAnchor: [isDepot ? 14 : 11, isDepot ? 14 : 11],
      });

      const stopInfo = cityZones.delhi.nodeCoords[node.id] || { name: `Stop #${node.id}` };
      const popupHtml = `
        <div style="font-family: 'DM Sans', sans-serif; font-size: 12px; color: #EDEDED; background: #1A1A1A; padding: 6px 10px; border-radius: 3px;">
          <div style="font-weight: 700; margin-bottom: 2px; color: ${isDepot ? '#C8F04A' : '#EDEDED'};">${stopInfo.name}</div>
          <div style="color: #888; font-family: 'IBM Plex Mono', monospace; font-size: 10px;">ID: ${node.id} · Demand: ${node.demand || 0} units</div>
          ${assignedVehicles.length > 0 ? `<div style="color: ${getVehicleColor(assignedVehicles[0])}; font-family: 'IBM Plex Mono', monospace; font-size: 10px; margin-top: 2px;">Assigned: Vehicle #${assignedVehicles.map(v => v + 1).join(', #')}</div>` : ''}
          ${node.timeWindow ? `<div style="color: #3ABA7A; font-size: 10px; margin-top: 2px;">Window: ${node.timeWindow[0]}m - ${node.timeWindow[1]}m</div>` : ''}
        </div>
      `;

      L.marker([lat, lng], { icon: customIcon, zIndexOffset: isDepot ? 500 : isNodeFocused ? 300 : 100 })
        .bindPopup(popupHtml, { closeButton: false, className: 'dark-map-popup' })
        .addTo(layerGroup);
    });
  }, [nodes, routes, showTraffic, selectedVehicle, onSelectVehicle]);

  // Animated vehicle positions
  useEffect(() => {
    const vehiclesLayer = vehiclesLayerRef.current;
    if (!vehiclesLayer) return;
    vehiclesLayer.clearLayers();

    routes.forEach((route, vIdx) => {
      if (!route || route.length < 2) return;
      const isSelected = selectedVehicle === null || selectedVehicle === vIdx;
      if (!isSelected) return;

      const color = getVehicleColor(vIdx);
      const waypoints = generateRoutePath(route, cityZones.delhi, vIdx, routes.length);
      if (waypoints.length < 2) return;

      const totalSegments = waypoints.length - 1;
      const progressScaled = (simulationProgress % 1) * totalSegments;
      const currentSegment = Math.min(Math.floor(progressScaled), totalSegments - 1);
      const segmentT = progressScaled - currentSegment;

      const p1 = waypoints[currentSegment];
      const p2 = waypoints[currentSegment + 1];
      const currentLat = p1[0] + (p2[0] - p1[0]) * segmentT;
      const currentLng = p1[1] + (p2[1] - p1[1]) * segmentT;

      const vehicleIcon = L.divIcon({
        className: 'vehicle-marker',
        html: `
          <div style="
            width: 24px; height: 24px;
            background: #111111;
            border: 2px solid ${color};
            border-radius: 4px;
            display: flex; align-items: center; justify-content: center;
            color: ${color};
            font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 700;
            box-shadow: 0 0 14px ${color};
            cursor: pointer;
          ">V${vIdx + 1}</div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([currentLat, currentLng], { icon: vehicleIcon, zIndexOffset: 1000 }).addTo(vehiclesLayer);
      if (onSelectVehicle) {
        marker.on('click', () => {
          onSelectVehicle(selectedVehicle === vIdx ? null : vIdx);
        });
      }
    });
  }, [routes, simulationProgress, selectedVehicle, onSelectVehicle]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%', backgroundColor: 'var(--bg)' }}
      />

      {/* Floating Fleet Isolator / Filter Pills on Map */}
      {routes.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 1000,
          display: 'flex',
          gap: '6px',
          backgroundColor: 'rgba(21, 21, 21, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '4px 6px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <button
            type="button"
            onClick={() => onSelectVehicle && onSelectVehicle(null)}
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              backgroundColor: selectedVehicle === null ? 'var(--surface-nested)' : 'transparent',
              color: selectedVehicle === null ? 'var(--text)' : 'var(--muted)',
              border: selectedVehicle === null ? '1px solid var(--border)' : '1px solid transparent',
              borderRadius: '3px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            All Paths ({routes.length})
          </button>
          {routes.map((_, vIdx) => {
            const isSel = selectedVehicle === vIdx;
            const color = getVehicleColor(vIdx);
            return (
              <button
                key={`pill-v-${vIdx}`}
                type="button"
                onClick={() => onSelectVehicle && onSelectVehicle(isSel ? null : vIdx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: isSel ? 700 : 500,
                  backgroundColor: isSel ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: isSel ? color : 'var(--muted)',
                  border: isSel ? `1px solid ${color}` : '1px solid transparent',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: color,
                  boxShadow: isSel ? `0 0 6px ${color}` : 'none',
                }} />
                V{vIdx + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* Add-mode hint banner */}
      {addMode && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(200, 240, 74, 0.12)',
          border: '1px solid var(--accent)',
          borderRadius: '4px',
          padding: '6px 14px',
          fontFamily: 'var(--font-body)',
          fontSize: '12px',
          color: 'var(--accent)',
          pointerEvents: 'none',
          zIndex: 1000,
          whiteSpace: 'nowrap',
        }}>
          ✛ Click anywhere on the map to add a delivery stop
        </div>
      )}

      {/* Demand input popup after map click */}
      {clickPreview && (
        <MapClickPopup
          x={clickPreview.x}
          y={clickPreview.y}
          lat={clickPreview.lat}
          lng={clickPreview.lng}
          onConfirm={(demand, timeWindow) => {
            onMapClick && onMapClick(clickPreview.lat, clickPreview.lng, demand, timeWindow);
            setClickPreview(null);
          }}
          onCancel={() => setClickPreview(null)}
        />
      )}

      <style>{`
        .esri-dark-tiles img { filter: brightness(0.65) contrast(1.25); }
        .esri-dark-reference img { filter: brightness(0.8); }
        .leaflet-popup-content-wrapper, .leaflet-popup-tip {
          background: #1A1A1A !important;
          color: #EDEDED !important;
          box-shadow: none !important;
          border: 1px solid #2E2E2E !important;
          border-radius: 3px !important;
          padding: 0 !important;
        }
        .leaflet-popup-content { margin: 0 !important; line-height: 1.4 !important; }
      `}</style>
    </div>
  );
};

/* ── Inline demand-input popup that floats near the clicked map point ── */
const MapClickPopup = ({ x, y, lat, lng, onConfirm, onCancel }) => {
  const [demand, setDemand] = React.useState(10);
  const [twStart, setTwStart] = React.useState(0);
  const [twEnd, setTwEnd] = React.useState(90);

  // Keep popup inside viewport
  const popupW = 200;
  const popupH = 180;
  const left = Math.min(x + 12, window.innerWidth - popupW - 20);
  const top  = Math.min(y + 12, window.innerHeight - popupH - 20);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left,
        top,
        width: popupW,
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--accent)',
        borderRadius: 'var(--radius)',
        padding: '12px',
        zIndex: 2000,
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--accent)', marginBottom: '8px', fontWeight: 600 }}>
        New Stop
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--muted)', marginBottom: '10px' }}>
        {lat.toFixed(4)}, {lng.toFixed(4)}
      </div>

      <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-body)', marginBottom: '3px' }}>
        Demand (units)
      </label>
      <input
        type="number"
        min={1}
        max={99}
        value={demand}
        autoFocus
        onChange={(e) => setDemand(Number(e.target.value) || 1)}
        style={{ width: '100%', marginBottom: '8px' }}
      />

      <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-body)', marginBottom: '3px' }}>
        Time Window (min)
      </label>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <input type="number" min={0} value={twStart} onChange={(e) => setTwStart(Number(e.target.value))} style={{ width: '50%' }} />
        <input type="number" min={1} value={twEnd}   onChange={(e) => setTwEnd(Number(e.target.value))}   style={{ width: '50%' }} />
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => onConfirm(demand, [twStart, twEnd])}
          style={{
            flex: 1, padding: '5px', fontSize: '12px', fontFamily: 'var(--font-heading)', fontWeight: 700,
            backgroundColor: 'var(--accent)', color: '#0F0F0F', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
          }}
        >Add</button>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '5px', fontSize: '12px', fontFamily: 'var(--font-body)',
            backgroundColor: 'var(--surface-nested)', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer',
          }}
        >Cancel</button>
      </div>
    </div>
  );
};
