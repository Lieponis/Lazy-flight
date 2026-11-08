// The warp tunnel: streaking stars plus a few rings flying past. Very cheap:
// the lines are built once and never rebuilt; each frame only two or three groups slide along.
// Two copies of the streaks are placed end to end, so when one slides out the other is already there (seamless loop).

import * as THREE from "three";
import { tunnelStreakData } from "./helpers";
import { TUNNEL_RINGS, TUNNEL_SPEED, TUNNEL_STREAKS } from "./settings";

const SPAN = 120; // length of one copy of the tunnel
const TINTS = [0xffffff, 0x7fe7ff, 0xb18cff, 0xff8fd0];

export interface Tunnel {
  group: THREE.Group;
  /** Call every frame with the time in seconds. */
  update(seconds: number): void;
}

export function buildTunnel(): Tunnel {
  const group = new THREE.Group();

  // Streaks: dim at the tail end, bright at the front end (z grows towards the camera).
  const { positions, tints } = tunnelStreakData(TUNNEL_STREAKS, SPAN, 3, 15, 4, 10);
  const colors = new Float32Array(TUNNEL_STREAKS * 6);
  const c = new THREE.Color();
  for (let i = 0; i < TUNNEL_STREAKS; i++) {
    c.setHex(TINTS[tints[i] ?? 0] ?? 0xffffff);
    colors.set([c.r * 0.12, c.g * 0.12, c.b * 0.12, c.r, c.g, c.b], i * 6);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({ vertexColors: true });
  const streaksA = new THREE.LineSegments(geometry, material);
  const streaksB = new THREE.LineSegments(geometry, material);
  streaksA.frustumCulled = false;
  streaksB.frustumCulled = false;
  group.add(streaksA, streaksB);

  // Rings: octagons spaced evenly; the whole set slides one gap and starts over.
  const gap = SPAN / TUNNEL_RINGS;
  const rings = new THREE.Group();
  const ringMaterial = new THREE.LineBasicMaterial({ color: 0x4a3aa8 });
  const ringPoints: THREE.Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    ringPoints.push(new THREE.Vector3(Math.cos(a) * 11, Math.sin(a) * 11, 0));
  }
  const ringGeometry = new THREE.BufferGeometry().setFromPoints(ringPoints);
  for (let i = 0; i < TUNNEL_RINGS + 2; i++) {
    const ring = new THREE.LineLoop(ringGeometry, ringMaterial);
    ring.position.z = -i * gap;
    ring.frustumCulled = false;
    rings.add(ring);
  }
  group.add(rings);

  return {
    group,
    update(seconds: number): void {
      const travel = seconds * TUNNEL_SPEED;
      const offset = travel % SPAN;
      streaksA.position.z = offset;
      streaksB.position.z = offset - SPAN;
      rings.position.z = travel % gap;
    },
  };
}
