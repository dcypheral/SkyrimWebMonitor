/**
 * Shared surface shading for the thumbnail renderer and the 3D viewer:
 * diffuse texture (or material tint) × vertex colours, shader alpha,
 * self-lit effect surfaces and NiAlphaProperty blend modes.
 */
import type { NifMesh } from './types';

/** Opacity of untextured see-through meshes (no texture alpha to go by). */
export const GLASS_OPACITY = 0.35;

const SLSF1_OWN_EMIT = 1 << 22;

export const FRAGMENT_SHADER = `
precision mediump float;
varying vec3 vNormal;
varying vec2 vUv;
varying vec4 vColor;
uniform sampler2D uTexture;
uniform bool uHasTexture;
uniform vec3 uTint;
uniform float uAlphaCutoff;
// x: use vertex colour, y: use vertex alpha, z: effect (self-lit), w: own emit
uniform vec4 uFlags;
uniform vec3 uEmissive;
uniform float uEmissiveMul;
uniform float uShaderAlpha;
// < 0: opaque. Otherwise blended; used as alpha for untextured meshes.
uniform float uOpacity;
void main() {
  vec4 base = uHasTexture ? texture2D(uTexture, vUv) : vec4(uTint, 1.0);
  if (uFlags.x > 0.5) base.rgb *= vColor.rgb;
  float a = base.a;
  if (uFlags.y > 0.5) a *= vColor.a;
  if (a < uAlphaCutoff) discard;

  vec3 color;
  if (uFlags.z > 0.5) {
    // Effect shader: self-lit, tinted by its base colour.
    color = base.rgb * uEmissive * max(uEmissiveMul, 0.0);
  } else {
    vec3 n = normalize(vNormal);
    vec3 toCamera = vec3(0.0, -1.0, 0.0);
    // Two-sided lighting: winding is not consistent across item meshes.
    if (dot(n, toCamera) < 0.0) n = -n;
    vec3 keyDir = normalize(vec3(-0.55, -0.7, 0.75));
    vec3 fillDir = normalize(vec3(0.8, -0.4, -0.2));
    float key = max(dot(n, keyDir), 0.0);
    float fill = max(dot(n, fillDir), 0.0);
    float rim = pow(1.0 - max(dot(n, toCamera), 0.0), 2.5);
    vec3 halfVec = normalize(keyDir + toCamera);
    float spec = pow(max(dot(n, halfVec), 0.0), 32.0);
    // Matte look: game textures already carry their own shading detail.
    color = base.rgb * (0.38 + 0.8 * key * vec3(1.0, 0.96, 0.9) + 0.25 * fill * vec3(0.8, 0.88, 1.0));
    color += spec * 0.1 * vec3(1.0, 0.97, 0.9);
    color += rim * 0.16 * vec3(0.85, 0.9, 1.0);
    if (uFlags.w > 0.5) color += uEmissive * uEmissiveMul * 0.6;
  }

  float alpha = 1.0;
  if (uOpacity >= 0.0) alpha = (uHasTexture ? a : uOpacity) * uShaderAlpha;
  gl_FragColor = vec4(min(color, vec3(1.0)), clamp(alpha, 0.0, 1.0));
}
`;

export interface MaterialLocations {
  hasTexture: WebGLUniformLocation | null;
  alphaCutoff: WebGLUniformLocation | null;
  flags: WebGLUniformLocation | null;
  emissive: WebGLUniformLocation | null;
  emissiveMul: WebGLUniformLocation | null;
  shaderAlpha: WebGLUniformLocation | null;
  opacity: WebGLUniformLocation | null;
  color: number;
}

export function materialLocations(gl: WebGLRenderingContext, program: WebGLProgram): MaterialLocations {
  return {
    hasTexture: gl.getUniformLocation(program, 'uHasTexture'),
    alphaCutoff: gl.getUniformLocation(program, 'uAlphaCutoff'),
    flags: gl.getUniformLocation(program, 'uFlags'),
    emissive: gl.getUniformLocation(program, 'uEmissive'),
    emissiveMul: gl.getUniformLocation(program, 'uEmissiveMul'),
    shaderAlpha: gl.getUniformLocation(program, 'uShaderAlpha'),
    opacity: gl.getUniformLocation(program, 'uOpacity'),
    color: gl.getAttribLocation(program, 'aColor'),
  };
}

/** NiAlphaProperty blend mode → WebGL factor. */
export function blendFactor(gl: WebGLRenderingContext, mode: number): number {
  switch (mode) {
    case 0:
      return gl.ONE;
    case 1:
      return gl.ZERO;
    case 2:
      return gl.SRC_COLOR;
    case 3:
      return gl.ONE_MINUS_SRC_COLOR;
    case 4:
      return gl.DST_COLOR;
    case 5:
      return gl.ONE_MINUS_DST_COLOR;
    case 6:
      return gl.SRC_ALPHA;
    case 8:
      return gl.DST_ALPHA;
    case 9:
      return gl.ONE_MINUS_DST_ALPHA;
    case 10:
      return gl.SRC_ALPHA_SATURATE;
    default:
      return gl.ONE_MINUS_SRC_ALPHA;
  }
}

/** Order: opaque meshes, then blended ones (glass, liquids, glows). */
export function drawOrder<T extends { mesh: NifMesh }>(items: readonly T[]): T[] {
  return [...items.filter((d) => !d.mesh.alphaBlend), ...items.filter((d) => d.mesh.alphaBlend)];
}

/**
 * Sets blend state and material uniforms for one mesh. The vertex colour
 * attribute is bound by the caller (or disabled with a constant white).
 */
export function applyMaterial(
  gl: WebGLRenderingContext,
  loc: MaterialLocations,
  mesh: NifMesh,
  hasTexture: boolean,
): void {
  const m = mesh.material;
  if (mesh.alphaBlend) {
    gl.enable(gl.BLEND);
    gl.blendFunc(blendFactor(gl, mesh.blendSrc), blendFactor(gl, mesh.blendDst));
    gl.depthMask(false);
  } else {
    gl.disable(gl.BLEND);
    gl.depthMask(true);
  }
  gl.uniform1i(loc.hasTexture, hasTexture ? 1 : 0);
  gl.uniform1f(loc.alphaCutoff, hasTexture && mesh.alphaTest ? Math.max(mesh.alphaThreshold, 0.05) : -1);
  gl.uniform4f(
    loc.flags,
    m.useVertexColors && mesh.colors ? 1 : 0,
    m.useVertexAlpha && mesh.colors ? 1 : 0,
    mesh.isEffect ? 1 : 0,
    m.flags1 & SLSF1_OWN_EMIT ? 1 : 0,
  );
  gl.uniform3f(loc.emissive, m.emissive[0], m.emissive[1], m.emissive[2]);
  gl.uniform1f(loc.emissiveMul, mesh.isEffect && m.emissiveMultiple <= 0 ? 1 : m.emissiveMultiple);
  gl.uniform1f(loc.shaderAlpha, m.alpha > 0 && m.alpha <= 1 ? m.alpha : 1);
  gl.uniform1f(loc.opacity, mesh.alphaBlend ? GLASS_OPACITY : -1);
}

/** Restores default state after drawing. */
export function resetBlend(gl: WebGLRenderingContext): void {
  gl.disable(gl.BLEND);
  gl.depthMask(true);
}

/** Binds per-vertex colours, or a constant white when the mesh has none. */
export function bindColors(
  gl: WebGLRenderingContext,
  location: number,
  buffer: WebGLBuffer | null,
): void {
  if (location < 0) return;
  if (buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 0, 0);
  } else {
    gl.disableVertexAttribArray(location);
    gl.vertexAttrib4f(location, 1, 1, 1, 1);
  }
}
