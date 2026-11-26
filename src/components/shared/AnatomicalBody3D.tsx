import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { BodyRegionFilter } from './BodyMapSvg'
import type { CircumferencesMap, SkinfoldKey, SkinfoldsMap } from '@/domain/anthropometry'
import {
  Bone,
  Eye,
  EyeOff,
  Focus,
  Layers,
  RotateCcw,
  RotateCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react'

export type AnatomicalViewPreset = 'front' | 'back' | 'side' | 'three_quarter'
export type ZygoteLayerPreset = 'both' | 'xray' | 'deep' | 'skeleton'

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

export interface SelectedAnatomyStructure {
  meshName: string
  namePt: string
  nameEn: string
  layer: 'superficial muscles' | 'deep muscles' | 'skeleton'
  layerPt: string
  sidePt: string
  groupPt: string
  fma: string
  region: Exclude<BodyRegionFilter, 'all'>
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

/**
 * Translates English/Latin Z-Anatomy / BodyParts3D structure names to Clinical Portuguese (Terminologia Anatômica).
 */
export function translateStructureNamePt(rawName: string): string {
  if (!rawName) return 'Estrutura Anatômica'
  let s = rawName.trim()

  const exactReplacements: [RegExp, string][] = [
    [/\bLeft\b/gi, 'Esq.'],
    [/\bRight\b/gi, 'Dir.'],
    [/\bpectoralis major\b/gi, 'Peitoral Maior'],
    [/\bpectoralis minor\b/gi, 'Peitoral Menor'],
    [/\bdeltoid\b/gi, 'Deltoide'],
    [/\brectus abdominis\b/gi, 'Reto Abdominal'],
    [/\bexternal abdominal oblique\b/gi, 'Oblíquo Externo do Abdômen'],
    [/\binternal abdominal oblique\b/gi, 'Oblíquo Interno do Abdômen'],
    [/\btransversus abdominis\b/gi, 'Transverso do Abdômen'],
    [/\bserratus anterior\b/gi, 'Serrátil Anterior'],
    [/\blatissimus dorsi\b/gi, 'Latíssimo do Dorso (Grande Dorsal)'],
    [/\btrapezius\b/gi, 'Trapézio'],
    [/\brhomboid major\b/gi, 'Romboide Maior'],
    [/\brhomboid minor\b/gi, 'Romboide Menor'],
    [/\binfraspinatus\b/gi, 'Infraespinhal'],
    [/\bsupraspinatus\b/gi, 'Supraespinhal'],
    [/\bteres major\b/gi, 'Redondo Maior'],
    [/\bteres minor\b/gi, 'Redondo Menor'],
    [/\bsubscapularis\b/gi, 'Subescapular'],
    [/\bbiceps brachii\b/gi, 'Bíceps Braquial'],
    [/\btriceps brachii\b/gi, 'Tríceps Braquial'],
    [/\bbrachialis\b/gi, 'Braquial'],
    [/\bbrachioradialis\b/gi, 'Braquiorradial'],
    [/\bcoracobrachialis\b/gi, 'Coracobraquial'],
    [/\bsternocleidomastoid\b/gi, 'Esternocleidomastoideo'],
    [/\bgluteus maximus\b/gi, 'Glúteo Máximo'],
    [/\bgluteus medius\b/gi, 'Glúteo Médio'],
    [/\bgluteus minimus\b/gi, 'Glúteo Mínimo'],
    [/\btensor fasciae latae\b/gi, 'Tensor da Fáscia Lata'],
    [/\biliotibial tract\b/gi, 'Trato Iliotibial'],
    [/\bsartorius\b/gi, 'Sartório'],
    [/\brectus femoris\b/gi, 'Reto Femoral (Quadríceps)'],
    [/\bvastus lateralis\b/gi, 'Vasto Lateral (Quadríceps)'],
    [/\bvastus medialis\b/gi, 'Vasto Medial (Quadríceps)'],
    [/\bvastus intermedius\b/gi, 'Vasto Intermédio (Quadríceps)'],
    [/\bbiceps femoris\b/gi, 'Bíceps Femoral (Isquiotibiais)'],
    [/\bsemitendinosus\b/gi, 'Semitendíneo (Isquiotibiais)'],
    [/\bsemimembranosus\b/gi, 'Semimembranáceo (Isquiotibiais)'],
    [/\bgracilis\b/gi, 'Grácil'],
    [/\badductor magnus\b/gi, 'Adutor Magno'],
    [/\badductor longus\b/gi, 'Adutor Longo'],
    [/\badductor brevis\b/gi, 'Adutor Curto'],
    [/\bpectineus\b/gi, 'Pectíneo'],
    [/\biliopsoas\b/gi, 'Iliopsoas'],
    [/\bpsoas major\b/gi, 'Psoas Maior'],
    [/\biliacus\b/gi, 'Ilíaco'],
    [/\bgastrocnemius\b/gi, 'Gastrocnêmio (Panturrilha)'],
    [/\bsoleus\b/gi, 'Sóleo (Panturrilha)'],
    [/\btibialis anterior\b/gi, 'Tibial Anterior'],
    [/\btibialis posterior\b/gi, 'Tibial Posterior'],
    [/\bfibularis longus\b/gi, 'Fibular Longo'],
    [/\bfibularis brevis\b/gi, 'Fibular Curto'],
    [/\berector spinae\b/gi, 'Eretor da Espinha'],
    [/\biliocostalis\b/gi, 'Iliocostal'],
    [/\blongissimus\b/gi, 'Longuíssimo'],
    [/\bspinalis\b/gi, 'Espinhal'],
    [/\bmasseter\b/gi, 'Masseter'],
    [/\btemporalis\b/gi, 'Temporal'],
    [/\borbicularis oculi\b/gi, 'Orbicular do Olho'],
    [/\borbicularis oris\b/gi, 'Orbicular da Boca'],
    [/\bzygomaticus major\b/gi, 'Zigomático Maior'],
    [/\bfrontalis\b/gi, 'Frontal'],
    [/\boccipitalis\b/gi, 'Occipital'],
    [/\bclavicle\b/gi, 'Clavícula'],
    [/\bscapula\b/gi, 'Escápula'],
    [/\bsternum\b/gi, 'Esterno'],
    [/\bmanubrium\b/gi, 'Manúbrio do Esterno'],
    [/\bhumerus\b/gi, 'Úmero'],
    [/\bradius\b/gi, 'Rádio'],
    [/\bulna\b/gi, 'Ulna'],
    [/\bfemur\b/gi, 'Fêmur'],
    [/\bpatella\b/gi, 'Patela'],
    [/\btibia\b/gi, 'Tíbia'],
    [/\bfibula\b/gi, 'Fíbula'],
    [/\bhip bone\b/gi, 'Osso do Quadril (Pelve)'],
    [/\bsacrum\b/gi, 'Sacro'],
    [/\bcoccyx\b/gi, 'Cóccix'],
    [/\bcranium\b/gi, 'Crânio'],
    [/\bmandible\b/gi, 'Mandíbula'],
    [/\brib\b/gi, 'Costela'],
    [/\bvertebra\b/gi, 'Vértebra'],
    [/\bcalcaneus\b/gi, 'Calcâneo'],
    [/\btalus\b/gi, 'Tálus'],
    [/\bLong head of\b/gi, 'Cabeça Longa -'],
    [/\bShort head of\b/gi, 'Cabeça Curta -'],
    [/\bLateral head of\b/gi, 'Cabeça Lateral -'],
    [/\bMedial head of\b/gi, 'Cabeça Medial -'],
    [/\bClavicular part of\b/gi, 'Porção Clavicular -'],
    [/\bSternocostal part of\b/gi, 'Porção Esternocostal -'],
    [/\bAbdominal part of\b/gi, 'Porção Abdominal -'],
    [/\bDescending part of\b/gi, 'Porção Descendente -'],
    [/\bTransverse part of\b/gi, 'Porção Transversa -'],
    [/\bAscending part of\b/gi, 'Porção Ascendente -'],
    [/\bSpinal part of\b/gi, 'Porção Espinhal -'],
    [/\bAcromial part of\b/gi, 'Porção Acromial -'],
  ]

  for (const [regex, rep] of exactReplacements) {
    s = s.replace(regex, rep)
  }

  // Move trailing Esq./Dir. nicely if needed
  if (s.startsWith('Esq. ')) {
    s = `${s.slice(5)} (Esq.)`
  } else if (s.startsWith('Dir. ')) {
    s = `${s.slice(5)} (Dir.)`
  }
  return s
}

/**
 * Classifies a 3D mesh into one of the 3 clinical anthropometric regions ('trunk' | 'upper_limb' | 'lower_limb')
 * based on its anatomical name and 3D bounding box center.
 */
function classifyMeshRegion(
  rawName: string,
  groupName: string,
  center: THREE.Vector3,
): Exclude<BodyRegionFilter, 'all'> {
  const text = `${rawName} ${groupName}`.toLowerCase()
  if (
    /biceps brachii|triceps|deltoid|brachial|forearm|carpi|pollicis|digitorum|hand|humerus|radius|ulna|metacarp|wrist|elbow|pronator|supinator|anconeus/.test(
      text,
    ) &&
    !/femoris|hallucis|foot|toe|plantar|pedis/.test(text)
  ) {
    return 'upper_limb'
  }
  if (
    /femoris|vastus|glute|sartorius|gracilis|adductor|gastrocnemius|soleus|tibial|fibula|femur|patella|tibia|calcaneus|talus|foot|toe|hallucis|plantar|popliteus|iliotibial|hamstring|ankle|knee/.test(
      text,
    )
  ) {
    return 'lower_limb'
  }
  if (center.y < 0.80) return 'lower_limb'
  if (Math.abs(center.x) > 0.165 && center.y > 0.72 && center.y < 1.46) return 'upper_limb'
  return 'trunk'
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

  // Zygote Body loading state
  const [loadProgress, setLoadProgress] = useState<number>(0)
  const [modelLoaded, setModelLoaded] = useState<boolean>(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Zygote Body Layer & Opacity Peeling Controls
  const [layerPreset, setLayerPreset] = useState<ZygoteLayerPreset>('both')
  const [outerMuscleOpacity, setOuterMuscleOpacity] = useState<number>(100)
  const [deepMuscleOpacity, setDeepMuscleOpacity] = useState<number>(100)
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true)
  const [showPins, setShowPins] = useState<boolean>(true)
  const [autoRotate, setAutoRotate] = useState<boolean>(false)
  const [viewPreset, setViewPreset] = useState<AnatomicalViewPreset>('front')

  // Zygote Body Search, Hover & Selected Structure
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchableStructures, setSearchableStructures] = useState<SelectedAnatomyStructure[]>([])
  const [hoveredStructureName, setHoveredStructureName] = useState<string | null>(null)
  const [selectedStructure, setSelectedStructure] = useState<SelectedAnatomyStructure | null>(null)
  const [selectedLandmark, setSelectedLandmark] = useState<AnatomicalLandmarkPin | null>(null)
  const [hiddenMeshNames, setHiddenMeshNames] = useState<Set<string>>(new Set())

  // Scene refs for instant reactive updates without reloading the 6 MB GLB
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const meshesRef = useRef<THREE.Mesh[]>([])
  const pinsGroupRef = useRef<THREE.Group | null>(null)
  const materialsRef = useRef<{
    bone: THREE.Material
    deepMuscle: THREE.Material
    outerMuscle: THREE.Material
    hover: Record<string, THREE.Material>
    pick: Record<string, THREE.Material>
    dimmed: THREE.Material
  } | null>(null)
  const flyAnimRef = useRef<{
    t0: number
    p0: THREE.Vector3
    p1: THREE.Vector3
    c0: THREE.Vector3
    c1: THREE.Vector3
  } | null>(null)
  const selectedMeshNameRef = useRef<string | null>(null)
  const hoveredMeshRef = useRef<THREE.Mesh | null>(null)
  const activeRegionRef = useRef<BodyRegionFilter>(activeRegion)
  const hiddenMeshNamesRef = useRef<Set<string>>(hiddenMeshNames)
  const outerOpacityRef = useRef<number>(1)
  const deepOpacityRef = useRef<number>(1)
  const showSkeletonRef = useRef<boolean>(true)

  useEffect(() => {
    activeRegionRef.current = activeRegion
  }, [activeRegion])

  useEffect(() => {
    hiddenMeshNamesRef.current = hiddenMeshNames
  }, [hiddenMeshNames])

  // 3D Anthropometric Landmarks aligned to the Z-Anatomy / BodyParts3D coordinate system (height 0..1.76m)
  const anatomicalPins = useMemo<AnatomicalLandmarkPin[]>(() => {
    const reqSet = new Set<string>(requiredSkinfolds)
    return [
      {
        id: 'sf_chest',
        label: 'Dobra Peitoral',
        valueLabel: `${Number(skinfolds?.chest ?? 10).toFixed(1)} mm`,
        hint: 'Diagonal entre a linha axilar anterior e o mamilo (Peitoral Maior)',
        region: 'trunk',
        kind: 'skinfold',
        position: [-0.105, 1.255, 0.125],
        highlighted: reqSet.has('chest'),
      },
      {
        id: 'sf_midaxillary',
        label: 'Dobra Axilar Média',
        valueLabel: `${Number(skinfolds?.midaxillary ?? 11).toFixed(1)} mm`,
        hint: 'Linha axilar média no nível do processo xifoide (Serrátil Anterior)',
        region: 'trunk',
        kind: 'skinfold',
        position: [-0.155, 1.15, 0.015],
        highlighted: reqSet.has('midaxillary'),
      },
      {
        id: 'sf_abdomen',
        label: 'Dobra Abdominal',
        valueLabel: `${Number(skinfolds?.abdomen ?? 18).toFixed(1)} mm`,
        hint: 'Vertical, 2 cm à direita da cicatriz umbilical (Reto Abdominal)',
        region: 'trunk',
        kind: 'skinfold',
        position: [-0.042, 0.985, 0.118],
        highlighted: reqSet.has('abdomen'),
      },
      {
        id: 'sf_suprailiac',
        label: 'Dobra Supra-ilíaca',
        valueLabel: `${Number(skinfolds?.suprailiac ?? 14).toFixed(1)} mm`,
        hint: 'Diagonal acima da crista ilíaca na linha axilar anterior (Oblíquo Externo)',
        region: 'trunk',
        kind: 'skinfold',
        position: [-0.138, 0.945, 0.075],
        highlighted: reqSet.has('suprailiac'),
      },
      {
        id: 'sf_subscapular',
        label: 'Dobra Subescapular',
        valueLabel: `${Number(skinfolds?.subscapular ?? 13).toFixed(1)} mm`,
        hint: '2 cm abaixo do ângulo inferior da escápula a 45° (Infraespinhal / Trapézio)',
        region: 'trunk',
        kind: 'skinfold',
        position: [-0.092, 1.23, -0.118],
        highlighted: reqSet.has('subscapular'),
      },
      {
        id: 'sf_biceps',
        label: 'Dobra Bicipital',
        valueLabel: `${Number(skinfolds?.biceps ?? 6).toFixed(1)} mm`,
        hint: 'Face anterior do braço sobre o ventre do Bíceps Braquial',
        region: 'upper_limb',
        kind: 'skinfold',
        position: [-0.235, 1.16, 0.035],
        highlighted: reqSet.has('biceps'),
      },
      {
        id: 'sf_triceps',
        label: 'Dobra Tricipital',
        valueLabel: `${Number(skinfolds?.triceps ?? 10).toFixed(1)} mm`,
        hint: 'Face posterior do braço, ponto médio acrômio-olécrano (Tríceps Braquial)',
        region: 'upper_limb',
        kind: 'skinfold',
        position: [-0.242, 1.17, -0.055],
        highlighted: reqSet.has('triceps'),
      },
      {
        id: 'sf_thigh',
        label: 'Dobra Coxa Medial',
        valueLabel: `${Number(skinfolds?.thigh ?? 14).toFixed(1)} mm`,
        hint: 'Ponto médio entre a prega inguinal e a borda superior da patela (Reto Femoral)',
        region: 'lower_limb',
        kind: 'skinfold',
        position: [-0.095, 0.62, 0.095],
        highlighted: reqSet.has('thigh'),
      },
      {
        id: 'circ_waist',
        label: 'Perímetro Cintura',
        valueLabel: `${Number(circumferences?.waist ?? 83.5).toFixed(1)} cm`,
        hint: 'Menor perímetro entre a última costela e a crista ilíaca',
        region: 'trunk',
        kind: 'circumference',
        position: [0.135, 1.02, 0.03],
        highlighted: true,
      },
      {
        id: 'circ_hip',
        label: 'Perímetro Quadril',
        valueLabel: `${Number(circumferences?.hip ?? 99.5).toFixed(1)} cm`,
        hint: 'Maior proeminência glútea posterior (Glúteo Máximo)',
        region: 'lower_limb',
        kind: 'circumference',
        position: [0.162, 0.86, -0.02],
        highlighted: true,
      },
    ]
  }, [skinfolds, circumferences, requiredSkinfolds])

  // Synchronize materials, layer opacities, hidden structures & region filter across all 634 meshes
  const syncMaterialsAndVisibility = useCallback(() => {
    const mats = materialsRef.current
    if (!mats) return

    const outerAlpha = outerOpacityRef.current
    const deepAlpha = deepOpacityRef.current
    const skelVis = showSkeletonRef.current
    const regFilter = activeRegionRef.current
    const hiddenSet = hiddenMeshNamesRef.current
    const selName = selectedMeshNameRef.current
    const hovMesh = hoveredMeshRef.current

    // Update outer muscle materials
    ;[mats.outerMuscle, mats.hover.outerMuscle, mats.pick.outerMuscle].forEach((m) => {
      if (!m) return
      m.transparent = outerAlpha < 0.99
      m.opacity = outerAlpha
      m.depthWrite = outerAlpha >= 0.99
      m.needsUpdate = true
    })

    // Update deep muscle materials
    ;[mats.deepMuscle, mats.hover.deepMuscle, mats.pick.deepMuscle].forEach((m) => {
      if (!m) return
      m.transparent = deepAlpha < 0.99
      m.opacity = deepAlpha
      m.depthWrite = deepAlpha >= 0.99
      m.needsUpdate = true
    })

    for (const mesh of meshesRef.current) {
      const layer = mesh.userData.layer as string
      const meshRegion = mesh.userData.region as Exclude<BodyRegionFilter, 'all'>
      const isHiddenManual = hiddenSet.has(mesh.name)

      if (isHiddenManual) {
        mesh.visible = false
        continue
      }

      if (layer === 'skeleton') {
        mesh.visible = skelVis
      } else if (layer === 'deep muscles') {
        mesh.visible = deepAlpha > 0.03
      } else {
        mesh.visible = outerAlpha > 0.03
      }

      if (!mesh.visible) continue

      const baseKey =
        layer === 'skeleton'
          ? 'bone'
          : layer === 'deep muscles'
            ? 'deepMuscle'
            : 'outerMuscle'

      const isSelected = selName && mesh.name === selName
      const isHovered = hovMesh === mesh
      const isRegionMatch = regFilter === 'all' || regFilter === meshRegion

      if (isSelected) {
        mesh.material = mats.pick[baseKey]
      } else if (isHovered) {
        mesh.material = mats.hover[baseKey]
      } else if (!isRegionMatch) {
        mesh.material = mats.dimmed
      } else {
        mesh.material = (mats as any)[baseKey]
      }
    }
  }, [])

  // Rebuild 3D Anthropometric Pins & Circumference Rings whenever values or visibility change
  useEffect(() => {
    const pinsGroup = pinsGroupRef.current
    if (!pinsGroup) return

    while (pinsGroup.children.length > 0) {
      const child = pinsGroup.children[0]
      pinsGroup.remove(child)
    }

    if (!showPins) return

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
      const tubeGeom = new THREE.TubeGeometry(curve, 64, 0.0028, 8, true)
      const tubeMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.75,
      })
      return new THREE.Mesh(tubeGeom, tubeMat)
    }

    if (activeRegion === 'all' || activeRegion === 'trunk') {
      pinsGroup.add(createTapeRing(1.02, 0.138, 0.105, 0, 0x10b981))
      pinsGroup.add(createTapeRing(1.25, 0.165, 0.125, 0, 0x38bdf8))
    }
    if (activeRegion === 'all' || activeRegion === 'lower_limb') {
      pinsGroup.add(createTapeRing(0.86, 0.165, 0.122, 0, 0xf59e0b))
      pinsGroup.add(createTapeRing(0.62, 0.082, 0.085, -0.095, 0xf59e0b))
    }

    for (const pin of anatomicalPins) {
      const isRegionVisible = activeRegion === 'all' || activeRegion === pin.region
      const radius = pin.highlighted ? 0.015 : 0.011
      const pinGeom = new THREE.SphereGeometry(radius, 16, 16)
      const pinColor =
        pin.kind === 'skinfold'
          ? pin.highlighted
            ? 0x10b981
            : 0x38bdf8
          : 0xf59e0b
      const pinMat = new THREE.MeshPhysicalMaterial({
        color: pinColor,
        emissive: pinColor,
        emissiveIntensity: isRegionVisible ? (pin.highlighted ? 0.9 : 0.45) : 0.15,
        roughness: 0.2,
        clearcoat: 1,
      })
      const pinMesh = new THREE.Mesh(pinGeom, pinMat)
      pinMesh.position.set(pin.position[0], pin.position[1], pin.position[2])
      pinMesh.userData = { isPin: true, pin }
      pinsGroup.add(pinMesh)

      if (pin.highlighted && isRegionVisible) {
        const haloGeom = new THREE.RingGeometry(0.019, 0.025, 24)
        const haloMat = new THREE.MeshBasicMaterial({
          color: 0xa7f3d0,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
        })
        const haloMesh = new THREE.Mesh(haloGeom, haloMat)
        haloMesh.position.copy(pinMesh.position)
        haloMesh.lookAt(pinMesh.position.x * 2, pinMesh.position.y, pinMesh.position.z * 2)
        pinsGroup.add(haloMesh)
      }
    }
  }, [showPins, anatomicalPins, activeRegion, modelLoaded])

  // React to layer sliders, region filter, and hidden meshes
  useEffect(() => {
    outerOpacityRef.current = outerMuscleOpacity / 100
    deepOpacityRef.current = deepMuscleOpacity / 100
    showSkeletonRef.current = showSkeleton
    syncMaterialsAndVisibility()
  }, [
    outerMuscleOpacity,
    deepMuscleOpacity,
    showSkeleton,
    activeRegion,
    hiddenMeshNames,
    selectedStructure,
    syncMaterialsAndVisibility,
  ])

  // Main WebGL initialization & GLB loader (runs once on mount)
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || 340
    const height = container.clientHeight || 480

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.AgXToneMapping
    renderer.toneMappingExposure = 1.08

    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Studio anatomical environment lighting (identical to Zygote Body / Z-Anatomy)
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 0.85

    const keyLight = new THREE.DirectionalLight(0xfff4e8, 1.65)
    keyLight.position.set(2, 3, 2.5)
    scene.add(keyLight)

    const rimLight = new THREE.DirectionalLight(0xe8f0ff, 0.95)
    rimLight.position.set(-2.5, 2, -2.5)
    scene.add(rimLight)

    // Illuminated Clinical Diagnostic Platform Ring under feet
    const baseRingGeom = new THREE.RingGeometry(0.26, 0.31, 64)
    baseRingGeom.rotateX(-Math.PI / 2)
    const baseRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    })
    const baseRing = new THREE.Mesh(baseRingGeom, baseRingMat)
    baseRing.position.y = 0.004
    scene.add(baseRing)

    const camera = new THREE.PerspectiveCamera(30, width / height, 0.05, 50)
    camera.position.set(0, 1.05, 3.65)
    cameraRef.current = camera

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.90, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 0.35
    controls.maxDistance = 7
    controls.maxPolarAngle = Math.PI * 0.92
    controls.update()
    controlsRef.current = controls

    const pinsGroup = new THREE.Group()
    scene.add(pinsGroup)
    pinsGroupRef.current = pinsGroup

    // Resolve GLB path for both local dev ('/') and GitHub Pages ('/mylabs/')
    const glbBase =
      typeof window !== 'undefined' && window.location.pathname.startsWith('/mylabs')
        ? '/mylabs'
        : ''
    const modelUrl = `${glbBase}/models/ecorche.meshopt.glb`

    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    let isDisposed = false

    loader.load(
      modelUrl,
      (gltf) => {
        if (isDisposed) return
        scene.add(gltf.scene)

        const baseMats: Record<string, THREE.Material> = {}
        const allMeshes: THREE.Mesh[] = []
        const structuresCatalog: SelectedAnatomyStructure[] = []

        gltf.scene.traverse((obj) => {
          if (!(obj as THREE.Mesh).isMesh) return
          const mesh = obj as THREE.Mesh
          const ud = mesh.userData || {}
          const mat = mesh.material as THREE.MeshStandardMaterial
          baseMats[mat.name] = mat

          // Compute bounding box center to classify region ('trunk' | 'upper_limb' | 'lower_limb')
          mesh.geometry.computeBoundingBox()
          const box = mesh.geometry.boundingBox!
          const center = box.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)

          const rawName = String(ud.name || mesh.name || 'Structure')
          const namePt = translateStructureNamePt(rawName)
          const layer = (ud.layer || 'superficial muscles') as
            | 'superficial muscles'
            | 'deep muscles'
            | 'skeleton'
          const region = classifyMeshRegion(rawName, String(ud.group || ''), center)

          const layerPt =
            layer === 'skeleton'
              ? 'Esqueleto Ósseo'
              : layer === 'deep muscles'
                ? 'Músculo Profundo'
                : 'Músculo Superficial'
          const sidePt =
            ud.side === 'left' ? 'Esquerdo' : ud.side === 'right' ? 'Direito' : 'Mediano / Axial'

          const structMeta: SelectedAnatomyStructure = {
            meshName: mesh.name,
            namePt,
            nameEn: rawName,
            layer,
            layerPt,
            sidePt,
            groupPt: ud.group ? translateStructureNamePt(String(ud.group)) : layerPt,
            fma: String(ud.fma || 'Z-Anatomy'),
            region,
          }

          mesh.userData.region = region
          mesh.userData.structMeta = structMeta
          allMeshes.push(mesh)
          structuresCatalog.push(structMeta)
        })

        meshesRef.current = allMeshes
        setSearchableStructures(
          structuresCatalog.sort((a, b) => a.namePt.localeCompare(b.namePt)),
        )

        const boneMat = (baseMats.Bone || allMeshes[0].material).clone() as THREE.MeshStandardMaterial
        const deepMuscleMat = (baseMats.Muscle || allMeshes[0].material).clone() as THREE.MeshStandardMaterial
        const outerMuscleMat = (baseMats.Muscle || allMeshes[0].material).clone() as THREE.MeshStandardMaterial

        const makeHover = (m: THREE.MeshStandardMaterial) => {
          const h = m.clone()
          h.emissive = new THREE.Color(0x10b981)
          h.emissiveIntensity = 0.28
          return h
        }

        const makePick = (m: THREE.MeshStandardMaterial) => {
          const p = m.clone()
          p.vertexColors = false
          p.color = new THREE.Color(0x34d399)
          p.emissive = new THREE.Color(0x065f46)
          p.emissiveIntensity = 0.35
          return p
        }

        const dimmedMat = deepMuscleMat.clone()
        dimmedMat.transparent = true
        dimmedMat.opacity = 0.14
        dimmedMat.depthWrite = false

        materialsRef.current = {
          bone: boneMat,
          deepMuscle: deepMuscleMat,
          outerMuscle: outerMuscleMat,
          hover: {
            bone: makeHover(boneMat),
            deepMuscle: makeHover(deepMuscleMat),
            outerMuscle: makeHover(outerMuscleMat),
          },
          pick: {
            bone: makePick(boneMat),
            deepMuscle: makePick(deepMuscleMat),
            outerMuscle: makePick(outerMuscleMat),
          },
          dimmed: dimmedMat,
        }

        syncMaterialsAndVisibility()
        setLoadProgress(100)
        setModelLoaded(true)
      },
      (evt) => {
        if (evt.total) {
          setLoadProgress(Math.round((evt.loaded / evt.total) * 100))
        }
      },
      (err) => {
        if (!isDisposed) {
          setLoadError(err instanceof Error ? err.message : 'Erro ao carregar modelo 3D.')
        }
      },
    )

    // Raycasting for Hover & Click on all 634 muscles/bones + 3D anthropometric pins
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let downPos: { x: number; y: number } | null = null
    let hoverTimer = 0

    const pickAtClientXY = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)

      // 1. Check 3D anthropometric pins first
      if (pinsGroupRef.current && pinsGroupRef.current.children.length > 0) {
        const pinHits = raycaster.intersectObjects(pinsGroupRef.current.children, false)
        const hitPin = pinHits.find((h) => h.object.userData?.isPin)
        if (hitPin) {
          return { kind: 'pin' as const, pin: hitPin.object.userData.pin as AnatomicalLandmarkPin }
        }
      }

      // 2. Check visible anatomical meshes (if outer muscles are peeled below 35%, pick deep muscles/bones underneath!)
      const ignoreSuperficial = outerOpacityRef.current < 0.35
      const pickable = meshesRef.current.filter(
        (m) =>
          m.visible &&
          !(ignoreSuperficial && m.userData.layer === 'superficial muscles'),
      )
      const hits = raycaster.intersectObjects(pickable, false)
      if (hits.length > 0) {
        return { kind: 'mesh' as const, mesh: hits[0].object as THREE.Mesh }
      }
      return null
    }

    const domEl = renderer.domElement
    const onPointerDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!downPos) return
      const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y)
      downPos = null
      if (dist >= 6) return

      const picked = pickAtClientXY(e.clientX, e.clientY)
      if (!picked) {
        selectedMeshNameRef.current = null
        setSelectedStructure(null)
        setSelectedLandmark(null)
        syncMaterialsAndVisibility()
        return
      }

      if (picked.kind === 'pin') {
        setSelectedLandmark(picked.pin)
        setSelectedStructure(null)
        selectedMeshNameRef.current = null
        onSelectRegion(picked.pin.region)
        syncMaterialsAndVisibility()
      } else {
        const meta = picked.mesh.userData.structMeta as SelectedAnatomyStructure
        selectedMeshNameRef.current = picked.mesh.name
        setSelectedStructure(meta)
        setSelectedLandmark(null)
        onSelectRegion(meta.region)
        syncMaterialsAndVisibility()
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons !== 0) return
      window.clearTimeout(hoverTimer)
      hoverTimer = window.setTimeout(() => {
        const picked = pickAtClientXY(e.clientX, e.clientY)
        if (picked?.kind === 'mesh') {
          if (hoveredMeshRef.current !== picked.mesh) {
            hoveredMeshRef.current = picked.mesh
            const meta = picked.mesh.userData.structMeta as SelectedAnatomyStructure
            setHoveredStructureName(`${meta.namePt} • ${meta.layerPt}`)
            domEl.style.cursor = 'pointer'
            syncMaterialsAndVisibility()
          }
        } else if (picked?.kind === 'pin') {
          hoveredMeshRef.current = null
          setHoveredStructureName(`${picked.pin.label} (${picked.pin.valueLabel})`)
          domEl.style.cursor = 'pointer'
          syncMaterialsAndVisibility()
        } else if (hoveredMeshRef.current !== null) {
          hoveredMeshRef.current = null
          setHoveredStructureName(null)
          domEl.style.cursor = ''
          syncMaterialsAndVisibility()
        }
      }, 40)
    }

    domEl.addEventListener('pointerdown', onPointerDown)
    domEl.addEventListener('pointerup', onPointerUp)
    domEl.addEventListener('pointermove', onPointerMove)

    let animId = 0
    const animate = () => {
      animId = requestAnimationFrame(animate)
      if (flyAnimRef.current) {
        const fly = flyAnimRef.current
        const t = Math.min(1, (performance.now() - fly.t0) / 750)
        const ease = 1 - Math.pow(1 - t, 3)
        camera.position.lerpVectors(fly.p0, fly.p1, ease)
        controls.target.lerpVectors(fly.c0, fly.c1, ease)
        if (t >= 1) flyAnimRef.current = null
      }
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth || 340
      const h = container.clientHeight || 480
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      isDisposed = true
      cancelAnimationFrame(animId)
      window.clearTimeout(hoverTimer)
      window.removeEventListener('resize', handleResize)
      domEl.removeEventListener('pointerdown', onPointerDown)
      domEl.removeEventListener('pointerup', onPointerUp)
      domEl.removeEventListener('pointermove', onPointerMove)
      controls.dispose()
      pmrem.dispose()
      renderer.dispose()
    }
  }, [onSelectRegion, syncMaterialsAndVisibility])

  // Sync autoRotate with OrbitControls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate
      controlsRef.current.autoRotateSpeed = 1.8
    }
  }, [autoRotate])

  const flyCameraTo = useCallback((targetPos: THREE.Vector3, targetLookAt: THREE.Vector3) => {
    const cam = cameraRef.current
    const ctrl = controlsRef.current
    if (!cam || !ctrl) return
    flyAnimRef.current = {
      t0: performance.now(),
      p0: cam.position.clone(),
      p1: targetPos.clone(),
      c0: ctrl.target.clone(),
      c1: targetLookAt.clone(),
    }
  }, [])

  const handleSelectViewPreset = (preset: AnatomicalViewPreset) => {
    setViewPreset(preset)
    setAutoRotate(false)
    const center = new THREE.Vector3(0, 0.90, 0)
    if (preset === 'front') {
      flyCameraTo(new THREE.Vector3(0, 1.02, 3.65), center)
    } else if (preset === 'back') {
      flyCameraTo(new THREE.Vector3(0, 1.02, -3.65), center)
    } else if (preset === 'side') {
      flyCameraTo(new THREE.Vector3(-3.65, 1.02, 0), center)
    } else {
      flyCameraTo(new THREE.Vector3(1.35, 1.15, 3.45), center)
    }
  }

  const handleApplyLayerPreset = (preset: ZygoteLayerPreset) => {
    setLayerPreset(preset)
    if (preset === 'both') {
      setOuterMuscleOpacity(100)
      setDeepMuscleOpacity(100)
      setShowSkeleton(true)
    } else if (preset === 'xray') {
      setOuterMuscleOpacity(28)
      setDeepMuscleOpacity(90)
      setShowSkeleton(true)
    } else if (preset === 'deep') {
      setOuterMuscleOpacity(0)
      setDeepMuscleOpacity(100)
      setShowSkeleton(true)
    } else if (preset === 'skeleton') {
      setOuterMuscleOpacity(0)
      setDeepMuscleOpacity(0)
      setShowSkeleton(true)
    }
  }

  const handleFocusStructure = useCallback(
    (struct: SelectedAnatomyStructure) => {
      const mesh = meshesRef.current.find((m) => m.name === struct.meshName)
      const cam = cameraRef.current
      const ctrl = controlsRef.current
      if (!mesh || !cam || !ctrl) return

      // Ensure its layer is visible
      if (struct.layer === 'skeleton' && !showSkeleton) setShowSkeleton(true)
      if (struct.layer === 'deep muscles' && deepMuscleOpacity < 20) setDeepMuscleOpacity(100)
      if (struct.layer === 'superficial muscles' && outerMuscleOpacity < 20) {
        setOuterMuscleOpacity(100)
      }

      selectedMeshNameRef.current = mesh.name
      setSelectedStructure(struct)
      setSelectedLandmark(null)
      onSelectRegion(struct.region)
      syncMaterialsAndVisibility()

      const box = new THREE.Box3().setFromObject(mesh)
      const center = box.getCenter(new THREE.Vector3())
      const radius = Math.max(0.16, box.getSize(new THREE.Vector3()).length() * 0.95)
      const dir = new THREE.Vector3(center.x, 0, center.z - 0.02)
      if (dir.length() < 0.03) {
        dir.copy(cam.position).sub(ctrl.target).setY(0)
      }
      dir.normalize().setY(0.16).normalize()
      const dist = radius / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
      flyCameraTo(center.clone().addScaledVector(dir, dist), center)
    },
    [
      showSkeleton,
      deepMuscleOpacity,
      outerMuscleOpacity,
      onSelectRegion,
      syncMaterialsAndVisibility,
      flyCameraTo,
    ],
  )

  const handleHideSelectedMesh = () => {
    if (!selectedStructure) return
    setHiddenMeshNames((prev) => {
      const next = new Set(prev)
      next.add(selectedStructure.meshName)
      return next
    })
    selectedMeshNameRef.current = null
    setSelectedStructure(null)
  }

  const handleResetDissection = () => {
    setHiddenMeshNames(new Set())
    selectedMeshNameRef.current = null
    setSelectedStructure(null)
    setSelectedLandmark(null)
    onSelectRegion('all')
    handleApplyLayerPreset('both')
    handleSelectViewPreset('front')
  }

  const filteredSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (q.length < 2) return []
    const terms = q.split(/\s+/)
    return searchableStructures
      .filter((s) => {
        const hay = `${s.namePt} ${s.nameEn} ${s.groupPt} ${s.layerPt}`.toLowerCase()
        return terms.every((t) => hay.includes(t))
      })
      .slice(0, 10)
  }, [searchQuery, searchableStructures])

  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white p-4 flex flex-col justify-between gap-3 shadow-lg">
      {/* Cabeçalho estilo Zygote Body */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-display font-bold text-xs sm:text-sm text-slate-100">
              Atlas Anatômico 3D (Padrão Zygote Body)
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block">
            634 Músculos & Ossos 3D • Dissecação de Camadas & Pontos Antropométricos
          </span>
        </div>

        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
          Z-Anatomy / BodyParts3D • {sex === 'female' ? 'Feminino' : 'Masculino'}
        </Badge>
      </div>

      {/* Busca Rápida de Músculos e Ossos (634 Estruturas) */}
      <div className="relative w-full">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar músculo ou osso (ex: Peitoral, Deltoide, Fêmur, Reto Abdominal...)"
          className="h-8 pl-8 pr-8 text-xs bg-slate-900/90 border-slate-800 text-slate-100 placeholder:text-slate-500"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
            aria-label="Limpar busca"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {filteredSearchResults.length > 0 && (
          <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-md shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-800/80">
            {filteredSearchResults.map((item) => (
              <button
                key={item.meshName}
                type="button"
                onClick={() => {
                  handleFocusStructure(item)
                  setSearchQuery('')
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-950/60 flex items-center justify-between gap-2 transition"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-100 truncate">{item.namePt}</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {item.nameEn} • {item.sidePt}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] border-slate-700 text-emerald-300 shrink-0"
                >
                  {item.layerPt}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Presets de Camadas Anatômicas (Estilo Zygote Body) */}
      <div className="w-full grid grid-cols-4 gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
        {(
          [
            { id: 'both', label: 'Músculos 100%' },
            { id: 'xray', label: 'Raio-X 3D' },
            { id: 'deep', label: 'Profundos' },
            { id: 'skeleton', label: 'Esqueleto' },
          ] as const
        ).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleApplyLayerPreset(p.id)}
            className={`px-2 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition flex items-center justify-center gap-1 ${
              layerPreset === p.id
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {/* Viewport 3D WebGL com Controle Deslizante Vertical de Dissecação estilo Zygote Body */}
      <div className="relative w-full h-[460px] rounded-2xl overflow-hidden border border-slate-800/90 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800/60 via-slate-950 to-slate-950">
        <div
          ref={mountRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          aria-label="Modelo anatômico humano 3D estilo Zygote Body"
        />

        {/* Overlay de Carregamento do Modelo 3D Z-Anatomy */}
        {!modelLoaded && !loadError && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center gap-2.5 p-6 text-center">
            <Layers className="w-7 h-7 text-emerald-400" />
            <div className="text-xs font-bold text-slate-100">
              Carregando Atlas Anatômico 3D (634 Músculos & Ossos)... {loadProgress}%
            </div>
            <div className="w-44 h-1.5 bg-slate-800 rounded-md overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${Math.max(8, loadProgress)}%` }}
              />
            </div>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-2 p-6 text-center text-xs text-rose-300">
            <span>{loadError}</span>
          </div>
        )}

        {/* Barra Superior de Vistas de Câmera (Frente, Costas, Perfil, 360°, Pontos) */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1 pointer-events-none">
          <div className="flex items-center gap-1 pointer-events-auto bg-slate-950/85 backdrop-blur-xs border border-slate-800 rounded-xl p-1">
            {(
              [
                { id: 'front', label: 'Frente' },
                { id: 'back', label: 'Costas' },
                { id: 'side', label: 'Perfil' },
                { id: 'three_quarter', label: '3/4' },
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
                  : 'bg-slate-950/85 text-slate-300'
              }`}
              title="Girar modelo 360° automaticamente"
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
                  : 'bg-slate-950/85 text-slate-400'
              }`}
              title="Mostrar/ocultar pontos de dobras cutâneas e perimetria"
            >
              Pontos
            </Button>
            {(hiddenMeshNames.size > 0 || selectedStructure || activeRegion !== 'all') && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleResetDissection}
                className="h-7 px-2 text-[10px] border-amber-500/40 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
                title="Restaurar todas as camadas e peças"
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* SLIDER LATERAL DE DISSECAÇÃO DE CAMADAS (ESTILO ZYGOTE BODY) */}
        <div className="absolute left-2.5 top-14 bottom-16 w-11 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-800/90 p-1.5 flex flex-col items-center justify-between pointer-events-auto shadow-md">
          <div className="flex flex-col items-center gap-0.5 text-[9px] text-emerald-300 font-bold text-center">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>{outerMuscleOpacity}%</span>
          </div>

          {/* Vertical range slider for peeling outer muscle layer */}
          <div className="relative flex-1 flex items-center justify-center w-full my-1">
            <input
              type="range"
              min={0}
              max={100}
              step={2}
              value={outerMuscleOpacity}
              aria-label="Opacidade da camada muscular superficial (Dissecação Zygote Body)"
              onChange={(e) => {
                setOuterMuscleOpacity(Number(e.target.value))
                setLayerPreset('xray')
              }}
              className="w-36 h-1.5 accent-emerald-500 -rotate-90 cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowSkeleton((s) => !s)}
            className={`w-8 h-7 rounded-lg flex flex-col items-center justify-center text-[8px] font-bold border transition ${
              showSkeleton
                ? 'bg-slate-800 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Alternar visibilidade do esqueleto ósseo"
          >
            <Bone className="w-3 h-3" />
            <span>Ossos</span>
          </button>
        </div>

        {/* Tooltip flutuante ao passar o mouse sobre qualquer um dos 634 músculos/ossos */}
        {hoveredStructureName && !selectedStructure && !selectedLandmark && (
          <div className="absolute top-12 left-16 right-3 pointer-events-none flex justify-center">
            <div className="rounded-lg bg-slate-950/90 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 shadow-md truncate">
              {hoveredStructureName}
            </div>
          </div>
        )}

        {/* HUD Clínico: Estrutura Anatômica Selecionada (634 músculos/ossos) OU Ponto Antropométrico */}
        {selectedStructure ? (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 rounded-xl bg-slate-950/92 backdrop-blur-md border border-emerald-500/50 p-2.5 text-xs space-y-1.5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-display font-bold text-emerald-300 truncate">
                    {selectedStructure.namePt}
                  </span>
                  <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">
                    {selectedStructure.layerPt}
                  </Badge>
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  Nomina Anatomica: {selectedStructure.nameEn} • Lado: {selectedStructure.sidePt} •{' '}
                  {selectedStructure.fma}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  selectedMeshNameRef.current = null
                  setSelectedStructure(null)
                  syncMaterialsAndVisibility()
                }}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 pt-0.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleFocusStructure(selectedStructure)}
                className="h-6 px-2 text-[10px] gap-1 border-emerald-500/40 bg-emerald-950/50 text-emerald-200 hover:bg-emerald-900/60"
              >
                <Focus className="w-3 h-3" />
                <span>Aproximar Câmera</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleHideSelectedMesh}
                className="h-6 px-2 text-[10px] gap-1 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
              >
                <EyeOff className="w-3 h-3" />
                <span>Ocultar / Dissectar Peça</span>
              </Button>
            </div>
          </div>
        ) : selectedLandmark ? (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 rounded-xl bg-slate-950/92 backdrop-blur-md border border-emerald-500/40 p-2.5 text-xs flex items-start justify-between gap-2">
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
              aria-label="Fechar detalhes da estrutura selecionada"
              onClick={() => setSelectedLandmark(null)}
              className="text-slate-400 hover:text-white p-1 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[10px] text-slate-300 bg-slate-950/80 backdrop-blur-xs border border-slate-800/80 rounded-xl px-2.5 py-1.5">
            <span>
              Região:{' '}
              <strong className="text-emerald-400">
                {activeRegion === 'all'
                  ? 'Corpo Inteiro (634 estruturas)'
                  : activeRegion === 'trunk'
                    ? 'Tronco & Abdômen'
                    : activeRegion === 'upper_limb'
                      ? 'Membros Superiores'
                      : 'Membros Inferiores'}
              </strong>
            </span>
            <span className="text-slate-400 flex items-center gap-1">
              <Eye className="w-3 h-3 text-emerald-400" />
              Clique em qualquer músculo ou osso
            </span>
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
