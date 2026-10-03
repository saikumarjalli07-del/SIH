# QuantaRoute — Real-Time Extension Prompt
# Live Traffic + Dynamic Rerouting + WebSocket Backend
# SIH 2025 · PS #26137 · Egreen Quanta

---

## WHAT THIS ADDS

This prompt extends the existing QuantaRoute app with real-time capabilities:

1. Live congestion updates on graph edges (simulated traffic feed)
2. Vehicles actually moving along their routes on the map
3. Dynamic rerouting — if congestion spikes mid-route, QPSO reruns
4. WebSocket connection between backend and frontend for live data push
5. A live traffic heatmap overlay on the Fleet Map
6. Real-time metrics updating as vehicles move (distance remaining, ETA, load)

This does NOT rebuild the app from scratch.
It layers real-time behaviour on top of what already exists.

---

## STACK ADDITIONS

Backend additions:
- `websockets` library (FastAPI native WebSocket support)
- `asyncio` for the traffic simulation loop
- `apscheduler` for periodic congestion updates

Frontend additions:
- Native browser WebSocket API (no socket.io — keep it simple)
- useWebSocket custom React hook
- Leaflet vehicle marker animation (already using Leaflet for the map)

```
pip install apscheduler==3.10.4
```

---

## BACKEND ADDITIONS

### New file: core/simulation/traffic_engine.py

```python
import asyncio
import random
import time
import numpy as np
from typing import Dict, List, Callable, Optional

class TrafficEngine:
    """
    Simulates real-time traffic congestion on graph edges.
    
    Every tick_interval seconds:
    - Randomly selects 2-4 edges to change congestion
    - Congestion factor: 1.0 (free flow) to 3.0 (heavy jam)
    - Broadcasts updated edge weights to all connected WebSocket clients
    - Triggers dynamic rerouting if any route edge congestion > threshold
    
    In production: replace _generate_tick() with a real traffic API
    (Google Maps Traffic, HERE, TomTom) or SUMO simulator output.
    """

    def __init__(self, graph, tick_interval: float = 5.0,
                 reroute_threshold: float = 2.0):
        self.graph = graph
        self.tick_interval = tick_interval       # seconds between updates
        self.reroute_threshold = reroute_threshold
        self.running = False
        self.congestion_state: Dict[str, float] = {}  # "i->j": factor
        self.subscribers: List[Callable] = []
        self._init_congestion()

    def _init_congestion(self):
        """Start all edges at free-flow (1.0)."""
        for u, v in self.graph.G.edges():
            key = f"{u}->{v}"
            self.congestion_state[key] = 1.0

    def subscribe(self, callback: Callable):
        """Frontend WebSocket handlers subscribe here."""
        self.subscribers.append(callback)

    def unsubscribe(self, callback: Callable):
        if callback in self.subscribers:
            self.subscribers.remove(callback)

    async def start(self):
        self.running = True
        while self.running:
            await asyncio.sleep(self.tick_interval)
            updates = self._generate_tick()
            self._apply_updates(updates)
            await self._broadcast(updates)

    def stop(self):
        self.running = False

    def _generate_tick(self) -> List[dict]:
        """
        Generate realistic traffic pattern:
        - Most edges: slight random drift around current value
        - 2-3 edges: sudden spike (incident simulation)
        - 1-2 edges: congestion clearing (recovery)
        """
        edges = list(self.graph.G.edges())
        updates = []

        # Gradual drift on all edges
        for u, v in edges:
            key = f"{u}->{v}"
            current = self.congestion_state[key]
            drift = random.gauss(0, 0.05)
            new_val = float(np.clip(current + drift, 1.0, 3.0))
            if abs(new_val - current) > 0.02:  # only send meaningful changes
                updates.append({
                    "type": "congestion_update",
                    "edge": {"from": u, "to": v},
                    "factor": round(new_val, 3),
                    "timestamp": time.time()
                })

        # Spike 2-3 random edges (incident)
        spike_edges = random.sample(edges, min(3, len(edges)))
        for u, v in spike_edges:
            key = f"{u}->{v}"
            spike = random.uniform(1.5, 3.0)
            self.congestion_state[key] = spike
            updates.append({
                "type": "congestion_spike",
                "edge": {"from": u, "to": v},
                "factor": round(spike, 3),
                "severity": "high" if spike > 2.5 else "medium",
                "timestamp": time.time()
            })

        # Clear 1-2 edges (recovery)
        clear_edges = random.sample(edges, min(2, len(edges)))
        for u, v in clear_edges:
            key = f"{u}->{v}"
            self.congestion_state[key] = random.uniform(1.0, 1.2)
            updates.append({
                "type": "congestion_clear",
                "edge": {"from": u, "to": v},
                "factor": round(self.congestion_state[key], 3),
                "timestamp": time.time()
            })

        return updates

    def _apply_updates(self, updates: List[dict]):
        for update in updates:
            u = update["edge"]["from"]
            v = update["edge"]["to"]
            factor = update["factor"]
            key = f"{u}->{v}"
            self.congestion_state[key] = factor
            self.graph.update_congestion(u, v, factor)

    async def _broadcast(self, updates: List[dict]):
        payload = {
            "type": "traffic_update",
            "updates": updates,
            "full_state": {
                k: v for k, v in self.congestion_state.items()
            }
        }
        dead = []
        for callback in self.subscribers:
            try:
                await callback(payload)
            except Exception:
                dead.append(callback)
        for d in dead:
            self.unsubscribe(d)

    def needs_reroute(self, current_routes: List[List[int]]) -> bool:
        """
        Check if any edge on the current routes has congestion
        above the reroute threshold. If yes, trigger new QPSO run.
        """
        for route in current_routes:
            for k in range(len(route) - 1):
                u, v = route[k], route[k+1]
                key = f"{u}->{v}"
                if self.congestion_state.get(key, 1.0) > self.reroute_threshold:
                    return True
        return False
```

---

### New file: core/simulation/vehicle_tracker.py

```python
import time
import asyncio
import numpy as np
from typing import List, Dict, Callable

class VehicleTracker:
    """
    Tracks real-time position of each vehicle along its assigned route.
    
    Each vehicle moves from node to node along its route.
    Position is interpolated between nodes based on elapsed time and
    current edge travel time (updated by traffic engine).
    
    Broadcasts position updates every position_interval seconds.
    """

    def __init__(self, routes: List[List[int]], graph,
                 position_interval: float = 1.0,
                 speed_multiplier: float = 1.0):
        self.routes = routes
        self.graph = graph
        self.position_interval = position_interval
        self.speed_multiplier = speed_multiplier
        self.running = False
        self.subscribers: List[Callable] = []

        # Vehicle state
        self.vehicles = self._init_vehicles()

    def _init_vehicles(self) -> List[dict]:
        vehicles = []
        nodes = self.graph.nodes

        for k, route in enumerate(self.routes):
            if len(route) < 2:
                continue
            start_node = nodes[route[0]]
            vehicles.append({
                "id": k + 1,
                "route": route,
                "current_edge_idx": 0,      # which edge in route we're on
                "edge_progress": 0.0,        # 0.0 to 1.0 along current edge
                "lat": start_node.y,
                "lng": start_node.x,
                "status": "moving",          # moving | arrived | waiting
                "stops_completed": 0,
                "total_stops": len(route) - 2,  # exclude depot at start/end
                "distance_remaining": self._total_distance(route),
                "load": sum(
                    nodes[n].demand for n in route
                    if n != route[0]          # exclude depot
                ),
                "eta_seconds": self._estimate_eta(route),
            })
        return vehicles

    def _total_distance(self, route: List[int]) -> float:
        return sum(
            self.graph.distance(route[i], route[i+1])
            for i in range(len(route)-1)
        )

    def _estimate_eta(self, route: List[int]) -> float:
        return sum(
            self.graph.travel_time(route[i], route[i+1])
            for i in range(len(route)-1)
        )

    def subscribe(self, callback: Callable):
        self.subscribers.append(callback)

    def unsubscribe(self, callback: Callable):
        if callback in self.subscribers:
            self.subscribers.remove(callback)

    async def start(self):
        self.running = True
        last_tick = time.time()

        while self.running:
            await asyncio.sleep(self.position_interval)
            now = time.time()
            dt = (now - last_tick) * self.speed_multiplier
            last_tick = now

            self._advance_vehicles(dt)
            await self._broadcast_positions()

            # Stop if all vehicles arrived
            if all(v["status"] == "arrived" for v in self.vehicles):
                self.running = False

    def _advance_vehicles(self, dt: float):
        nodes = self.graph.nodes

        for vehicle in self.vehicles:
            if vehicle["status"] == "arrived":
                continue

            route = vehicle["route"]
            edge_idx = vehicle["current_edge_idx"]

            if edge_idx >= len(route) - 1:
                vehicle["status"] = "arrived"
                continue

            u = route[edge_idx]
            v = route[edge_idx + 1]

            edge_time = self.graph.travel_time(u, v)
            if edge_time <= 0:
                edge_time = 1.0

            # How much progress do we make this tick
            progress_per_second = 1.0 / edge_time
            vehicle["edge_progress"] += dt * progress_per_second

            if vehicle["edge_progress"] >= 1.0:
                # Arrived at next node
                vehicle["edge_progress"] = 0.0
                vehicle["current_edge_idx"] += 1
                vehicle["stops_completed"] += 1
                vehicle["distance_remaining"] -= self.graph.distance(u, v)
                vehicle["distance_remaining"] = max(
                    0.0, vehicle["distance_remaining"]
                )

                if vehicle["current_edge_idx"] >= len(route) - 1:
                    vehicle["status"] = "arrived"
                    vehicle["lat"] = nodes[v].y
                    vehicle["lng"] = nodes[v].x
                    continue

                edge_idx = vehicle["current_edge_idx"]
                u = route[edge_idx]
                vehicle["lat"] = nodes[u].y
                vehicle["lng"] = nodes[u].x
            else:
                # Interpolate position between u and v
                u_node = nodes[u]
                v_node = nodes[v]
                p = vehicle["edge_progress"]
                vehicle["lat"] = u_node.y + p * (v_node.y - u_node.y)
                vehicle["lng"] = u_node.x + p * (v_node.x - u_node.x)

    async def _broadcast_positions(self):
        payload = {
            "type": "vehicle_positions",
            "vehicles": [
                {
                    "id": v["id"],
                    "lat": v["lat"],
                    "lng": v["lng"],
                    "status": v["status"],
                    "stops_completed": v["stops_completed"],
                    "total_stops": v["total_stops"],
                    "distance_remaining": round(v["distance_remaining"], 2),
                    "eta_seconds": round(v["eta_seconds"], 0),
                }
                for v in self.vehicles
            ],
            "timestamp": time.time()
        }
        dead = []
        for callback in self.subscribers:
            try:
                await callback(payload)
            except Exception:
                dead.append(callback)
        for d in dead:
            self.unsubscribe(d)

    def update_routes(self, new_routes: List[List[int]]):
        """Called when QPSO rereroutes due to congestion."""
        for k, vehicle in enumerate(self.vehicles):
            if k < len(new_routes) and vehicle["status"] == "moving":
                current_node_idx = vehicle["current_edge_idx"]
                old_route = vehicle["route"]

                # Keep completed portion, replace remainder
                if current_node_idx < len(old_route):
                    current_node = old_route[current_node_idx]
                    new_route = new_routes[k]

                    # Find current node in new route
                    if current_node in new_route:
                        idx = new_route.index(current_node)
                        vehicle["route"] = (
                            old_route[:current_node_idx + 1]
                            + new_route[idx + 1:]
                        )
                        vehicle["distance_remaining"] = sum(
                            self.graph.distance(
                                vehicle["route"][i],
                                vehicle["route"][i+1]
                            )
                            for i in range(
                                current_node_idx,
                                len(vehicle["route"]) - 1
                            )
                        )
```

---

### New file: api/routes/realtime.py

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
import asyncio
import json
from typing import Dict, Any

router = APIRouter(tags=["realtime"])

# Store active simulation sessions
# session_id -> { traffic_engine, vehicle_tracker, task }
active_sessions: Dict[str, dict] = {}

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    print(f"WebSocket connected: session {session_id}")

    async def send_to_client(payload: dict):
        """Callback registered with TrafficEngine and VehicleTracker."""
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_json(payload)

    # Register this client with existing session if running
    session = active_sessions.get(session_id)
    if session:
        session["traffic_engine"].subscribe(send_to_client)
        session["vehicle_tracker"].subscribe(send_to_client)
        await websocket.send_json({
            "type": "session_joined",
            "session_id": session_id,
            "message": "Joined existing simulation session"
        })

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            await handle_message(
                message, session_id, websocket, send_to_client
            )

    except WebSocketDisconnect:
        print(f"WebSocket disconnected: session {session_id}")
        if session:
            session["traffic_engine"].unsubscribe(send_to_client)
            session["vehicle_tracker"].unsubscribe(send_to_client)


async def handle_message(message: dict, session_id: str,
                          websocket: WebSocket, send_callback):
    """
    Handle messages from frontend:

    { type: "start_simulation", network: {...}, routes: [...], speed: 1.0 }
    { type: "stop_simulation" }
    { type: "set_speed", multiplier: 2.0 }
    { type: "force_reroute" }
    { type: "ping" }
    """
    from core.graph.transport_graph import TransportGraph
    from core.simulation.traffic_engine import TrafficEngine
    from core.simulation.vehicle_tracker import VehicleTracker
    from api.schemas.network import NodeSchema, EdgeSchema

    msg_type = message.get("type")

    if msg_type == "ping":
        await websocket.send_json({"type": "pong"})

    elif msg_type == "start_simulation":
        # Stop any existing session
        if session_id in active_sessions:
            old = active_sessions[session_id]
            old["traffic_engine"].stop()
            old["vehicle_tracker"].stop()
            if old.get("task"):
                old["task"].cancel()

        # Build graph
        network_data = message["network"]
        nodes = [NodeSchema(**n) for n in network_data["nodes"]]
        edges = [EdgeSchema(**e) for e in network_data.get("edges", [])] or None
        graph = TransportGraph(nodes, edges)

        routes = message["routes"]
        speed = float(message.get("speed", 1.0))

        # Init engines
        traffic_engine = TrafficEngine(
            graph,
            tick_interval=5.0,
            reroute_threshold=2.0
        )
        vehicle_tracker = VehicleTracker(
            routes, graph,
            position_interval=1.0,
            speed_multiplier=speed
        )

        # Subscribe send callback
        traffic_engine.subscribe(send_callback)
        vehicle_tracker.subscribe(send_callback)

        # Start both loops as background tasks
        traffic_task = asyncio.create_task(traffic_engine.start())
        vehicle_task = asyncio.create_task(vehicle_tracker.start())

        active_sessions[session_id] = {
            "traffic_engine": traffic_engine,
            "vehicle_tracker": vehicle_tracker,
            "graph": graph,
            "routes": routes,
            "tasks": [traffic_task, vehicle_task]
        }

        await websocket.send_json({
            "type": "simulation_started",
            "session_id": session_id,
            "num_vehicles": len(routes),
            "tick_interval": 5.0
        })

    elif msg_type == "stop_simulation":
        session = active_sessions.get(session_id)
        if session:
            session["traffic_engine"].stop()
            session["vehicle_tracker"].stop()
            for task in session.get("tasks", []):
                task.cancel()
            del active_sessions[session_id]
        await websocket.send_json({"type": "simulation_stopped"})

    elif msg_type == "set_speed":
        session = active_sessions.get(session_id)
        if session:
            session["vehicle_tracker"].speed_multiplier = float(
                message.get("multiplier", 1.0)
            )
        await websocket.send_json({
            "type": "speed_updated",
            "multiplier": message.get("multiplier")
        })

    elif msg_type == "force_reroute":
        session = active_sessions.get(session_id)
        if session:
            await _trigger_reroute(session, websocket, send_callback)

    elif msg_type == "update_congestion":
        # Manual congestion injection from frontend
        session = active_sessions.get(session_id)
        if session:
            u = message["from"]
            v = message["to"]
            factor = float(message["factor"])
            session["graph"].update_congestion(u, v, factor)
            await websocket.send_json({
                "type": "congestion_applied",
                "edge": {"from": u, "to": v},
                "factor": factor
            })


async def _trigger_reroute(session: dict, websocket: WebSocket,
                            send_callback):
    """Run QPSO on current graph state and push new routes."""
    from core.vrp.codec import SolutionCodec
    from core.vrp.fitness import FitnessEvaluator
    from core.algorithms.qpso import QPSO

    graph = session["graph"]
    current_routes = session["routes"]

    # Quick QPSO run with fewer iterations for speed
    codec = SolutionCodec(graph, depot_id=0, num_vehicles=3,
                          vehicle_capacity=60)
    evaluator = FitnessEvaluator(graph, depot_id=0)
    optimizer = QPSO(
        graph, codec, evaluator, vehicle_capacity=60,
        swarm_size=30,
        max_iterations=100,    # fast reroute run
        beta_start=1.0,
        beta_end=0.5
    )
    result = optimizer.optimize()

    new_routes = result.best_routes
    session["routes"] = new_routes

    # Update vehicle tracker with new routes
    session["vehicle_tracker"].update_routes(new_routes)

    await websocket.send_json({
        "type": "reroute_complete",
        "new_routes": new_routes,
        "new_fitness": result.best_fitness,
        "reason": "congestion_threshold_exceeded"
    })
```

---

### Update main.py — add WebSocket router

```python
# Add this line with the other router imports
from api.routes.realtime import router as realtime_router

# Add this line with the other app.include_router() calls
app.include_router(realtime_router)
```

---

## FRONTEND ADDITIONS

### New file: src/hooks/useWebSocket.js

```js
import { useEffect, useRef, useCallback, useState } from 'react'

const WS_URL = 'ws://localhost:8000/ws'

export function useWebSocket(sessionId) {
  const ws = useRef(null)
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)
  const handlers = useRef({})

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return

    ws.current = new WebSocket(`${WS_URL}/${sessionId}`)

    ws.current.onopen = () => {
      setConnected(true)
      console.log('WebSocket connected')
      // Keepalive ping every 30s
      const ping = setInterval(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'ping' }))
        }
      }, 30000)
      ws.current._ping = ping
    }

    ws.current.onclose = () => {
      setConnected(false)
      clearInterval(ws.current?._ping)
      // Reconnect after 2s
      setTimeout(connect, 2000)
    }

    ws.current.onerror = (err) => {
      console.error('WebSocket error:', err)
    }

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      setLastMessage(msg)
      // Dispatch to registered type handlers
      const handler = handlers.current[msg.type]
      if (handler) handler(msg)
    }
  }, [sessionId])

  const disconnect = useCallback(() => {
    clearInterval(ws.current?._ping)
    ws.current?.close()
  }, [])

  const send = useCallback((message) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
    }
  }, [])

  const on = useCallback((type, handler) => {
    handlers.current[type] = handler
  }, [])

  const off = useCallback((type) => {
    delete handlers.current[type]
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect])

  return { connected, lastMessage, send, on, off }
}
```

---

### New file: src/hooks/useSimulation.js

```js
import { useState, useCallback, useRef } from 'react'
import { useWebSocket } from './useWebSocket'

export function useSimulation(sessionId) {
  const { connected, send, on, off } = useWebSocket(sessionId)

  const [simRunning, setSimRunning] = useState(false)
  const [vehiclePositions, setVehiclePositions] = useState([])
  const [congestionState, setCongestionState] = useState({})
  const [rerouting, setRerouting] = useState(false)
  const [rerouteCount, setRerouteCount] = useState(0)
  const [simSpeed, setSimSpeedState] = useState(1)

  // Register WebSocket message handlers
  on('vehicle_positions', (msg) => {
    setVehiclePositions(msg.vehicles)
  })

  on('traffic_update', (msg) => {
    setCongestionState(msg.full_state)
  })

  on('reroute_complete', (msg) => {
    setRerouting(false)
    setRerouteCount(c => c + 1)
    // Caller can listen to this via onReroute prop
    if (onRerouteRef.current) onRerouteRef.current(msg)
  })

  on('simulation_started', () => setSimRunning(true))
  on('simulation_stopped', () => setSimRunning(false))

  const onRerouteRef = useRef(null)
  const onReroute = useCallback((fn) => {
    onRerouteRef.current = fn
  }, [])

  const startSimulation = useCallback((network, routes, speed = 1) => {
    send({
      type: 'start_simulation',
      network,
      routes,
      speed
    })
  }, [send])

  const stopSimulation = useCallback(() => {
    send({ type: 'stop_simulation' })
  }, [send])

  const setSpeed = useCallback((multiplier) => {
    setSimSpeedState(multiplier)
    send({ type: 'set_speed', multiplier })
  }, [send])

  const forceReroute = useCallback(() => {
    setRerouting(true)
    send({ type: 'force_reroute' })
  }, [send])

  const injectCongestion = useCallback((fromNode, toNode, factor) => {
    send({
      type: 'update_congestion',
      from: fromNode,
      to: toNode,
      factor
    })
  }, [send])

  return {
    connected,
    simRunning,
    vehiclePositions,
    congestionState,
    rerouting,
    rerouteCount,
    simSpeed,
    startSimulation,
    stopSimulation,
    setSpeed,
    forceReroute,
    injectCongestion,
    onReroute
  }
}
```

---

### Update: Fleet Map component additions

Add these to your existing Fleet Map (Screen 2):

```js
// In your FleetMap component — add these imports
import { useSimulation } from '../hooks/useSimulation'
import { useEffect, useRef } from 'react'
import L from 'leaflet'

// Inside FleetMap component:
const sim = useSimulation('quantaroute-session-1')

// Start simulation when routes are available
useEffect(() => {
  if (routes && routes.length > 0 && network) {
    sim.startSimulation(network, routes, 1.0)
  }
  return () => sim.stopSimulation()
}, [routes])

// Update vehicle markers on position change
useEffect(() => {
  if (!mapRef.current) return
  
  sim.vehiclePositions.forEach(vehicle => {
    const markerId = `vehicle-${vehicle.id}`
    
    if (!vehicleMarkersRef.current[markerId]) {
      // Create marker first time
      vehicleMarkersRef.current[markerId] = L.marker(
        [vehicle.lat, vehicle.lng],
        { icon: createVehicleIcon(vehicle.id) }
      )
      .bindTooltip(`V${vehicle.id}`, { permanent: true, direction: 'top' })
      .addTo(mapRef.current)
    } else {
      // Smooth animated move
      vehicleMarkersRef.current[markerId].setLatLng(
        [vehicle.lat, vehicle.lng]
      )
    }
  })
}, [sim.vehiclePositions])

// Update edge colours based on congestion
useEffect(() => {
  if (!edgeLinesRef.current) return
  
  Object.entries(sim.congestionState).forEach(([key, factor]) => {
    const line = edgeLinesRef.current[key]
    if (line) {
      line.setStyle({ color: congestionColor(factor) })
    }
  })
}, [sim.congestionState])

// Helper: colour based on congestion factor
function congestionColor(factor) {
  if (factor < 1.3) return '#3ABA7A'   // free flow — green
  if (factor < 1.8) return '#C8F04A'   // light — accent
  if (factor < 2.3) return '#F59E0B'   // moderate — amber
  return '#E85D3A'                       // heavy — red
}
```

---

### New UI elements to add to Screen 2 (Fleet Map)

**1. Connection status indicator — top right of map canvas:**
```jsx
<div style={{
  position: 'absolute', top: 12, right: 12, zIndex: 1000,
  fontFamily: 'var(--font-mono)', fontSize: 11,
  color: sim.connected ? 'var(--success)' : 'var(--alert)',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  padding: '4px 8px',
  borderRadius: 'var(--radius)'
}}>
  {sim.connected ? '● LIVE' : '○ CONNECTING'}
</div>
```

**2. Replace the static "Traffic Congestion Overlay" toggle with:**
```jsx
<div>
  <span style={{ fontFamily: 'var(--font-body)', fontSize: 11,
                 color: 'var(--muted)' }}>
    Congestion Overlay
  </span>
  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
                 color: 'var(--accent)', marginLeft: 8 }}>
    LIVE
  </span>
</div>
/* No toggle — it's always on when WebSocket is connected */
```

**3. Reroute counter in right panel below vehicle list:**
```jsx
{sim.rerouteCount > 0 && (
  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12,
                marginTop: 12 }}>
    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11,
                   color: 'var(--muted)' }}>
      Dynamic reroutes triggered
    </span>
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14,
                   color: 'var(--accent)', display: 'block',
                   marginTop: 4 }}>
      {sim.rerouteCount}
    </span>
  </div>
)}

{sim.rerouting && (
  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
                color: 'var(--muted)', marginTop: 8 }}>
    Recomputing routes...
  </div>
)}
```

**4. Manual congestion injection button — for demo purposes:**
```jsx
<button
  onClick={() => {
    // Pick a random edge and spike it for demo
    const randomEdge = edges[Math.floor(Math.random() * edges.length)]
    sim.injectCongestion(randomEdge.from_node, randomEdge.to_node, 2.8)
  }}
  style={{
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--muted)',
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    padding: '6px 12px',
    cursor: 'pointer',
    borderRadius: 'var(--radius)',
    marginTop: 12,
    width: '100%'
  }}
>
  Simulate Traffic Incident
</button>
```

---

## WEBSOCKET MESSAGE TYPES — FULL REFERENCE

```
Frontend → Backend:
  start_simulation    start traffic engine + vehicle tracker
  stop_simulation     stop and clean up session
  set_speed           change vehicle movement speed (1x / 2x / 5x)
  force_reroute       manually trigger QPSO recompute
  update_congestion   inject manual congestion on a specific edge
  ping                keepalive

Backend → Frontend:
  simulation_started  confirmation with session details
  simulation_stopped  confirmation
  vehicle_positions   lat/lng of all vehicles (every 1s)
  traffic_update      full congestion state + changed edges (every 5s)
  congestion_spike    specific high-congestion event
  congestion_clear    edge returning to free flow
  reroute_complete    new routes after QPSO rerun
  speed_updated       confirmation of speed change
  congestion_applied  confirmation of manual injection
  pong                keepalive response
```

---

## WHAT THIS LOOKS LIKE IN THE DEMO

1. Judge opens Fleet Map tab
2. Vehicles V1, V2, V3 start moving from depot along their routes
3. Every 5 seconds some edges on the map change colour:
   green → yellow → amber → red (congestion building)
4. When a route edge hits red (factor > 2.0), status bar shows
   "Recomputing routes..."
5. After ~2 seconds QPSO reruns and vehicles adjust their paths
6. Right panel shows "Dynamic reroutes triggered: 2"
7. Judge clicks "Simulate Traffic Incident" — one edge spikes to red instantly,
   reroute triggers within 3 seconds
8. Carbon savings and distance metrics update in real time

This is the moment that wins the demo.

---

## DEFINITION OF DONE

1. WebSocket connects on page load — shows LIVE indicator
2. Vehicles move smoothly along routes on the map
3. Edge colours update every 5 seconds based on congestion
4. Automatic reroute triggers when congestion > 2.0 on any active route edge
5. Manual "Simulate Traffic Incident" button triggers visible reroute
6. Speed controls (1x / 2x / 5x) change how fast vehicles move
7. Reroute counter increments correctly
8. WebSocket reconnects automatically if connection drops
9. No memory leaks — cleanup on component unmount
