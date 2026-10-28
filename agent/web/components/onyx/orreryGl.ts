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
  frame: (view: GlView, stars: number, clouds: Record<string, GlCloudStyle>) => void;
  dispose: () => void;
};

export function createOrreryGl(canvas: HTMLCanvasElement): OrreryGl | null {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: true });
  if (!gl) return null;
  const common = ["uRot", "uF", "uHalf", "uAlpha", "uSize", "uColor"];
  const cloudProg = compile(gl, CLOUD_VS, FS, ["aEl0", "aEl1"], [...common, "uDays", "uLog", "uTarget", "uDist"]);
  const starProg = compile(gl, STAR_VS, FS, ["aDir", "aMag"], common);
  if (!cloudProg || !starProg) return null;

  const clouds = new Map<string, { buf: WebGLBuffer; count: number }>();
  let stars: { buf: WebGLBuffer; count: number } | null = null;

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

  const frame = (view: GlView, starAlpha: number, styles: Record<string, GlCloudStyle>) => {
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
  };

  const dispose = () => {
    for (const c of clouds.values()) gl.deleteBuffer(c.buf);
    if (stars) gl.deleteBuffer(stars.buf);
    gl.deleteProgram(cloudProg.p);
    gl.deleteProgram(starProg.p);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };

  return { setCloud, setStars, frame, dispose };
}
