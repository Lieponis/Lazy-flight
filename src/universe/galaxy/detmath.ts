// Exact-repeat maths. Math.exp, Math.log, Math.sin and Math.cos may differ in the very last digit between phones,
// browsers and computers. The galaxy must be IDENTICAL everywhere (same seed = same galaxy), so everything that
// decides where a system is, or whether it exists, uses only + - * / and sqrt, which every JavaScript engine does
// the same way. These helpers are small series; they agree with Math.* to about 1e-14 (a test checks it).

const LN2 = 0.6931471805599453;
export const TWO_PI = 6.283185307179586;
const INV_TWO_PI = 0.15915494309189535;

/** e to the power x (x between about -60 and 60). */
export function expDet(x: number): number {
  let y = x;
  let halvings = 0;
  while (Math.abs(y) > 0.5) {
    y *= 0.5;
    halvings++;
  }
  let term = 1;
  let sum = 1;
  for (let k = 1; k <= 14; k++) {
    term = (term * y) / k;
    sum += term;
  }
  for (; halvings > 0; halvings--) sum *= sum;
  return sum;
}

/** Natural logarithm of x (x greater than 0). */
export function lnDet(x: number): number {
  let y = x;
  let k = 0;
  while (y > 1.5) {
    y *= 0.5;
    k++;
  }
  while (y < 0.75) {
    y *= 2;
    k--;
  }
  const t = (y - 1) / (y + 1);
  const t2 = t * t;
  let term = t;
  let sum = 0;
  for (let i = 1; i <= 29; i += 2) {
    sum += term / i;
    term *= t2;
  }
  return 2 * sum + k * LN2;
}

/** The result of sincosDet: read cos and sin here (one shared object, copy the numbers right away). */
export const SC = { sin: 0, cos: 1 };

/** Sine and cosine of an angle in radians, written into SC. */
export function sincosDet(angle: number): void {
  const turns = Math.floor(angle * INV_TWO_PI + 0.5);
  const y = angle - turns * TWO_PI; // between -pi and pi
  const y2 = y * y;
  let sin = y;
  let cos = 1;
  let ts = y;
  let tc = 1;
  for (let k = 1; k <= 15; k++) {
    tc = (-tc * y2) / ((2 * k - 1) * (2 * k));
    cos += tc;
    ts = (-ts * y2) / ((2 * k) * (2 * k + 1));
    sin += ts;
  }
  SC.sin = sin;
  SC.cos = cos;
}
