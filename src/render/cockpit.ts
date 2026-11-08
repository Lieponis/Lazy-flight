// The cockpit frame: plain dark struts and a dashboard block drawn over the view. Simple geometry, not art.
// It is built from flat boxes and re-laid out whenever the window shape changes, so it hugs the edges of
// ANY window: wide, square or tall phone (the side pillars get thinner in tall windows).

import * as THREE from "three";

interface Piece {
  mesh: THREE.Mesh;
}

function box(hex: number, order: number): Piece {
  const material = new THREE.MeshBasicMaterial({ color: hex, depthTest: false, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.renderOrder = 900 + order; // always drawn on top of the world
  mesh.frustumCulled = false;
  return { mesh };
}

export interface Cockpit {
  /** Add this to the camera (the frame sits 1 unit in front of it). */
  group: THREE.Group;
  /** Call when the window shape or field of view changes. */
  layout(aspect: number, fovDegrees: number): void;
}

export function buildCockpit(): Cockpit {
  const group = new THREE.Group();
  group.position.z = -1;

  const dash = box(0x1a2040, 1);
  const dashEdge = box(0x3a4590, 2);
  const left = box(0x151a33, 3);
  const right = box(0x151a33, 3);
  const top = box(0x151a33, 3);
  const diagLeft = box(0x151a33, 3);
  const diagRight = box(0x151a33, 3);
  const screen = box(0x0b3a3a, 4);
  const lights = [box(0x5dff7a, 5), box(0xffb347, 5), box(0x7fe7ff, 5)];
  const all = [dash, dashEdge, left, right, top, diagLeft, diagRight, screen, ...lights];
  for (const piece of all) group.add(piece.mesh);

  function place(piece: Piece, x: number, y: number, w: number, h: number, angle = 0): void {
    piece.mesh.position.set(x, y, 0);
    piece.mesh.scale.set(w, h, 0.001);
    piece.mesh.rotation.z = angle;
  }

  function strut(piece: Piece, x1: number, y1: number, x2: number, y2: number, thickness: number): void {
    place(piece, (x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(x2 - x1, y2 - y1), thickness, Math.atan2(y2 - y1, x2 - x1));
  }

  function layout(aspect: number, fovDegrees: number): void {
    const hh = Math.tan((fovDegrees * Math.PI) / 360); // half the visible height at distance 1
    const hw = hh * aspect;
    const dashH = 0.3 * hh; // dashboard = bottom 15% of the window
    const pillar = Math.min(0.12 * hw, 0.16 * hh);
    place(dash, 0, -hh + dashH / 2, 2 * hw + 0.01, dashH);
    place(dashEdge, 0, -hh + dashH, 2 * hw + 0.01, 0.03 * hh);
    place(left, -hw + pillar / 2, 0, pillar, 2 * hh + 0.01);
    place(right, hw - pillar / 2, 0, pillar, 2 * hh + 0.01);
    place(top, 0, hh - 0.035 * hh, 2 * hw + 0.01, 0.07 * hh);
    strut(diagLeft, -hw + pillar, hh, -0.62 * hw, -hh + dashH, 0.035 * hh);
    strut(diagRight, hw - pillar, hh, 0.62 * hw, -hh + dashH, 0.035 * hh);
    const dashMid = -hh + dashH / 2;
    place(screen, -0.45 * hw, dashMid, Math.min(0.3 * hw, 0.55 * hh), 0.16 * hh);
    const lightSize = 0.045 * hh;
    lights.forEach((light, i) => place(light, (0.15 + i * 0.12) * hw * 0.9, dashMid, lightSize, lightSize));
  }

  layout(16 / 9, 50);
  return { group, layout };
}
