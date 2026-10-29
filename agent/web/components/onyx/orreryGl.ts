/**
 * WebGL points under the orrery's 2D canvas: tens of thousands of asteroid and
 * Kuiper-belt dots (Kepler solved per vertex) and the catalog star sky.
 * The projection mirrors makeProjector in SkyOrrery.tsx exactly.
 */
import type { CloudJson } from "../../lib/orreryCatalog";
import type { Vec3 } from "../../lib/skyOrrery";

export type GlView = {
  yaw: number;
  pitch: number;
  dist: number;
  target: Vec3;
  /** Focal length in device pixels. */
  F: number;
  w: number;
  h: number;
  dpr: number;
  log: boolean;
};

export type GlCloudStyle = { alpha: number; color: [number, number, number]; size: number; days: number };

const CLOUD_VS = `
attribute vec4 aEl0;
attribute vec3 aEl1;
uniform float uDays;
uniform float uLog;
uniform vec3 uTarget;
uniform vec4 uRot;
uniform float uDist;
uniform float uF;
uniform vec2 uHalf;
uniform float uAlpha;
uniform float uSize;
varying float vA;
void main() {
  float a = aEl0.x;
  float e = aEl0.y;
  float n = 0.01720209895 / (a * sqrt(a));
  float M = mod(aEl1.y + n * uDays, 6.28318530718);
  float E = M + e * sin(M);
  for (int k = 0; k < 10; k++) {
    E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  }
  float xp = a * (cos(E) - e);
  float yp = a * sqrt(1.0 - e * e) * sin(E);
  float cO = cos(aEl0.w); float sO = sin(aEl0.w);
  float cw = cos(aEl1.x); float sw = sin(aEl1.x);
  float ci = cos(aEl0.z); float si = sin(aEl0.z);
  vec3 p = vec3(
    (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp,
    (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp,
    sw * si * xp + cw * si * yp);
  if (uLog > 0.5) {
    float r = length(p);
    p *= (log(1.0 + r / 0.1) / 2.302585093) / r;
  }
  vec3 d = p - uTarget;
  float x1 = d.x * uRot.x + d.y * uRot.y;
  float y1 = -d.x * uRot.y + d.y * uRot.x;
  float up = y1 * uRot.w + d.z * uRot.z;
  float depth = y1 * uRot.z - d.z * uRot.w + uDist;
  if (depth < uDist * 0.02) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vA = 0.0;
    return;
  }
  gl_Position = vec4(uF * x1 / depth / uHalf.x, uF * up / depth / uHalf.y, 0.0, 1.0);
  float bright = clamp((19.0 - aEl1.z) / 8.0, 0.18, 1.0);
  vA = uAlpha * bright;
  gl_PointSize = uSize * (0.75 + bright);
}`;

const STAR_VS = `
attribute vec3 aDir;
attribute float aMag;
uniform vec4 uRot;
uniform float uF;
uniform vec2 uHalf;
uniform float uAlpha;
uniform float uSize;
varying float vA;
void main() {
  float x1 = aDir.x * uRot.x + aDir.y * uRot.y;
  float y1 = -aDir.x * uRot.y + aDir.y * uRot.x;
  float up = y1 * uRot.w + aDir.z * uRot.z;
  float fwd = y1 * uRot.z - aDir.z * uRot.w;
  if (fwd <= 0.05) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vA = 0.0;
    return;
  }
  gl_Position = vec4(uF * x1 / fwd / uHalf.x, uF * up / fwd / uHalf.y, 0.0, 1.0);
  float b = clamp((6.8 - aMag) / 6.4, 0.04, 1.0);
  vA = uAlpha * (0.18 + 0.82 * b);
  gl_PointSize = uSize * (0.9 + 2.6 * b * b);
}`;

const FS = `
precision mediump float;
uniform vec3 uColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  float a = vA * smoothstep(0.5, 0.1, d);
  gl_FragColor = vec4(uColor * a, a);
}`;

/** A square around the globe (Earth sits at the screen centre), so the ray-trace skips empty sky. */
const QUAD_VS = `
attribute vec2 aXY;
uniform float uR;
uniform vec2 uHalf;
void main() { gl_Position = vec4(aXY * uR / uHalf, 0.0, 1.0); }`;

/** Ray-traced Earth (radius 1 at the origin): land mask, day/night, a soft limb glow. */
const GLOBE_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec3 uCam;
uniform vec3 uSx;
uniform vec3 uUp;
uniform vec3 uFwd;
uniform float uF;
uniform vec2 uHalf;
uniform mat3 uMT;
uniform float uSpin;
uniform vec3 uSun;
uniform float uAlpha;
uniform float uHasLand;
uniform sampler2D uLand;
void main() {
  vec2 s = gl_FragCoord.xy - uHalf;
  vec3 dir = normalize(s.x * uSx + s.y * uUp + uF * uFwd);
  float b = dot(uCam, dir);
  float disc = b * b - (dot(uCam, uCam) - 1.0);
  if (disc <= 0.0 || b >= 0.0) {
    if (b >= 0.0) discard;
    vec3 q = uCam - dir * b;
    float r = length(q);
    float g = clamp(1.0 - (r - 1.0) / 0.09, 0.0, 1.0);
    if (g <= 0.0) discard;
    float lit = clamp(dot(q / r, uSun) * 0.8 + 0.45, 0.08, 1.0);
    gl_FragColor = vec4(vec3(0.32, 0.55, 1.0) * g * g * 0.42 * lit * uAlpha, 0.0);
    return;
  }
  vec3 n = normalize(uCam + dir * (-b - sqrt(disc)));
  vec3 nt = uMT * n;
  float lon = atan(nt.y, nt.x) - uSpin;
  float lat = asin(clamp(nt.z, -1.0, 1.0));
  vec2 uv = vec2(fract(lon / 6.28318530718 + 0.5), 0.5 - lat / 3.14159265359);
  float land = uHasLand > 0.5 ? texture2D(uLand, uv).r : 0.0;
  float mu = dot(n, uSun);
  float day = smoothstep(-0.12, 0.14, mu);
  vec3 dayCol = mix(vec3(0.05, 0.14, 0.29), vec3(0.33, 0.39, 0.29), land) * (0.42 + 0.58 * max(mu, 0.0));
  vec3 nightCol = mix(vec3(0.010, 0.014, 0.032), vec3(0.030, 0.036, 0.052), land);
  vec3 col = mix(nightCol, dayCol, day);
  float rim = pow(1.0 - max(dot(n, -dir), 0.0), 2.5);
  col += vec3(0.30, 0.52, 1.0) * rim * (0.12 + 0.5 * day);
  gl_FragColor = vec4(col * uAlpha, uAlpha);
}`;

/**
 * Satellites: TEME state from the SGP4 worker, extrapolated to now on the GPU
 * (p + v·dt − μ·p/|p|³·dt²/2), compressed like the scene, hidden behind the globe.
 */
const SAT_VS = `
attribute vec3 aPos;
attribute vec3 aVel;
attribute float aCls;
uniform float uDt;
uniform mat3 uMT;
uniform float uLog;
uniform vec3 uCam;
uniform vec4 uRot;
uniform float uDist;
uniform float uF;
uniform vec2 uHalf;
uniform float uSize;
uniform float uA[7];
uniform vec3 uC[7];
varying float vA;
varying vec3 vC;
void main() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = 0.0;
  vA = 0.0;
  vC = vec3(0.0);
  float r0 = length(aPos);
  if (r0 < 6000.0) return;
  vec3 p = aPos + aVel * uDt - aPos * (199300.2209 * uDt * uDt / (r0 * r0 * r0));
  float r = length(p) / 6371.0;
  float rs = uLog > 0.5 ? 1.0 + 0.75 * log(1.0 + max(r - 1.0, 0.0) / 0.06) / 2.302585093 : r;
  vec3 w = (normalize(p) * uMT) * rs;
  vec3 d = w - uCam;
  float L = length(d);
  vec3 dir = d / L;
  float b = dot(uCam, dir);
  float disc = b * b - (dot(uCam, uCam) - 1.0);
  if (disc > 0.0) {
    float t0 = -b - sqrt(disc);
    if (t0 > 0.0 && t0 < L) return;
  }
  float x1 = w.x * uRot.x + w.y * uRot.y;
  float y1 = -w.x * uRot.y + w.y * uRot.x;
  float up = y1 * uRot.w + w.z * uRot.z;
  float depth = y1 * uRot.z - w.z * uRot.w + uDist;
  if (depth < uDist * 0.02) return;
  int k = int(aCls + 0.5);
  vA = uA[k];
  vC = uC[k];
  if (vA <= 0.001) return;
  gl_Position = vec4(uF * x1 / depth / uHalf.x, uF * up / depth / uHalf.y, 0.0, 1.0);
  gl_PointSize = uSize * (k == 6 ? 3.2 : k == 5 ? 0.85 : 1.0);
}`;

const SAT_FS = `
precision mediump float;
varying float vA;
varying vec3 vC;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  float a = vA * smoothstep(0.5, 0.1, d);
  gl_FragColor = vec4(vC * a, a);
}`;

/** Point classes: LEO, Starlink, MEO/GNSS, GEO, HEO, debris, named. */
const SAT_COLORS = [
  [0.78, 0.87, 1.0],
  [0.6, 0.7, 1.0],
  [0.55, 1.0, 0.76],
  [1.0, 0.82, 0.5],
  [1.0, 0.56, 0.78],
  [0.95, 0.52, 0.42],
  [1.0, 1.0, 1.0],
];
const SAT_ALPHA = [0.36, 0.17, 0.9, 0.95, 0.9, 0.3, 1];

export type GlEarth = {
  alpha: number;
  /** TEME → scene (ecliptic), row-major 3×3. */
  m: ArrayLike<number>;
  /** Greenwich sidereal angle, radians. */
  spin: number;
  /** Unit vector toward the Sun, scene frame. */
  sun: Vec3;
  /** Seconds between the satellite state and the shown instant. */
  dt: number;
  satellites: number;
  debris: number;
};

type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null>; a: Record<string, number> };

function compile(gl: WebGLRenderingContext, vs: string, fs: string, attrs: string[], uniforms: string[]): Prog | null {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const v = sh(gl.VERTEX_SHADER, vs);
  const f = sh(gl.FRAGMENT_SHADER, fs);
  const p = gl.createProgram();
  if (!v || !f || !p) return null;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
  return {
    p,
    u: Object.fromEntries(uniforms.map(n => [n, gl.getUniformLocation(p, n)])),
    a: Object.fromEntries(attrs.map(n => [n, gl.getAttribLocation(p, n)])),
  };
}

const DEG = Math.PI / 180;

export type OrreryGl = {
  setCloud: (id: string, cloud: CloudJson) => number;
  setStars: (dirs: Vec3[], mags: number[]) => void;
  setLand: (img: TexImageSource) => void;
  setSatClasses: (cls: Uint8Array) => void;
  setSatState: (pos: Float32Array, vel: Float32Array) => void;
  frame: (view: GlView, stars: number, clouds: Record<string, GlCloudStyle>, earth?: GlEarth) => void;
  dispose: () => void;
};

export function createOrreryGl(canvas: HTMLCanvasElement): OrreryGl | null {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: true });
  if (!gl) return null;
  const common = ["uRot", "uF", "uHalf", "uAlpha", "uSize", "uColor"];
  const cloudProg = compile(gl, CLOUD_VS, FS, ["aEl0", "aEl1"], [...common, "uDays", "uLog", "uTarget", "uDist"]);
  const starProg = compile(gl, STAR_VS, FS, ["aDir", "aMag"], common);
  if (!cloudProg || !starProg) return null;
  const globeProg = compile(gl, QUAD_VS, GLOBE_FS, ["aXY"], ["uCam", "uSx", "uUp", "uFwd", "uF", "uHalf", "uR", "uMT", "uSpin", "uSun", "uAlpha", "uHasLand", "uLand"]);
  const satProg = compile(
    gl,
    SAT_VS,
    SAT_FS,
    ["aPos", "aVel", "aCls"],
    ["uDt", "uMT", "uLog", "uCam", "uRot", "uDist", "uF", "uHalf", "uSize", "uA", "uC"],
  );

  const clouds = new Map<string, { buf: WebGLBuffer; count: number }>();
  let stars: { buf: WebGLBuffer; count: number } | null = null;
  const quad = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  let land: WebGLTexture | null = null;
  const sat = { pos: gl.createBuffer()!, vel: gl.createBuffer()!, cls: gl.createBuffer()!, count: 0, live: 0 };

  const setLand = (img: TexImageSource) => {
    land = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, land);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  const setSatClasses = (cls: Uint8Array) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, sat.cls);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cls), gl.STATIC_DRAW);
    sat.count = cls.length;
  };
  const setSatState = (pos: Float32Array, vel: Float32Array) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, sat.pos);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, sat.vel);
    gl.bufferData(gl.ARRAY_BUFFER, vel, gl.DYNAMIC_DRAW);
    sat.live = Math.min(sat.count, pos.length / 3);
  };

  const setCloud = (id: string, cloud: CloudJson) => {
    const s = cloud.stride;
    const n = Math.floor(cloud.rows.length / s);
    const data = new Float32Array(n * 7);
    for (let k = 0; k < n; k++) {
      const r = cloud.rows;
      const o = k * s;
      data[k * 7] = r[o]! / 1e4;
      data[k * 7 + 1] = Math.min(0.995, r[o + 1]! / 1e4);
      data[k * 7 + 2] = (r[o + 2]! / 100) * DEG;
      data[k * 7 + 3] = (r[o + 3]! / 100) * DEG;
      data[k * 7 + 4] = (r[o + 4]! / 100) * DEG;
      data[k * 7 + 5] = (r[o + 5]! / 100) * DEG;
      data[k * 7 + 6] = r[o + 6]! / 10;
    }
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    clouds.set(id, { buf, count: n });
    return n;
  };

  const setStars = (dirs: Vec3[], mags: number[]) => {
    const data = new Float32Array(dirs.length * 4);
    dirs.forEach((d, k) => {
      data[k * 4] = d.x;
      data[k * 4 + 1] = d.y;
      data[k * 4 + 2] = d.z;
      data[k * 4 + 3] = mags[k]!;
    });
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    stars = { buf, count: dirs.length };
  };

  const frame = (view: GlView, starAlpha: number, styles: Record<string, GlCloudStyle>, earth?: GlEarth) => {
    if (canvas.width !== view.w || canvas.height !== view.h) {
      canvas.width = view.w;
      canvas.height = view.h;
    }
    gl.viewport(0, 0, view.w, view.h);
    gl.clearColor(3 / 255, 3 / 255, 8 / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    const rot = [Math.cos(view.yaw), Math.sin(view.yaw), Math.cos(view.pitch), Math.sin(view.pitch)] as const;

    const bindCommon = (pr: Prog, alpha: number, size: number, color: readonly [number, number, number]) => {
      gl.useProgram(pr.p);
      gl.uniform4f(pr.u.uRot!, rot[0], rot[1], rot[2], rot[3]);
      gl.uniform1f(pr.u.uF!, view.F);
      gl.uniform2f(pr.u.uHalf!, view.w / 2, view.h / 2);
      gl.uniform1f(pr.u.uAlpha!, alpha);
      gl.uniform1f(pr.u.uSize!, size * view.dpr);
      gl.uniform3f(pr.u.uColor!, color[0], color[1], color[2]);
    };

    if (stars && starAlpha > 0.01) {
      bindCommon(starProg, starAlpha, 1, [0.9, 0.88, 1]);
      gl.bindBuffer(gl.ARRAY_BUFFER, stars.buf);
      gl.enableVertexAttribArray(starProg.a.aDir!);
      gl.vertexAttribPointer(starProg.a.aDir!, 3, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(starProg.a.aMag!);
      gl.vertexAttribPointer(starProg.a.aMag!, 1, gl.FLOAT, false, 16, 12);
      gl.drawArrays(gl.POINTS, 0, stars.count);
      gl.disableVertexAttribArray(starProg.a.aDir!);
      gl.disableVertexAttribArray(starProg.a.aMag!);
    }

    for (const [id, c] of clouds) {
      const st = styles[id];
      if (!st || st.alpha <= 0.01) continue;
      bindCommon(cloudProg, st.alpha, st.size, st.color);
      gl.uniform1f(cloudProg.u.uDays!, st.days);
      gl.uniform1f(cloudProg.u.uLog!, view.log ? 1 : 0);
      gl.uniform3f(cloudProg.u.uTarget!, view.target.x, view.target.y, view.target.z);
      gl.uniform1f(cloudProg.u.uDist!, view.dist);
      gl.bindBuffer(gl.ARRAY_BUFFER, c.buf);
      gl.enableVertexAttribArray(cloudProg.a.aEl0!);
      gl.vertexAttribPointer(cloudProg.a.aEl0!, 4, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(cloudProg.a.aEl1!);
      gl.vertexAttribPointer(cloudProg.a.aEl1!, 3, gl.FLOAT, false, 28, 16);
      gl.drawArrays(gl.POINTS, 0, c.count);
      gl.disableVertexAttribArray(cloudProg.a.aEl0!);
      gl.disableVertexAttribArray(cloudProg.a.aEl1!);
    }

    if (earth && earth.alpha > 0.01 && globeProg) drawEarth(view, rot, earth);
  };

  const drawEarth = (view: GlView, rot: readonly [number, number, number, number], e: GlEarth) => {
    const [cy, sy, cp, sp] = rot;
    const fwd = [-sy * cp, cy * cp, -sp] as const;
    const cam = [-view.dist * fwd[0], -view.dist * fwd[1], -view.dist * fwd[2]] as const;
    const mt = new Float32Array(e.m as ArrayLike<number>);
    const g = globeProg!;
    gl.useProgram(g.p);
    gl.uniform3f(g.u.uCam!, cam[0], cam[1], cam[2]);
    gl.uniform3f(g.u.uSx!, cy, sy, 0);
    gl.uniform3f(g.u.uUp!, -sy * sp, cy * sp, cp);
    gl.uniform3f(g.u.uFwd!, fwd[0], fwd[1], fwd[2]);
    gl.uniform1f(g.u.uF!, view.F);
    gl.uniform2f(g.u.uHalf!, view.w / 2, view.h / 2);
    const rim = (view.F * 1.1) / Math.sqrt(Math.max(1e-6, view.dist * view.dist - 1.21)) + 2;
    gl.uniform1f(g.u.uR!, Math.min(rim, Math.hypot(view.w, view.h)));
    gl.uniformMatrix3fv(g.u.uMT!, false, mt);
    gl.uniform1f(g.u.uSpin!, e.spin);
    gl.uniform3f(g.u.uSun!, e.sun.x, e.sun.y, e.sun.z);
    gl.uniform1f(g.u.uAlpha!, e.alpha);
    gl.uniform1f(g.u.uHasLand!, land ? 1 : 0);
    if (land) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, land);
      gl.uniform1i(g.u.uLand!, 0);
    }
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(g.a.aXY!);
    gl.vertexAttribPointer(g.a.aXY!, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(g.a.aXY!);
    gl.blendFunc(gl.ONE, gl.ONE);

    if (!satProg || !sat.live) return;
    const s = satProg;
    gl.useProgram(s.p);
    gl.uniform1f(s.u.uDt!, e.dt);
    gl.uniformMatrix3fv(s.u.uMT!, false, mt);
    gl.uniform1f(s.u.uLog!, view.log ? 1 : 0);
    gl.uniform3f(s.u.uCam!, cam[0], cam[1], cam[2]);
    gl.uniform4f(s.u.uRot!, cy, sy, cp, sp);
    gl.uniform1f(s.u.uDist!, view.dist);
    gl.uniform1f(s.u.uF!, view.F);
    gl.uniform2f(s.u.uHalf!, view.w / 2, view.h / 2);
    gl.uniform1f(s.u.uSize!, 1.7 * view.dpr);
    const a = SAT_ALPHA.map((v, k) => v * e.alpha * (k === 5 ? e.debris : e.satellites));
    gl.uniform1fv(s.u.uA!, new Float32Array(a));
    gl.uniform3fv(s.u.uC!, new Float32Array(SAT_COLORS.flat()));
    const bind = (buf: WebGLBuffer, attr: number, size: number) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(attr);
      gl.vertexAttribPointer(attr, size, gl.FLOAT, false, 0, 0);
    };
    bind(sat.pos, s.a.aPos!, 3);
    bind(sat.vel, s.a.aVel!, 3);
    bind(sat.cls, s.a.aCls!, 1);
    gl.drawArrays(gl.POINTS, 0, sat.live);
    gl.disableVertexAttribArray(s.a.aPos!);
    gl.disableVertexAttribArray(s.a.aVel!);
    gl.disableVertexAttribArray(s.a.aCls!);
  };

  const dispose = () => {
    for (const c of clouds.values()) gl.deleteBuffer(c.buf);
    if (stars) gl.deleteBuffer(stars.buf);
    for (const b of [quad, sat.pos, sat.vel, sat.cls]) gl.deleteBuffer(b);
    if (land) gl.deleteTexture(land);
    gl.deleteProgram(cloudProg.p);
    gl.deleteProgram(starProg.p);
    if (globeProg) gl.deleteProgram(globeProg.p);
    if (satProg) gl.deleteProgram(satProg.p);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };

  return { setCloud, setStars, setLand, setSatClasses, setSatState, frame, dispose };
}
