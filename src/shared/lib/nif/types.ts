/** One drawable triangle mesh, already transformed into model space. */
export interface NifMesh {
  name: string;
  /** xyz per vertex, model space (Skyrim units, Z up). */
  positions: Float32Array;
  /** xyz per vertex, unit length, model space. Null when the mesh has none. */
  normals: Float32Array | null;
  /** uv per vertex. Null when the mesh has none. */
  uvs: Float32Array | null;
  /** Triangle list (3 indices per triangle). */
  indices: Uint32Array;
  /** Data-relative diffuse texture path ("textures/..."), lower-case. */
  diffuseTexture: string | null;
  /** NiAlphaProperty alpha test enabled (cut-out textures such as fur or straps). */
  alphaTest: boolean;
  /** Alpha test threshold, 0..1. */
  alphaThreshold: number;
  /** NiAlphaProperty blending: see-through surfaces such as potion glass. */
  alphaBlend: boolean;
  /** NiAlphaProperty blend modes (0 ONE, 1 ZERO, … 6 SRC_ALPHA, 7 ONE_MINUS_SRC_ALPHA …). */
  blendSrc: number;
  blendDst: number;
  /** RGBA 0..1 per vertex, or null. Used when material.useVertexColors. */
  colors: Float32Array | null;
  material: NifMaterial;
  /** BSEffectShaderProperty surface (glow, liquid, glass). */
  isEffect: boolean;
}

/** What the renderer needs from the shader property. */
export interface NifMaterial {
  kind: 'lighting' | 'effect' | 'none';
  /** BSLightingShaderProperty shader type (0 default, 1 env map, 11 multi-layer parallax, …). */
  shaderType: number;
  flags1: number;
  flags2: number;
  /** Texture set slots (lighting) or [source] (effect); '' = empty slot. */
  textures: string[];
  /** Emissive / base colour (effect shaders: the surface colour). */
  emissive: [number, number, number];
  emissiveMultiple: number;
  /** Shader alpha (glass fade). */
  alpha: number;
  useVertexColors: boolean;
  useVertexAlpha: boolean;
  /** Effect shader palette texture (greyscale-to-palette). */
  greyscaleTexture: string | null;
}

/**
 * BSInvMarker: the game's own inventory preview framing for this model.
 * Rotations are radians (the file stores thousandths of a radian).
 */
export interface NifInvMarker {
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  zoom: number;
}

export interface NifBounds {
  min: [number, number, number];
  max: [number, number, number];
}

export interface NifModel {
  meshes: NifMesh[];
  invMarker: NifInvMarker | null;
  bounds: NifBounds | null;
  /** Block types that were present but not understood (diagnostics only). */
  skippedBlockTypes: string[];
}
