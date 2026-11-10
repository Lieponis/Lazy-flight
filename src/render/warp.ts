// THE WARP (replaces the old tunnel with rings). Dense stars shoot past as trails of random lengths and speeds, in three colours
// (blue, purple, violet) that slowly change tone and strength. Styles (Andy picks):
//   A: the stars only.
//   B: the stars plus soft glowing haze drifting behind them (closest to the reference picture).
//   C: B plus surges every so often (trails stretch, stars speed up, colours brighten) and a gentle swirl.
// The stars move inside the vertex shader (the lines are built once and never rebuilt), so a trip of an hour costs the same
// per frame as the first second, and nothing grows in memory.

import * as THREE from "three";
import { WARP_AHEAD, WARP_BEHIND, WARP_HAZE_COUNT, WARP_HAZE_DISTANCE, WARP_RADIUS_MAX, WARP_RADIUS_MIN, WARP_SPAN, WARP_SPEED, WARP_STREAKS } from "./settings";
import { warpIntensity, warpPalette, warpPulse, warpStreakData, type WarpStyle } from "./warpmath";

export interface Warp {
  group: THREE.Group;
  /** Call every frame with the time in seconds since the flight began. */
  update(seconds: number): void;
  setStyle(style: WarpStyle): void;
  dispose(): void;
}

const VERTEX = `
  uniform float uPhase; uniform float uSpan; uniform float uAhead; uniform float uBehind; uniform float uPulse; uniform float uTwist; uniform float uIntensity;
  uniform vec3 uCol0; uniform vec3 uCol1; uniform vec3 uCol2;
  attribute float aEnd; attribute float aSpeed; attribute float aLen; attribute float aTint; attribute float aBright;
  varying vec3 vColor;
  void main() {
    float z = mod(position.z + uPhase * aSpeed, uSpan);   // how far along its run this star is
    float zz = z - uAhead;                                 // from far ahead of the ship, past it, to far behind it
    float head = zz;                                       // the head end leads, the tail trails behind it
    // Trails stretch the further they are past the ship, so looking back from the orbit camera the streaks run on long and fast.
    float len = aLen * (1.0 + uPulse * 1.6) * (1.0 + max(head, 0.0) * 0.05);
    float zv = head - (1.0 - aEnd) * len;
    float a = uTwist * zv;
    float ca = cos(a); float sa = sin(a);
    vec3 p = vec3(position.x * ca - position.y * sa, position.x * sa + position.y * ca, zv);
    vec3 col = aTint < 0.5 ? mix(uCol0, uCol1, aTint * 2.0) : mix(uCol1, uCol2, (aTint - 0.5) * 2.0);
    float far = smoothstep(-uAhead, -uAhead * 0.35, head) * (1.0 - smoothstep(uBehind * 0.45, uBehind, head)); // dim far ahead and far behind
    float tail = mix(0.08, 1.0, aEnd);                     // dim at the tail, bright at the head
    vColor = col * aBright * far * tail * uIntensity * (1.0 + uPulse * 0.9);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const FRAGMENT = `
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
    #include <colorspace_fragment>
  }`;

/** A soft round glow (a cloud, not a shape): white in the middle fading to nothing. */
function glowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildWarp(initial: WarpStyle = "B"): Warp {
  const group = new THREE.Group();
  let style: WarpStyle = initial;

  // --- the stars
  const data = warpStreakData(WARP_STREAKS, WARP_SPAN, WARP_RADIUS_MIN, WARP_RADIUS_MAX);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute("aEnd", new THREE.BufferAttribute(data.end, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(data.speed, 1));
  geometry.setAttribute("aLen", new THREE.BufferAttribute(data.length, 1));
  geometry.setAttribute("aTint", new THREE.BufferAttribute(data.tint, 1));
  geometry.setAttribute("aBright", new THREE.BufferAttribute(data.bright, 1));
  const uniforms = {
    uPhase: { value: 0 },
    uSpan: { value: WARP_SPAN },
    uAhead: { value: WARP_AHEAD },
    uBehind: { value: WARP_BEHIND },
    uPulse: { value: 0 },
    uTwist: { value: 0 },
    uIntensity: { value: 1 },
    uCol0: { value: new THREE.Color() },
    uCol1: { value: new THREE.Color() },
    uCol2: { value: new THREE.Color() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const stars = new THREE.LineSegments(geometry, material);
  stars.frustumCulled = false;
  group.add(stars);

  // --- the haze (styles B and C)
  const texture = glowTexture();
  const haze: { sprite: THREE.Sprite; base: THREE.Vector3; k: number }[] = [];
  const hazeGroup = new THREE.Group();
  for (let i = 0; i < WARP_HAZE_COUNT; i++) {
    const material2 = new THREE.SpriteMaterial({ map: texture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3 });
    const sprite = new THREE.Sprite(material2);
    // Spread evenly over a whole sphere (a spiral), so there is haze ahead, behind, above and below the ship.
    const y = 1 - (2 * (i + 0.5)) / WARP_HAZE_COUNT;
    const ring = Math.sqrt(1 - y * y);
    const theta = i * 2.399963;
    const distance = WARP_HAZE_DISTANCE + (i % 3) * 22;
    const size = 70 + ((i * 37) % 50);
    const base = new THREE.Vector3(Math.cos(theta) * ring, y, Math.sin(theta) * ring).multiplyScalar(distance);
    sprite.position.copy(base);
    sprite.scale.set(size, size, 1);
    hazeGroup.add(sprite);
    haze.push({ sprite, base, k: i });
  }
  group.add(hazeGroup);

  const colour = new THREE.Color();
  let phase = 0;
  let last = -1;

  function applyStyle(): void {
    hazeGroup.visible = style !== "A";
  }
  applyStyle();

  return {
    group,
    update(seconds: number): void {
      const dt = last < 0 ? 0 : Math.min(0.1, Math.max(0, seconds - last));
      last = seconds;
      const pulse = style === "C" ? warpPulse(seconds) : 0;
      phase += dt * WARP_SPEED * (1 + pulse * 0.7); // the surge speeds the stars up without any jump
      const [c0, c1, c2] = warpPalette(seconds);
      uniforms.uCol0.value.setHSL(c0.h, c0.s, c0.l);
      uniforms.uCol1.value.setHSL(c1.h, c1.s, c1.l);
      uniforms.uCol2.value.setHSL(c2.h, c2.s, c2.l);
      uniforms.uPhase.value = phase;
      uniforms.uPulse.value = pulse;
      uniforms.uIntensity.value = warpIntensity(seconds);
      uniforms.uTwist.value = style === "C" ? 0.004 * Math.sin(seconds / 19) : style === "B" ? 0.0015 * Math.sin(seconds / 31) : 0;
      if (style !== "A") {
        const palette = [c0, c1, c2];
        for (const h of haze) {
          const c = palette[h.k % 3]!;
          colour.setHSL(c.h, c.s, c.l * 0.8);
          const m = h.sprite.material;
          m.color.copy(colour);
          m.opacity = (0.22 + 0.1 * Math.sin(seconds / 7 + h.k)) * warpIntensity(seconds) * (1 + pulse * 0.8);
          m.rotation = seconds * 0.03 * (h.k % 2 === 0 ? 1 : -1);
          h.sprite.position.set(
            h.base.x + Math.sin(seconds / 11 + h.k) * 6,
            h.base.y + Math.cos(seconds / 13 + h.k * 2) * 6,
            h.base.z + Math.sin(seconds / 17 + h.k * 3) * 6,
          );
        }
      }
    },
    setStyle(next: WarpStyle): void {
      style = next;
      applyStyle();
    },
    dispose(): void {
      geometry.dispose();
      material.dispose();
      texture.dispose();
      for (const h of haze) h.sprite.material.dispose();
    },
  };
}
