import type { LightingParams, MaterialParams, MaterialPreset, ShadowParams } from "../types";

export const MATERIAL_PRESETS: Record<MaterialPreset, MaterialParams> = {
  softResin: {
    bevelWidth: 0.055,
    bevelStrength: 0.7,
    roughness: 0.48,
    specularIntensity: 0.3,
    ambientOcclusion: 0.18,
    thickness: 0.025,
  },
  matteAcrylic: {
    bevelWidth: 0.065,
    bevelStrength: 0.55,
    roughness: 0.68,
    specularIntensity: 0.16,
    ambientOcclusion: 0.22,
    thickness: 0.022,
  },
  satinResin: {
    bevelWidth: 0.05,
    bevelStrength: 0.8,
    roughness: 0.36,
    specularIntensity: 0.42,
    ambientOcclusion: 0.15,
    thickness: 0.028,
  },
};

export const DEFAULT_LIGHTING: LightingParams = {
  direction: [-0.5, -0.6, 1],
  intensity: 0.85,
  ambient: 0.65,
  specular: 0.28,
};

export const DEFAULT_SHADOW: ShadowParams = {
  enabled: true,
  opacity: 0.12,
  blur: 0.04,
  offset: [0.01, 0.025],
  color: "#1E1B3A",
};
