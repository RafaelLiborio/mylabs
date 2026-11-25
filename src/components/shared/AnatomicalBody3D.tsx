import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { BodyRegionFilter } from './BodyMapSvg'
import type { CircumferencesMap, SkinfoldKey, SkinfoldsMap } from '@/domain/anthropometry'
import { Eye, Layers, RotateCw, Sparkles } from 'lucide-react'

export type AnatomicalViewPreset = 'front' | 'back' | 'side' | 'three_quarter'
export type AnatomicalRenderMode = 'ecorche' | 'composition' | 'clinical'

interface AnatomicalLandmarkPin {
  id: string
  label: string
  valueLabel: string
  hint: string
  region: Exclude<BodyRegionFilter, 'all'>
  kind: 'skinfold' | 'circumference'
  position: [number, number, number]
  highlighted?: boolean
}

export interface AnatomicalBody3DProps {
  activeRegion: BodyRegionFilter
  onSelectRegion: (r: BodyRegionFilter) => void
  sex?: 'male' | 'female'
  bodyFatPct: number
  leanMassKg: number
  fatMassKg: number
  skinfolds?: SkinfoldsMap
  circumferences?: CircumferencesMap
  requiredSkinfolds?: SkinfoldKey[]
}

/** Smooth Gaussian bell function */
function gauss(x: number, mu: number, sigma: number): number {
  const d = (x - mu) / sigma
  return Math.exp(-0.5 * d * d)
}

/** Smooth 2D Gaussian on (y, angle) with periodic angle wrapping */
function gauss2D(y: number, y0: number, sy: number, theta: number, t0: number, st: number): number {
  let dt = theta - t0
  while (dt > Math.PI) dt -= Math.PI * 2
  while (dt < -Math.PI) dt += Math.PI * 2
  return Math.exp(-0.5 * ((y - y0) / sy) ** 2 - 0.5 * (dt / st) ** 2)
}

/** Smooth step between a and b */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Linear interpolation */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Color helper: blends deep striated muscle fiber, tendinous fascia ivory, and skin/adipose tint
 */
function computeTissueColor(
  muscleIntensity: number,
  fasciaIntensity: number,
  striationFreq: number,
  coordForStriation: number,
  mode: AnatomicalRenderMode,
  regionActive: boolean,
  regionColorHex: number,
  bodyFatPct: number,
): [number, number, number] {
  const striation = 0.5 + 0.5 * Math.sin(coordForStriation * striationFreq)
  const f = Math.max(0, Math.min(1, fasciaIntensity))
  const m = Math.max(0, Math.min(1, muscleIntensity))

  if (mode === 'ecorche') {
    const baseMuscleR = lerp(0.56, 0.85, m) + striation * 0.055 * m
    const baseMuscleG = lerp(0.15, 0.27, m) + striation * 0.025 * m
    const baseMuscleB = lerp(0.14, 0.22, m) + striation * 0.02 * m

    const fasciaR = 0.89
    const fasciaG = 0.84
    const fasciaB = 0.78

    let r = lerp(baseMuscleR, fasciaR, f)
    let g = lerp(baseMuscleG, fasciaG, f)
    let b = lerp(baseMuscleB, fasciaB, f)

    if (!regionActive) {
      const lum = r * 0.3 + g * 0.59 + b * 0.11
      r = lerp(r, lum * 0.55, 0.65)
      g = lerp(g, lum * 0.6, 0.65)
      b = lerp(b, lum * 0.7, 0.65)
    }
    return [r, g, b]
  }

  if (mode === 'composition') {
    const fatFactor = Math.max(0, Math.min(1, (bodyFatPct - 8) / 26))
    const adiposeOverlay = (1 - m * 0.6) * fatFactor
    let r = lerp(0.08, 0.96, adiposeOverlay)
    let g = lerp(0.76, 0.55, adiposeOverlay)
    let b = lerp(0.58, 0.14, adiposeOverlay)
    if (!regionActive) {
      r *= 0.45
      g *= 0.45
      b *= 0.5
    }
    return [r, g, b]
  }

  const c = new THREE.Color(regionActive ? regionColorHex : 0x334155)
  const reliefBoost = 0.78 + 0.32 * m + 0.15 * f + striation * 0.04
  return [
    Math.min(1, c.r * reliefBoost),
    Math.min(1, c.g * reliefBoost),
    Math.min(1, c.b * reliefBoost),
  ]
}

/**
 * Builds the high-resolution sculpted Torso + Pelvis + Glutes mesh (y from 0.67 to 1.48)
 * with closed rounded pelvic base so the thighs emerge organically from the hip sockets.
 */
function buildAnatomicalTorsoGeometry(params: {
  sex: 'male' | 'female'
  bodyFatPct: number
  waistScale: number
  chestScale: number
  hipScale: number
  mode: AnatomicalRenderMode
  trunkActive: boolean
  lowerActive: boolean
}): THREE.BufferGeometry {
  const { sex, bodyFatPct, waistScale, chestScale, hipScale, mode, trunkActive } = params
  const radialSegs = 88
  const heightSegs = 100
  const yMin = 0.67
  const yMax = 1.47

  const positions: number[] = []
  const colors: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  const isFemale = sex === 'female'
  const fatPad = Math.max(0, (bodyFatPct - 12) * 0.0012)

  for (let iy = 0; iy <= heightSegs; iy++) {
    const v = iy / heightSegs
    const y = lerp(yMin, yMax, v)

    // True hemispherical closure at pelvic floor (y in [0.67, 0.73]) and smooth trapezius slope (y in [1.27, 1.47])
    const botLinearT = Math.max(0, (0.73 - y) / (0.73 - yMin))
    const botCap = Math.sqrt(Math.max(0.0004, 1 - botLinearT * botLinearT))
    const pelvicV = smoothstep(0.69, 0.89, y) // narrows lateral torso into pubic triangle / sacrum between the hips
    const topCollar = smoothstep(1.27, yMax, y)

    // Continuous anatomical torso profile (pelvic saddle -> waist -> ribcage/pectorals -> trapezius/neck)
    const hipCurve = gauss(y, 0.83, 0.075)
    const waistIndent = gauss(y, 0.98, 0.095)
    const chestCurve = gauss(y, 1.24, 0.13)

    const rawRx =
      ((isFemale ? 0.134 : 0.144) * waistScale * waistIndent +
        (isFemale ? 0.155 : 0.148) * hipScale * hipCurve +
        (isFemale ? 0.164 : 0.194) * chestScale * chestCurve) /
      Math.max(0.45, waistIndent + hipCurve + chestCurve)

    // Lateral width narrows into the central pelvic V-saddle below y=0.89 and into the neck above y=1.27
    const pelvicRx = lerp(0.068 * hipScale, rawRx, pelvicV)
    const rx = lerp(pelvicRx, 0.056, topCollar) * botCap

    const rawRzF =
      ((0.096 + fatPad * 1.4) * waistScale * waistIndent +
        0.102 * hipScale * hipCurve +
        (isFemale ? 0.132 : 0.126) * chestScale * chestCurve) /
      Math.max(0.45, waistIndent + hipCurve + chestCurve)
    const rzFront = lerp(lerp(0.078 * hipScale, rawRzF, pelvicV), 0.052, topCollar) * botCap

    const rawRzB =
      (0.095 * waistIndent +
        (isFemale ? 0.144 : 0.130) * hipScale * hipCurve +
        (isFemale ? 0.110 : 0.122) * chestScale * chestCurve) /
      Math.max(0.45, waistIndent + hipCurve + chestCurve)
    const rzBack = lerp(lerp(0.095 * hipScale, rawRzB, pelvicV), 0.056, topCollar) * botCap

    for (let ix = 0; ix <= radialSegs; ix++) {
      const u = ix / radialSegs
      const theta = (u - 0.5) * Math.PI * 2
      const sinT = Math.sin(theta)
      const cosT = Math.cos(theta)
      const absTheta = Math.abs(theta)

      const rz = cosT >= 0 ? rzFront : rzBack
      let x = rx * sinT
      let z = rz * cosT

      let muscleRelief = 0
      let muscleIntensity = 0.45
      let fasciaIntensity = 0.0

      // 1. PECTORALIS MAJOR
      const pecLeft = gauss2D(y, isFemale ? 1.21 : 1.24, 0.052, theta, 0.36, 0.24)
      const pecRight = gauss2D(y, isFemale ? 1.21 : 1.24, 0.052, theta, -0.36, 0.24)
      const pecSternalGroove = gauss2D(y, 1.24, 0.09, theta, 0, 0.075)
      const pecAmp = isFemale ? 0.026 : 0.020
      muscleRelief += (pecLeft + pecRight) * pecAmp - pecSternalGroove * 0.011
      muscleIntensity += (pecLeft + pecRight) * 0.48
      fasciaIntensity += pecSternalGroove * 0.72

      // Clavicle ridge (y ≈ 1.385, anterior)
      const clavicle =
        gauss(y, 1.385, 0.013) *
        (gauss(absTheta, 0.42, 0.25) + 0.5 * gauss(absTheta, 0.18, 0.12))
      muscleRelief += clavicle * 0.008
      fasciaIntensity += clavicle * 0.65

      // 2. RECTUS ABDOMINIS (6-pack) + LINEA ALBA + LINEA SEMILUNARIS
      if (cosT > 0.3 && y > 0.79 && y < 1.16) {
        const abLateral = gauss(absTheta, 0.17, 0.10)
        const lineaAlba = gauss(theta, 0, 0.042) * gauss(y, 0.99, 0.13)
        const semilunaris = gauss(absTheta, 0.34, 0.045) * gauss(y, 0.99, 0.12)

        const row1 = gauss(y, 1.095, 0.025)
        const row2 = gauss(y, 1.015, 0.025)
        const row3 = gauss(y, 0.935, 0.025)
        const row4 = gauss(y, 0.855, 0.027)
        const packRows = row1 + row2 + row3 + 0.65 * row4

        const tend1 = gauss(y, 1.055, 0.008) * abLateral
        const tend2 = gauss(y, 1.015 - 0.04, 0.008) * abLateral
        const tend3 = gauss(y, 0.895, 0.008) * abLateral

        const abDefinition = Math.max(0.28, 1 - Math.max(0, bodyFatPct - 10) * 0.035)
        muscleRelief += abLateral * packRows * 0.011 * abDefinition
        muscleRelief -= (lineaAlba * 0.008 + semilunaris * 0.005) * abDefinition
        muscleIntensity += abLateral * packRows * 0.45
        fasciaIntensity +=
          (lineaAlba * 0.85 + semilunaris * 0.65 + (tend1 + tend2 + tend3) * 0.75) * abDefinition

        const navel = gauss2D(y, 0.92, 0.011, theta, 0, 0.038)
        muscleRelief -= navel * 0.012
      }

      // 3. SERRATUS ANTERIOR & EXTERNAL OBLIQUES
      if (y > 0.86 && y < 1.22) {
        const serratusRibs = 0.5 + 0.5 * Math.sin((y - 1.05) * 95 + absTheta * 6)
        const serratusZone = gauss(y, 1.13, 0.055) * gauss(absTheta, 0.85, 0.22)
        const obliqueZone = gauss(y, 0.95, 0.065) * gauss(absTheta, 0.78, 0.24)
        muscleRelief += serratusZone * serratusRibs * 0.007 + obliqueZone * 0.009
        muscleIntensity += (serratusZone + obliqueZone) * 0.38
      }

      // Inguinal V-line (Apollo's belt)
      const inguinalLine =
        gauss(y - (0.74 + absTheta * 0.14), 0, 0.015) * gauss(absTheta, 0.48, 0.26)
      muscleRelief += inguinalLine * 0.005
      fasciaIntensity += inguinalLine * 0.55

      // 4. POSTERIOR ANATOMY: Spinal furrow, Erector Spinae, Latissimus Dorsi, Trapezius, Scapulae, Glutes
      const backAngle = Math.PI - absTheta

      const spinalFurrow = gauss(backAngle, 0, 0.075) * gauss(y, 1.12, 0.22)
      muscleRelief -= spinalFurrow * 0.013
      fasciaIntensity += spinalFurrow * 0.75

      const erector = gauss(backAngle, 0.19, 0.10) * gauss(y, 1.02, 0.14)
      muscleRelief += erector * 0.011
      muscleIntensity += erector * 0.38

      const lumbarFascia = gauss(backAngle, 0.12, 0.18) * gauss(y, 0.93, 0.065)
      fasciaIntensity += lumbarFascia * 0.72

      const trapUpper = gauss(y, 1.41, 0.055) * gauss(backAngle, 0.45, 0.38)
      const trapMid = gauss(y, 1.26, 0.085) * gauss(backAngle, 0.28, 0.25)
      muscleRelief += (trapUpper + trapMid) * 0.012
      muscleIntensity += (trapUpper + trapMid) * 0.42

      const scapula = gauss(y, 1.27, 0.065) * gauss(backAngle, 0.58, 0.20)
      muscleRelief += scapula * 0.013
      muscleIntensity += scapula * 0.44

      const lats = gauss(y, 1.16, 0.10) * gauss(backAngle, 0.88, 0.28)
      muscleRelief += lats * (isFemale ? 0.010 : 0.017)
      muscleIntensity += lats * 0.44

      // 5. GLUTEUS MAXIMUS & GLUTEUS MEDIUS
      const gluteMax = gauss(y, 0.78, 0.058) * gauss(backAngle, 0.38, 0.26)
      const gluteMed = gauss(y, 0.86, 0.045) * gauss(backAngle, 0.78, 0.24)
      const interglutealCleft = gauss(y, 0.77, 0.075) * gauss(backAngle, 0, 0.055)
      const gluteFold = gauss(y, 0.71, 0.012) * gauss(backAngle, 0.38, 0.28)
      muscleRelief += gluteMax * (isFemale ? 0.032 : 0.025) + gluteMed * 0.011
      muscleRelief -= interglutealCleft * 0.018 + gluteFold * 0.010
      muscleIntensity += (gluteMax + gluteMed) * 0.5

      const normLen = Math.hypot(x, z) || 1
      x += (x / normLen) * muscleRelief
      z += (z / normLen) * muscleRelief

      positions.push(x, y, z)
      uvs.push(u, v)

      const isPelvisLower = y < 0.82
      const regionActive = isPelvisLower ? (params.lowerActive || trunkActive) : trunkActive
      const regionHex = isPelvisLower ? 0xf59e0b : 0x10b981

      const [cr, cg, cb] = computeTissueColor(
        muscleIntensity,
        fasciaIntensity,
        140,
        y + Math.abs(x) * 0.6,
        mode,
        regionActive,
        regionHex,
        bodyFatPct,
      )
      colors.push(cr, cg, cb)
    }
  }

  for (let iy = 0; iy < heightSegs; iy++) {
    for (let ix = 0; ix < radialSegs; ix++) {
      const a = iy * (radialSegs + 1) + ix
      const b = a + 1
      const c = a + (radialSegs + 1)
      const d = c + 1
      indices.push(a, b, d, a, d, c)
    }
  }

  const geom = new THREE.BufferGeometry()
  geom.setIndex(indices)
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geom.computeVertexNormals()
  return geom
}

/**
 * Builds an anatomically sculpted Head, Face & Neck (y from 1.41 to 1.80)
 * using 100% C-infinity smooth Gaussian profiles so there are zero creases on the cranium or neck.
 */
function buildAnatomicalHeadNeckGeometry(
  mode: AnatomicalRenderMode,
  trunkActive: boolean,
  bodyFatPct: number,
): THREE.BufferGeometry {
  const radialSegs = 64
  const heightSegs = 72
  const yMin = 1.41
  const yMax = 1.80

  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  for (let iy = 0; iy <= heightSegs; iy++) {
    const v = iy / heightSegs
    const y = lerp(yMin, yMax, v)

    // Smooth continuous transition from neck cylinder (y=1.41..1.56) to true ellipsoidal cranial crown (y=1.55..1.80)
    const headBlend = smoothstep(1.535, 1.60, y)
    const crownLinearT = Math.max(0, (y - 1.665) / (yMax - 1.665))
    const crownCap = Math.sqrt(Math.max(0.0002, 1 - crownLinearT * crownLinearT))

    // Neck radii with trapezius flare at base (y=1.41)
    const neckFlare = 0.014 * gauss(y, 1.41, 0.045)
    const neckRx = 0.052 + neckFlare
    const neckRzF = 0.050 + neckFlare * 0.8
    const neckRzB = 0.054 + neckFlare * 0.9

    // Cranial & facial volume centered around y=1.665 with true spherical dome cap
    const jawTaper = smoothstep(1.53, 1.63, y)
    const headRx = lerp(0.056, 0.086, jawTaper) * crownCap
    const headRzF = lerp(0.064, 0.095, jawTaper) * crownCap
    const headRzB = lerp(0.062, 0.098, jawTaper) * crownCap

    const rx = lerp(neckRx, headRx, headBlend)
    const rzFront = lerp(neckRzF, headRzF, headBlend)
    const rzBack = lerp(neckRzB, headRzB, headBlend)
    const zOffset = 0.014 * gauss(y, 1.61, 0.055) * crownCap

    for (let ix = 0; ix <= radialSegs; ix++) {
      const u = ix / radialSegs
      const theta = (u - 0.5) * Math.PI * 2
      const sinT = Math.sin(theta)
      const cosT = Math.cos(theta)
      const absTheta = Math.abs(theta)

      const rz = cosT >= 0 ? rzFront : rzBack
      let x = rx * sinT
      let z = rz * cosT + zOffset

      let relief = 0
      let muscleInt = 0.45
      let fasciaInt = 0.15

      // Sternocleidomastoid (V-shaped neck muscle) & Larynx
      const scmAngle = 0.16 + Math.max(0, (y - 1.42) / 0.14) * 0.95
      const scm = gauss(absTheta, scmAngle, 0.15) * gauss(y, 1.485, 0.045)
      const larynx = gauss2D(y, 1.495, 0.018, theta, 0, 0.18)
      relief += scm * 0.006 + larynx * 0.004
      muscleInt += scm * 0.45

      // Facial anatomical features (attenuated smoothly toward the crown)
      const chin = gauss2D(y, 1.562, 0.015, theta, 0, 0.24)
      const lips =
        gauss2D(y, 1.592, 0.008, theta, 0, 0.20) +
        gauss2D(y, 1.605, 0.008, theta, 0, 0.20)
      const nose =
        gauss2D(y, 1.642, 0.024, theta, 0, 0.10) +
        gauss2D(y, 1.627, 0.011, theta, 0, 0.085)
      const eyeSocket = gauss(y, 1.668, 0.014) * gauss(absTheta, 0.28, 0.12)
      const eyeball = gauss(y, 1.668, 0.008) * gauss(absTheta, 0.28, 0.07)
      const brow = gauss(y, 1.688, 0.010) * gauss(absTheta, 0.22, 0.26)
      const zygoma = gauss(y, 1.642, 0.018) * gauss(absTheta, 0.56, 0.18)
      const jaw = gauss(y, 1.585, 0.018) * gauss(absTheta, 0.66, 0.22)
      const ear = gauss(y, 1.650, 0.024) * gauss(absTheta, 1.48, 0.10)

      relief +=
        (chin * 0.011 +
          lips * 0.005 +
          nose * 0.016 +
          brow * 0.006 +
          zygoma * 0.006 +
          jaw * 0.006 +
          ear * 0.011 +
          eyeball * 0.004 -
          eyeSocket * 0.009) *
        crownCap
      fasciaInt += (nose + brow + zygoma + chin) * 0.32

      const normLen = Math.hypot(x, z) || 1
      x += (x / normLen) * relief
      z += (z / normLen) * relief

      positions.push(x, y, z)

      const [cr, cg, cb] = computeTissueColor(
        muscleInt,
        fasciaInt,
        110,
        y,
        mode,
        trunkActive,
        0x10b981,
        bodyFatPct,
      )
      colors.push(cr, cg, cb)
    }
  }

  for (let iy = 0; iy < heightSegs; iy++) {
    for (let ix = 0; ix < radialSegs; ix++) {
      const a = iy * (radialSegs + 1) + ix
      const b = a + 1
      const c = a + (radialSegs + 1)
      const d = c + 1
      indices.push(a, b, d, a, d, c)
    }
  }

  const geom = new THREE.BufferGeometry()
  geom.setIndex(indices)
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geom.computeVertexNormals()
  return geom
}

/**
 * Builds an anatomically sculpted Upper Limb (Deltoid, Biceps, Triceps, Forearm, Wrist & Hand)
 * using 100% continuous Gaussian radius profiles so there are zero creases at the deltoid, elbow, or wrist.
 */
function buildAnatomicalArmGeometry(params: {
  side: 1 | -1
  sex: 'male' | 'female'
  armScale: number
  chestScale: number
  mode: AnatomicalRenderMode
  upperActive: boolean
  bodyFatPct: number
}): THREE.BufferGeometry {
  const { side, sex, armScale, chestScale, mode, upperActive, bodyFatPct } = params
  const radialSegs = 48
  const lengthSegs = 84
  const isFemale = sex === 'female'

  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const acromionRootX = side * (isFemale ? 0.115 : 0.132) * chestScale
  const glenohumeralX = side * (isFemale ? 0.184 : 0.214) * chestScale

  for (let il = 0; il <= lengthSegs; il++) {
    const s = il / lengthSegs // 0 = acromion root (y=1.39), 0.45 = elbow, 0.82 = wrist, 1.0 = fingertips (y=0.63)
    const y = lerp(1.39, 0.63, s)

    const shoulderSweep = smoothstep(0.0, 0.18, s)
    const cx =
      lerp(acromionRootX, glenohumeralX, shoulderSweep) +
      side *
        (0.044 * smoothstep(0.14, 0.46, s) +
          0.070 * smoothstep(0.46, 0.85, s) +
          0.020 * smoothstep(0.85, 1.0, s))
    const cz = -0.012 * Math.sin(s * Math.PI) + 0.022 * smoothstep(0.45, 0.9, s)

    // True hemispherical dome caps at shoulder root (s->0) and fingertips (s->1)
    const topLinearT = Math.max(0, (0.085 - s) / 0.085)
    const topCap = Math.sqrt(Math.max(0.0004, 1 - topLinearT * topLinearT))
    const tipLinearT = Math.max(0, (s - 0.89) / 0.11)
    const tipCap = Math.sqrt(Math.max(0.0004, 1 - tipLinearT * tipLinearT))
    const endCaps = topCap * tipCap

    // Continuous smooth anatomical radius profile along arm (zero piecewise jumps!)
    const baseTaper = lerp(isFemale ? 0.045 : 0.052, 0.023, Math.min(1, s / 0.84))
    const deltoidSwell = (isFemale ? 0.010 : 0.015) * gauss(s, 0.11, 0.075)
    const brachiumSwell = (isFemale ? 0.005 : 0.009) * gauss(s, 0.30, 0.085)
    const elbowIndent = -0.0035 * gauss(s, 0.45, 0.045)
    const forearmSwell = (isFemale ? 0.007 : 0.010) * gauss(s, 0.57, 0.085)
    const wristNarrow = -0.005 * gauss(s, 0.81, 0.045)
    const palmBroadAP = 0.013 * gauss(s, 0.90, 0.048)
    const palmThinLat = -0.006 * gauss(s, 0.91, 0.055)

    const rLat = (baseTaper + deltoidSwell + brachiumSwell + elbowIndent + forearmSwell + wristNarrow + palmThinLat) * armScale * endCaps
    const rAP = (baseTaper * 1.04 + deltoidSwell + brachiumSwell * 1.15 + elbowIndent + forearmSwell * 1.05 + wristNarrow + palmBroadAP) * armScale * endCaps

    for (let ir = 0; ir <= radialSegs; ir++) {
      const u = ir / radialSegs
      const theta = (u - 0.5) * Math.PI * 2
      const sinT = Math.sin(theta)
      const cosT = Math.cos(theta)

      let relief = 0
      let muscleInt = 0.45
      let fasciaInt = 0.05

      // 1. Deltoid 3 heads (Anterior, Lateral, Posterior)
      const deltAnt = gauss2D(s, 0.12, 0.06, theta, 0.45, 0.48)
      const deltLat = gauss2D(s, 0.13, 0.065, theta, 1.57, 0.50)
      const deltPost = gauss2D(s, 0.12, 0.06, theta, 2.65, 0.48)
      relief += (deltAnt + deltLat * 1.2 + deltPost) * (isFemale ? 0.006 : 0.010) * armScale * endCaps
      muscleInt += (deltAnt + deltLat + deltPost) * 0.42

      // 2. Biceps Brachii
      const biceps = gauss2D(s, 0.31, 0.065, theta, 0.0, 0.55)
      relief += biceps * (isFemale ? 0.006 : 0.011) * armScale * endCaps
      muscleInt += biceps * 0.5

      // 3. Triceps Brachii Lateral & Long heads + Horseshoe Tendon
      const tricepsLat = gauss2D(s, 0.29, 0.06, theta, 2.35, 0.45)
      const tricepsLong = gauss2D(s, 0.31, 0.065, theta, -2.55, 0.45)
      const tricepsTendon = gauss2D(s, 0.40, 0.045, theta, 3.0, 0.45)
      relief += (tricepsLat + tricepsLong) * (isFemale ? 0.006 : 0.010) * armScale * endCaps
      muscleInt += (tricepsLat + tricepsLong) * 0.45
      fasciaInt += tricepsTendon * 0.72

      // 4. Brachioradialis & Forearm Flexors/Extensors
      const brachioradialis = gauss2D(s, 0.55, 0.075, theta, 0.85, 0.45)
      const flexors = gauss2D(s, 0.58, 0.075, theta, -0.55, 0.5)
      relief += (brachioradialis + flexors) * 0.006 * armScale * endCaps
      muscleInt += (brachioradialis + flexors) * 0.38

      if (s > 0.72) {
        fasciaInt += smoothstep(0.72, 0.85, s) * 0.55
      }

      const localX = (rLat + relief) * sinT * side
      const localZ = (rAP + relief) * cosT

      const armTilt = side * 0.14
      const wx = cx + localX * Math.cos(armTilt)
      const wy = y + localX * Math.sin(armTilt) * 0.25
      const wz = cz + localZ

      positions.push(wx, wy, wz)

      const [cr, cg, cb] = computeTissueColor(
        muscleInt,
        fasciaInt,
        130,
        s * 1.4 + theta * 0.05,
        mode,
        upperActive,
        0x6366f1,
        bodyFatPct,
      )
      colors.push(cr, cg, cb)
    }
  }

  for (let il = 0; il < lengthSegs; il++) {
    for (let ir = 0; ir < radialSegs; ir++) {
      const a = il * (radialSegs + 1) + ir
      const b = a + 1
      const c = a + (radialSegs + 1)
      const d = c + 1
      if (side === 1) {
        indices.push(a, b, d, a, d, c)
      } else {
        indices.push(a, d, b, a, c, d)
      }
    }
  }

  const geom = new THREE.BufferGeometry()
  geom.setIndex(indices)
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geom.computeVertexNormals()
  return geom
}

/**
 * Builds an anatomically sculpted Lower Limb (Quadriceps 3 heads, Hamstrings, Adductors, Knee/Patella, Gastrocnemius, Soleus, Ankle & Foot)
 * using 100% continuous Gaussian radius profiles so there are zero creases at the hip, knee, or ankle!
 */
function buildAnatomicalLegGeometry(params: {
  side: 1 | -1
  sex: 'male' | 'female'
  thighScale: number
  calfScale: number
  mode: AnatomicalRenderMode
  lowerActive: boolean
  bodyFatPct: number
}): THREE.BufferGeometry {
  const { side, sex, thighScale, calfScale, mode, lowerActive, bodyFatPct } = params
  const radialSegs = 56
  const lengthSegs = 92
  const isFemale = sex === 'female'

  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  for (let il = 0; il <= lengthSegs; il++) {
    const s = il / lengthSegs // 0 = iliac crest / gluteus medius root (y=0.87), 0.50 = knee (y=0.42), 0.91 = ankle (y=0.08), 1.0 = toes (y=0.02)
    const y = s <= 0.92 ? lerp(0.87, 0.08, s / 0.92) : lerp(0.08, 0.02, (s - 0.92) / 0.08)

    const cx =
      side *
      (lerp(isFemale ? 0.074 : 0.070, 0.094, smoothstep(0.0, 0.20, s)) +
        0.006 * Math.sin(s * Math.PI))
    const cz =
      -0.007 * Math.sin(s * Math.PI * 1.5) +
      0.048 * smoothstep(0.89, 0.98, s)

    // True hemispherical dome caps at iliac/hip origin (s->0) and toes (s->1)
    const topLinearT = Math.max(0, (0.075 - s) / 0.075)
    const topCap = Math.sqrt(Math.max(0.0004, 1 - topLinearT * topLinearT))
    const toeLinearT = Math.max(0, (s - 0.935) / 0.065)
    const toeCap = Math.sqrt(Math.max(0.0004, 1 - toeLinearT * toeLinearT))
    const endCaps = topCap * toeCap

    // Continuous smooth anatomical radius profile from hip to toes (zero piecewise jumps!)
    const baseTaper = lerp(isFemale ? 0.088 : 0.083, 0.033, Math.min(1, s / 0.90))
    const thighSwell = (isFemale ? 0.012 : 0.011) * gauss(s, 0.21, 0.11)
    const kneeNarrow = -0.0045 * gauss(s, 0.49, 0.045)
    const calfSwell = 0.015 * gauss(s, 0.66, 0.085)
    const ankleNarrow = -0.0045 * gauss(s, 0.88, 0.04)
    const footSwellAP = 0.036 * gauss(s, 0.95, 0.038)
    const footSwellLat = 0.008 * gauss(s, 0.94, 0.038)

    const limbScale = lerp(thighScale, calfScale, smoothstep(0.42, 0.58, s))
    const rLat = (baseTaper + thighSwell + kneeNarrow + calfSwell + ankleNarrow + footSwellLat) * limbScale * endCaps
    const rAP = (baseTaper * 1.05 + thighSwell * 1.1 + kneeNarrow + calfSwell * 1.15 + ankleNarrow + footSwellAP) * limbScale * endCaps

    for (let ir = 0; ir <= radialSegs; ir++) {
      const u = ir / radialSegs
      const theta = (u - 0.5) * Math.PI * 2
      const sinT = Math.sin(theta)
      const cosT = Math.cos(theta)

      let relief = 0
      let muscleInt = 0.45
      let fasciaInt = 0.05

      // 1. QUADRICEPS FEMORIS
      const rectusFemoris = gauss2D(s, 0.24, 0.09, theta, 0.08, 0.35)
      const vastusLat = gauss2D(s, 0.25, 0.10, theta, 1.15, 0.45)
      const vastusMed = gauss2D(s, 0.37, 0.055, theta, -0.68, 0.38)
      const adductors = gauss2D(s, 0.16, 0.075, theta, -1.35, 0.48)

      relief +=
        (rectusFemoris * 0.010 + vastusLat * 0.013 + vastusMed * 0.011 + adductors * 0.009) *
        thighScale *
        endCaps
      muscleInt += (rectusFemoris + vastusLat + vastusMed + adductors) * 0.44

      // IT Band fascia groove along lateral thigh
      const itBand = gauss(s, 0.27, 0.12) * gauss(theta, 1.57, 0.14)
      relief -= itBand * 0.0035 * endCaps
      fasciaInt += itBand * 0.72

      // 2. HAMSTRINGS (Biceps Femoris & Semitendinosus)
      const bicepsFemoris = gauss2D(s, 0.26, 0.10, theta, 2.65, 0.42)
      const semitendinosus = gauss2D(s, 0.26, 0.10, theta, -2.65, 0.42)
      relief += (bicepsFemoris + semitendinosus) * 0.010 * thighScale * endCaps
      muscleInt += (bicepsFemoris + semitendinosus) * 0.42

      // 3. PATELLA & Patellar Tendon
      const patella = gauss2D(s, 0.49, 0.025, theta, 0, 0.35)
      const patellarTendon = gauss2D(s, 0.535, 0.025, theta, 0, 0.25)
      relief += (patella * 0.007 + patellarTendon * 0.0035) * endCaps
      fasciaInt += (patella + patellarTendon) * 0.85

      // 4. GASTROCNEMIUS, Tibialis Anterior & Achilles Tendon
      const gastrocMed = gauss2D(s, 0.65, 0.055, theta, -2.65, 0.38)
      const gastrocLat = gauss2D(s, 0.64, 0.052, theta, 2.65, 0.38)
      const tibialisAnt = gauss2D(s, 0.67, 0.075, theta, 0.35, 0.35)
      const tibiaCrest = gauss2D(s, 0.70, 0.11, theta, -0.08, 0.14)
      const achilles = gauss(s, 0.83, 0.06) * gauss(Math.PI - Math.abs(theta), 0, 0.32)

      relief += ((gastrocMed * 0.012 + gastrocLat * 0.010 + tibialisAnt * 0.006) * calfScale + achilles * 0.005) * endCaps
      muscleInt += (gastrocMed + gastrocLat + tibialisAnt) * 0.48
      fasciaInt += tibiaCrest * 0.7 + achilles * 0.9

      const wx = cx + (rLat + relief) * sinT * side
      const wy = y
      const wz = cz + (rAP + relief) * cosT

      positions.push(wx, wy, wz)

      const [cr, cg, cb] = computeTissueColor(
        muscleInt,
        fasciaInt,
        130,
        s * 1.5,
        mode,
        lowerActive,
        0xf59e0b,
        bodyFatPct,
      )
      colors.push(cr, cg, cb)
    }
  }

  for (let il = 0; il < lengthSegs; il++) {
    for (let ir = 0; ir < radialSegs; ir++) {
      const a = il * (radialSegs + 1) + ir
      const b = a + 1
      const c = a + (radialSegs + 1)
      const d = c + 1
      if (side === 1) {
        indices.push(a, b, d, a, d, c)
      } else {
        indices.push(a, d, b, a, c, d)
      }
    }
  }

  const geom = new THREE.BufferGeometry()
  geom.setIndex(indices)
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geom.computeVertexNormals()
  return geom
}

export function AnatomicalBody3D({
  activeRegion,
  onSelectRegion,
  sex = 'male',
  bodyFatPct,
  leanMassKg,
  fatMassKg,
  skinfolds,
  circumferences,
  requiredSkinfolds = [],
}: AnatomicalBody3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [viewPreset, setViewPreset] = useState<AnatomicalViewPreset>('three_quarter')
  const [renderMode, setRenderMode] = useState<AnatomicalRenderMode>('ecorche')
  const [autoRotate, setAutoRotate] = useState<boolean>(true)
  const [showPins, setShowPins] = useState<boolean>(true)
  const [selectedLandmark, setSelectedLandmark] = useState<AnatomicalLandmarkPin | null>(null)

  // Camera orbit refs framed so 100% of the body from cranial crown (y=1.81) to feet (y=0.01) is visible!
  const targetAzimuthRef = useRef<number>(0.28)
  const currentAzimuthRef = useRef<number>(0.28)
  const targetPolarRef = useRef<number>(1.50)
  const currentPolarRef = useRef<number>(1.50)
  const targetZoomRef = useRef<number>(3.05)
  const currentZoomRef = useRef<number>(3.05)
  const autoRotateRef = useRef<boolean>(true)
  const isDraggingRef = useRef<boolean>(false)

  useEffect(() => {
    autoRotateRef.current = autoRotate
  }, [autoRotate])

  const handleSelectViewPreset = (preset: AnatomicalViewPreset) => {
    setViewPreset(preset)
    setAutoRotate(false)
    if (preset === 'front') {
      targetAzimuthRef.current = 0
      targetPolarRef.current = 1.50
    } else if (preset === 'back') {
      targetAzimuthRef.current = Math.PI
      targetPolarRef.current = 1.50
    } else if (preset === 'side') {
      targetAzimuthRef.current = -Math.PI / 2
      targetPolarRef.current = 1.50
    } else {
      targetAzimuthRef.current = 0.28
      targetPolarRef.current = 1.48
    }
  }

  const morphScales = useMemo(() => {
    const waistCm = Number(circumferences?.waist || 82)
    const chestCm = Number(circumferences?.chest || 100)
    const hipCm = Number(circumferences?.hip || 99)
    const armCm = Number(circumferences?.armRight || 36)
    const thighCm = Number(circumferences?.thighRight || 58)
    const calfCm = Number(circumferences?.calfRight || 38)

    return {
      waistScale: Math.max(0.82, Math.min(1.32, waistCm / 82)),
      chestScale: Math.max(0.86, Math.min(1.24, chestCm / 100)),
      hipScale: Math.max(0.86, Math.min(1.26, hipCm / 99)),
      armScale: Math.max(0.82, Math.min(1.32, armCm / 36)),
      thighScale: Math.max(0.84, Math.min(1.28, thighCm / 58)),
      calfScale: Math.max(0.85, Math.min(1.25, calfCm / 38)),
    }
  }, [circumferences])

  const anatomicalPins = useMemo<AnatomicalLandmarkPin[]>(() => {
    const { waistScale, chestScale, hipScale, armScale, thighScale } = morphScales
    const reqSet = new Set<string>(requiredSkinfolds)
    return [
      {
        id: 'sf_chest',
        label: 'Dobra Peitoral',
        valueLabel: `${Number(skinfolds?.chest ?? 10).toFixed(1)} mm`,
        hint: 'Diagonal entre a linha axilar anterior e o mamilo (Pectoralis Major)',
        region: 'trunk',
        kind: 'skinfold',
        position: [-0.105 * chestScale, 1.27, 0.122 * chestScale],
        highlighted: reqSet.has('chest'),
      },
      {
        id: 'sf_midaxillary',
        label: 'Dobra Axilar Média',
        valueLabel: `${Number(skinfolds?.midaxillary ?? 11).toFixed(1)} mm`,
        hint: 'Linha axilar média no nível do apêndice xifoide (Serratus Anterior)',
        region: 'trunk',
        kind: 'skinfold',
        position: [-0.17 * chestScale, 1.15, 0.02],
        highlighted: reqSet.has('midaxillary'),
      },
      {
        id: 'sf_abdomen',
        label: 'Dobra Abdominal',
        valueLabel: `${Number(skinfolds?.abdomen ?? 18).toFixed(1)} mm`,
        hint: 'Vertical, 2 cm à direita da cicatriz umbilical (Rectus Abdominis)',
        region: 'trunk',
        kind: 'skinfold',
        position: [-0.045 * waistScale, 0.93, 0.112 * waistScale],
        highlighted: reqSet.has('abdomen'),
      },
      {
        id: 'sf_suprailiac',
        label: 'Dobra Supra-ilíaca',
        valueLabel: `${Number(skinfolds?.suprailiac ?? 14).toFixed(1)} mm`,
        hint: 'Diagonal acima da crista ilíaca na linha axilar anterior (Obliquus Externus)',
        region: 'trunk',
        kind: 'skinfold',
        position: [-0.14 * waistScale, 0.89, 0.072 * waistScale],
        highlighted: reqSet.has('suprailiac'),
      },
      {
        id: 'sf_subscapular',
        label: 'Dobra Subescapular',
        valueLabel: `${Number(skinfolds?.subscapular ?? 13).toFixed(1)} mm`,
        hint: '2 cm abaixo do ângulo inferior da escápula a 45° (Infraspinatus / Rhomboideus)',
        region: 'trunk',
        kind: 'skinfold',
        position: [-0.095 * chestScale, 1.23, -0.122 * chestScale],
        highlighted: reqSet.has('subscapular'),
      },
      {
        id: 'sf_biceps',
        label: 'Dobra Bicipital',
        valueLabel: `${Number(skinfolds?.biceps ?? 6).toFixed(1)} mm`,
        hint: 'Face anterior do braço sobre o ventre do Biceps Brachii',
        region: 'upper_limb',
        kind: 'skinfold',
        position: [-0.255 * chestScale, 1.16, 0.055 * armScale],
        highlighted: reqSet.has('biceps'),
      },
      {
        id: 'sf_triceps',
        label: 'Dobra Tricipital',
        valueLabel: `${Number(skinfolds?.triceps ?? 10).toFixed(1)} mm`,
        hint: 'Face posterior do braço, ponto médio acrômio-olécrano (Triceps Brachii)',
        region: 'upper_limb',
        kind: 'skinfold',
        position: [-0.258 * chestScale, 1.17, -0.062 * armScale],
        highlighted: reqSet.has('triceps'),
      },
      {
        id: 'sf_thigh',
        label: 'Dobra Coxa Medial',
        valueLabel: `${Number(skinfolds?.thigh ?? 14).toFixed(1)} mm`,
        hint: 'Ponto médio entre a prega inguinal e a borda superior da patela (Rectus Femoris)',
        region: 'lower_limb',
        kind: 'skinfold',
        position: [-0.098, 0.57, 0.090 * thighScale],
        highlighted: reqSet.has('thigh'),
      },
      {
        id: 'circ_waist',
        label: 'Perímetro Cintura',
        valueLabel: `${Number(circumferences?.waist ?? 83.5).toFixed(1)} cm`,
        hint: 'Menor perímetro entre a última costela e a crista ilíaca',
        region: 'trunk',
        kind: 'circumference',
        position: [0.142 * waistScale, 0.97, 0.03],
        highlighted: true,
      },
      {
        id: 'circ_hip',
        label: 'Perímetro Quadril',
        valueLabel: `${Number(circumferences?.hip ?? 99.5).toFixed(1)} cm`,
        hint: 'Maior proeminência glútea posterior (Gluteus Maximus)',
        region: 'lower_limb',
        kind: 'circumference',
        position: [0.174 * hipScale, 0.79, -0.02],
        highlighted: true,
      },
    ]
  }, [morphScales, skinfolds, circumferences, requiredSkinfolds])

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || 320
    const height = container.clientHeight || 460

    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(37, width / height, 0.1, 50)
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15

    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.9)
    keyLight.position.set(2.2, 3.2, 2.8)
    scene.add(keyLight)

    const backRimLight = new THREE.DirectionalLight(0x38bdf8, 1.45)
    backRimLight.position.set(-2.4, 2.2, -2.6)
    scene.add(backRimLight)

    const rightFillLight = new THREE.DirectionalLight(0x34d399, 0.85)
    rightFillLight.position.set(-2.5, 1.0, 1.8)
    scene.add(rightFillLight)

    const bottomBounce = new THREE.PointLight(0x10b981, 0.75, 4)
    bottomBounce.position.set(0, 0.1, 0.8)
    scene.add(bottomBounce)

    const rootGroup = new THREE.Group()
    scene.add(rootGroup)

    // Illuminated Clinical Diagnostic Platform Base
    const baseRingGeom = new THREE.RingGeometry(0.28, 0.34, 64)
    baseRingGeom.rotateX(-Math.PI / 2)
    const baseRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.48,
    })
    const baseRing = new THREE.Mesh(baseRingGeom, baseRingMat)
    baseRing.position.y = 0.015
    rootGroup.add(baseRing)

    const innerDiskGeom = new THREE.CircleGeometry(0.28, 64)
    innerDiskGeom.rotateX(-Math.PI / 2)
    const innerDiskMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.75,
    })
    const innerDisk = new THREE.Mesh(innerDiskGeom, innerDiskMat)
    innerDisk.position.y = 0.012
    rootGroup.add(innerDisk)

    const tissueMaterial = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: renderMode === 'ecorche' ? 0.35 : 0.42,
      metalness: 0.06,
      clearcoat: renderMode === 'ecorche' ? 0.45 : 0.25,
      clearcoatRoughness: 0.28,
      reflectivity: 0.6,
    })

    const trunkActive = activeRegion === 'all' || activeRegion === 'trunk'
    const upperActive = activeRegion === 'all' || activeRegion === 'upper_limb'
    const lowerActive = activeRegion === 'all' || activeRegion === 'lower_limb'

    // 1. Torso & Pelvis
    const torsoGeom = buildAnatomicalTorsoGeometry({
      sex,
      bodyFatPct,
      waistScale: morphScales.waistScale,
      chestScale: morphScales.chestScale,
      hipScale: morphScales.hipScale,
      mode: renderMode,
      trunkActive,
      lowerActive,
    })
    const torsoMesh = new THREE.Mesh(torsoGeom, tissueMaterial)
    torsoMesh.userData = { region: 'trunk', label: 'Tronco, Tórax, Abdômen & Dorso' }
    rootGroup.add(torsoMesh)

    // 2. Head & Neck
    const headGeom = buildAnatomicalHeadNeckGeometry(renderMode, trunkActive, bodyFatPct)
    const headMesh = new THREE.Mesh(headGeom, tissueMaterial)
    headMesh.userData = { region: 'trunk', label: 'Cabeça, Crânio & Pescoço (Esternocleidomastoideo)' }
    rootGroup.add(headMesh)

    // 3. Left & Right Upper Limbs
    const leftArmGeom = buildAnatomicalArmGeometry({
      side: 1,
      sex,
      armScale: morphScales.armScale,
      chestScale: morphScales.chestScale,
      mode: renderMode,
      upperActive,
      bodyFatPct,
    })
    const leftArmMesh = new THREE.Mesh(leftArmGeom, tissueMaterial)
    leftArmMesh.userData = {
      region: 'upper_limb',
      label: 'Membro Superior Esq. (Deltoide, Bíceps, Tríceps & Antebraço)',
    }
    rootGroup.add(leftArmMesh)

    const rightArmGeom = buildAnatomicalArmGeometry({
      side: -1,
      sex,
      armScale: morphScales.armScale,
      chestScale: morphScales.chestScale,
      mode: renderMode,
      upperActive,
      bodyFatPct,
    })
    const rightArmMesh = new THREE.Mesh(rightArmGeom, tissueMaterial)
    rightArmMesh.userData = {
      region: 'upper_limb',
      label: 'Membro Superior Dir. (Deltoide, Bíceps, Tríceps & Antebraço)',
    }
    rootGroup.add(rightArmMesh)

    // 4. Left & Right Lower Limbs
    const leftLegGeom = buildAnatomicalLegGeometry({
      side: 1,
      sex,
      thighScale: morphScales.thighScale,
      calfScale: morphScales.calfScale,
      mode: renderMode,
      lowerActive,
      bodyFatPct,
    })
    const leftLegMesh = new THREE.Mesh(leftLegGeom, tissueMaterial)
    leftLegMesh.userData = {
      region: 'lower_limb',
      label: 'Membro Inferior Esq. (Quadríceps, Isquiotibiais & Gastrocnêmio)',
    }
    rootGroup.add(leftLegMesh)

    const rightLegGeom = buildAnatomicalLegGeometry({
      side: -1,
      sex,
      thighScale: morphScales.thighScale,
      calfScale: morphScales.calfScale,
      mode: renderMode,
      lowerActive,
      bodyFatPct,
    })
    const rightLegMesh = new THREE.Mesh(rightLegGeom, tissueMaterial)
    rightLegMesh.userData = {
      region: 'lower_limb',
      label: 'Membro Inferior Dir. (Quadríceps, Isquiotibiais & Gastrocnêmio)',
    }
    rootGroup.add(rightLegMesh)

    const interactiveMeshes: THREE.Object3D[] = [
      torsoMesh,
      headMesh,
      leftArmMesh,
      rightArmMesh,
      leftLegMesh,
      rightLegMesh,
    ]

    if (showPins) {
      const createTapeRing = (
        yLevel: number,
        rxRing: number,
        rzRing: number,
        xOffset: number,
        colorHex: number,
      ) => {
        const pts: THREE.Vector3[] = []
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2
          pts.push(new THREE.Vector3(xOffset + Math.sin(a) * rxRing, yLevel, Math.cos(a) * rzRing))
        }
        const curve = new THREE.CatmullRomCurve3(pts, true)
        const tubeGeom = new THREE.TubeGeometry(curve, 64, 0.0032, 8, true)
        const tubeMat = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.72,
        })
        return new THREE.Mesh(tubeGeom, tubeMat)
      }

      if (trunkActive) {
        rootGroup.add(
          createTapeRing(
            0.97,
            (sex === 'female' ? 0.132 : 0.145) * morphScales.waistScale,
            0.102 * morphScales.waistScale,
            0,
            0x34d399,
          ),
        )
        rootGroup.add(
          createTapeRing(
            1.24,
            (sex === 'female' ? 0.162 : 0.190) * morphScales.chestScale,
            0.132 * morphScales.chestScale,
            0,
            0x38bdf8,
          ),
        )
      }

      if (lowerActive) {
        rootGroup.add(
          createTapeRing(
            0.80,
            (sex === 'female' ? 0.188 : 0.166) * morphScales.hipScale,
            0.134 * morphScales.hipScale,
            0,
            0xfbbf24,
          ),
        )
        rootGroup.add(
          createTapeRing(
            0.57,
            0.076 * morphScales.thighScale,
            0.080 * morphScales.thighScale,
            -0.095,
            0xfbbf24,
          ),
        )
      }

      for (const pin of anatomicalPins) {
        const isRegionVisible = activeRegion === 'all' || activeRegion === pin.region
        const radius = pin.highlighted ? 0.017 : 0.013
        const pinGeom = new THREE.SphereGeometry(radius, 18, 18)
        const pinColor =
          pin.kind === 'skinfold'
            ? pin.highlighted
              ? 0x10b981
              : 0x38bdf8
            : 0xf59e0b
        const pinMat = new THREE.MeshPhysicalMaterial({
          color: pinColor,
          emissive: pinColor,
          emissiveIntensity: isRegionVisible ? (pin.highlighted ? 0.85 : 0.45) : 0.15,
          roughness: 0.2,
          clearcoat: 1,
        })
        const pinMesh = new THREE.Mesh(pinGeom, pinMat)
        pinMesh.position.set(pin.position[0], pin.position[1], pin.position[2])
        pinMesh.userData = { region: pin.region, pin }
        rootGroup.add(pinMesh)
        interactiveMeshes.push(pinMesh)

        if (pin.highlighted && isRegionVisible) {
          const haloGeom = new THREE.RingGeometry(0.021, 0.027, 24)
          const haloMat = new THREE.MeshBasicMaterial({
            color: 0xa7f3d0,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
          })
          const haloMesh = new THREE.Mesh(haloGeom, haloMat)
          haloMesh.position.copy(pinMesh.position)
          haloMesh.lookAt(pinMesh.position.x * 2, pinMesh.position.y, pinMesh.position.z * 2)
          rootGroup.add(haloMesh)
        }
      }
    }

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let downX = 0
    let downY = 0
    let lastX = 0
    let lastY = 0

    const domEl = renderer.domElement
    const onPointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true
      downX = e.clientX
      downY = e.clientY
      lastX = e.clientX
      lastY = e.clientY
      domEl.setPointerCapture?.(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        autoRotateRef.current = false
      }
      targetAzimuthRef.current -= dx * 0.011
      targetPolarRef.current = Math.max(0.85, Math.min(2.15, targetPolarRef.current - dy * 0.008))
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      domEl.releasePointerCapture?.(e.pointerId)

      const movedDist = Math.hypot(e.clientX - downX, e.clientY - downY)
      if (movedDist < 6) {
        const rect = domEl.getBoundingClientRect()
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
        raycaster.setFromCamera(pointer, camera)
        const hits = raycaster.intersectObjects(interactiveMeshes, false)
        if (hits.length > 0) {
          const hitObj = hits[0].object
          if (hitObj.userData?.pin) {
            const p = hitObj.userData.pin as AnatomicalLandmarkPin
            setSelectedLandmark(p)
            onSelectRegion(p.region)
          } else if (hitObj.userData?.region) {
            const clickedRegion = hitObj.userData.region as BodyRegionFilter
            onSelectRegion(activeRegion === clickedRegion ? 'all' : clickedRegion)
          }
        }
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      targetZoomRef.current = Math.max(1.8, Math.min(3.8, targetZoomRef.current + e.deltaY * 0.0015))
    }

    domEl.addEventListener('pointerdown', onPointerDown)
    domEl.addEventListener('pointermove', onPointerMove)
    domEl.addEventListener('pointerup', onPointerUp)
    domEl.addEventListener('wheel', onWheel, { passive: false })

    let animId = 0
    const centerTarget = new THREE.Vector3(0, 0.91, 0)

    const animate = () => {
      animId = requestAnimationFrame(animate)
      if (autoRotateRef.current && !isDraggingRef.current) {
        targetAzimuthRef.current += 0.0045
      }
      currentAzimuthRef.current = lerp(currentAzimuthRef.current, targetAzimuthRef.current, 0.12)
      currentPolarRef.current = lerp(currentPolarRef.current, targetPolarRef.current, 0.12)
      currentZoomRef.current = lerp(currentZoomRef.current, targetZoomRef.current, 0.12)

      const r = currentZoomRef.current
      const polar = currentPolarRef.current
      const az = currentAzimuthRef.current

      camera.position.set(
        r * Math.sin(polar) * Math.sin(az),
        centerTarget.y + r * Math.cos(polar),
        r * Math.sin(polar) * Math.cos(az),
      )
      camera.lookAt(centerTarget)
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth || 320
      const h = container.clientHeight || 460
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
      domEl.removeEventListener('pointerdown', onPointerDown)
      domEl.removeEventListener('pointermove', onPointerMove)
      domEl.removeEventListener('pointerup', onPointerUp)
      domEl.removeEventListener('wheel', onWheel)
      torsoGeom.dispose()
      headGeom.dispose()
      leftArmGeom.dispose()
      rightArmGeom.dispose()
      leftLegGeom.dispose()
      rightLegGeom.dispose()
      tissueMaterial.dispose()
      renderer.dispose()
    }
  }, [
    sex,
    bodyFatPct,
    morphScales,
    renderMode,
    activeRegion,
    showPins,
    anatomicalPins,
    onSelectRegion,
  ])

  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white p-4 flex flex-col justify-between gap-3 shadow-lg">
      {/* Cabeçalho do Modelo Anatômico 3D */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-display font-bold text-xs sm:text-sm text-slate-100">
              Modelo Anatômico 3D Interativo
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block">
            Arraste para girar 360° • Clique nos músculos ou pontos
          </span>
        </div>

        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
          WebGL 3D • {sex === 'female' ? 'Anatomia Feminina' : 'Anatomia Masculina'}
        </Badge>
      </div>

      {/* Barra de Modo Anatômico (Ecorché Muscular, Composição %G, Regiões) */}
      <div className="w-full grid grid-cols-3 gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
        <button
          type="button"
          onClick={() => setRenderMode('ecorche')}
          className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 ${
            renderMode === 'ecorche'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3 h-3" />
          <span>Músculos 3D</span>
        </button>
        <button
          type="button"
          onClick={() => setRenderMode('composition')}
          className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 ${
            renderMode === 'composition'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Eye className="w-3 h-3" />
          <span>Mapa %G</span>
        </button>
        <button
          type="button"
          onClick={() => setRenderMode('clinical')}
          className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 ${
            renderMode === 'clinical'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <span>Regiões</span>
        </button>
      </div>

      {/* Viewport 3D WebGL */}
      <div className="relative w-full h-[450px] rounded-2xl overflow-hidden border border-slate-800/90 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800/55 via-slate-950 to-slate-950">
        <div
          ref={mountRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          aria-label="Modelo anatômico humano 3D interativo"
        />

        {/* Botões Flutuantes de Câmera (Frente, Costas, Perfil, 360°, Pontos) */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1 pointer-events-none">
          <div className="flex items-center gap-1 pointer-events-auto bg-slate-950/80 backdrop-blur-xs border border-slate-800 rounded-xl p-1">
            {(
              [
                { id: 'front', label: 'Frente' },
                { id: 'back', label: 'Costas' },
                { id: 'side', label: 'Perfil' },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSelectViewPreset(v.id)}
                className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition ${
                  viewPreset === v.id && !autoRotate
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 pointer-events-auto">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAutoRotate((r) => !r)}
              className={`h-7 px-2 text-[10px] gap-1 border-slate-700 ${
                autoRotate
                  ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-950/80 text-slate-300'
              }`}
              title="Alternar rotação automática 360°"
            >
              <RotateCw className={`w-3 h-3 ${autoRotate ? 'animate-spin' : ''}`} />
              <span>360°</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowPins((s) => !s)}
              className={`h-7 px-2 text-[10px] border-slate-700 ${
                showPins
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-950/80 text-slate-400'
              }`}
            >
              Pontos
            </Button>
          </div>
        </div>

        {/* HUD Clínico do Ponto Anatômico Selecionado */}
        {selectedLandmark ? (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-emerald-500/40 p-2.5 text-xs flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-emerald-300">{selectedLandmark.label}</span>
                <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">
                  {selectedLandmark.valueLabel}
                </Badge>
              </div>
              <p className="text-[10px] text-slate-300 leading-snug">{selectedLandmark.hint}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedLandmark(null)}
              className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[10px] text-slate-300 bg-slate-950/75 backdrop-blur-xs border border-slate-800/80 rounded-xl px-2.5 py-1.5">
            <span>
              Região ativa:{' '}
              <strong className="text-emerald-400">
                {activeRegion === 'all'
                  ? 'Corpo Inteiro'
                  : activeRegion === 'trunk'
                    ? 'Tronco & Abdômen'
                    : activeRegion === 'upper_limb'
                      ? 'Membros Superiores'
                      : 'Membros Inferiores'}
              </strong>
            </span>
            <span className="text-slate-400">Toque em um ponto para detalhes</span>
          </div>
        )}
      </div>

      {/* Cards de Indicadores de Composição Corporal */}
      <div className="w-full grid grid-cols-3 gap-1.5 text-center text-[11px]">
        <div className="rounded-xl bg-slate-800/90 p-2.5 border border-slate-700/70">
          <span className="block text-slate-400">% Gordura</span>
          <strong className="text-sm font-display text-emerald-400">{bodyFatPct}%</strong>
        </div>
        <div className="rounded-xl bg-slate-800/90 p-2.5 border border-slate-700/70">
          <span className="block text-slate-400">M. Magra</span>
          <strong className="text-sm font-display text-indigo-300">{leanMassKg} kg</strong>
        </div>
        <div className="rounded-xl bg-slate-800/90 p-2.5 border border-slate-700/70">
          <span className="block text-slate-400">M. Gorda</span>
          <strong className="text-sm font-display text-amber-300">{fatMassKg} kg</strong>
        </div>
      </div>
    </div>
  )
}
