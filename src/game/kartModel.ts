import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Character } from './characters'

/**
 * Procedural low-poly karts and critter drivers. Static parts are merged into a few vertex-
 * coloured meshes per kart (≈8 draw calls), with separate nodes only for animated parts:
 * steering front wheels, rolling wheels, the body (lean/squash), the head (bob) and the tail.
 */
export const TOON = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.02 })

type V3 = [number, number, number]

export class Parts {
  private list: THREE.BufferGeometry[] = []

  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]): this {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    g.deleteAttribute('uv')
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale))
    g.applyMatrix4(m)
    const c = new THREE.Color(color)
    const n = g.getAttribute('position').count
    const colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i += 1) {
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.list.push(g)
    return this
  }

  /** Capsule-ish limb between two points. */
  limb(a: V3, b: V3, r: number, color: THREE.ColorRepresentation): this {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const len = va.distanceTo(vb)
    const g = new THREE.CapsuleGeometry(r, Math.max(0.01, len), 4, 12)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize())
    const e = new THREE.Euler().setFromQuaternion(q)
    const mid = va.add(vb).multiplyScalar(0.5)
    return this.add(g, color, [mid.x, mid.y, mid.z], [e.x, e.y, e.z])
  }

  mesh(material: THREE.Material = TOON): THREE.Mesh {
    const merged = mergeGeometries(this.list, false)!
    for (const g of this.list) g.dispose()
    this.list = []
    const mesh = new THREE.Mesh(merged, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }
}

const ico = (r: number, d = 1) => new THREE.SphereGeometry(r, d === 0 ? 10 : 18, d === 0 ? 8 : 12)
const box = (x: number, y: number, z: number) => new RoundedBoxGeometry(x, y, z, 3, Math.min(0.12, x / 3, y / 3, z / 3))
const cyl = (rt: number, rb: number, h: number, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s)
const cone = (r: number, h: number, s = 6) => new THREE.ConeGeometry(r, h, s)

const INK = '#2b1a2e'
const WHITE = '#fffaf2'
const PINK = '#ff9ec4'

export type KartView = {
  root: THREE.Group
  /** Lean/squash node containing chassis + driver. */
  body: THREE.Group
  driver: THREE.Group
  head: THREE.Group
  tail?: THREE.Group
  frontPivots: THREE.Group[]
  wheels: THREE.Object3D[]
  /** Local positions of the rear wheel contact points (drift sparks). */
  sparkPoints: THREE.Vector3[]
  /** Local exhaust tips (boost flames). */
  exhausts: THREE.Vector3[]
  shield: THREE.Mesh
  shadow: THREE.Mesh
}

export function bubbleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPop: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      uniform float uTime;
      void main() {
        vec3 p = position * (1.0 + 0.035 * sin(uTime * 6.0 + position.y * 4.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      uniform float uTime; uniform float uPop;
      void main() {
        float f = pow(1.0 - abs(dot(vN, vV)), 2.2);
        vec3 a = vec3(0.55, 0.95, 1.0); vec3 b = vec3(1.0, 0.6, 0.9);
        vec3 col = mix(a, b, 0.5 + 0.5 * sin(vP.y * 3.0 + uTime * 2.0));
        float alpha = (0.08 + f * 0.75) * (1.0 - uPop);
        gl_FragColor = vec4(col * (1.0 + f), alpha);
      }`,
  })
}

/** Driver torso + head for one species (also used for portraits). */
function buildDriver(c: Character): { driver: THREE.Group; head: THREE.Group; tail?: THREE.Group } {
  const driver = new THREE.Group()
  const torso = new Parts()
  const armFur = c.id === 'bear' ? c.furDark : c.fur
  torso.add(ico(0.42), c.fur, [0, 0.95, -0.32], [0, 0, 0], [1, 1.05, 0.9])
  torso.add(ico(0.3), c.belly, [0, 0.9, -0.08], [0, 0, 0], [1, 1.1, 0.45])
  torso.add(new THREE.TorusGeometry(0.28, 0.09, 5, 10), c.kartAccent, [0, 1.24, -0.28], [Math.PI / 2, 0, 0])
  torso.limb([0.34, 1.08, -0.22], [0.17, 0.98, 0.3], 0.1, armFur)
  torso.limb([-0.34, 1.08, -0.22], [-0.17, 0.98, 0.3], 0.1, armFur)
  torso.add(ico(0.1, 0), c.furDark, [0.16, 0.98, 0.34])
  torso.add(ico(0.1, 0), c.furDark, [-0.16, 0.98, 0.34])
  const legFur = c.id === 'bear' ? c.furDark : c.fur
  for (const s of [1, -1]) {
    torso.limb([s * 0.17, 0.79, -0.2], [s * 0.2, 0.56, 0.1], 0.105, legFur)
    torso.add(ico(0.14), legFur, [s * 0.2, 0.52, 0.26], [0, 0, 0], [1, 0.62, 1.28])
  }
  driver.add(torso.mesh())

  const head = new THREE.Group()
  head.position.set(0, 1.58, -0.24)
  head.scale.setScalar(1.1)
  const h = new Parts()
  const eye = (x: number, y: number, z: number, sy = 1, r = 0.075) => {
    h.add(ico(r, 1), INK, [x, y, z], [0, 0, 0], [1, sy, 0.8])
    if (sy > 0.6) h.add(ico(r * 0.35, 0), WHITE, [x + 0.025, y + 0.03, z + r * 0.7])
  }
  const cheeks = (y = -0.12, z = 0.36) => {
    h.add(ico(0.075, 1), PINK, [0.3, y, z], [0, 0, 0], [1, 0.6, 0.4])
    h.add(ico(0.075, 1), PINK, [-0.3, y, z], [0, 0, 0], [1, 0.6, 0.4])
  }
  let tail: THREE.Group | undefined
  switch (c.id) {
    case 'bunny':
      h.add(ico(0.5), c.fur)
      h.add(ico(0.22), c.belly, [0, -0.14, 0.34], [0, 0, 0], [1.15, 0.72, 0.55])
      for (const s of [1, -1]) {
        h.add(new THREE.CapsuleGeometry(0.12, 0.62, 4, 10), c.fur, [s * 0.18, 0.72, -0.08], [-0.22, 0, -s * 0.17])
        h.add(new THREE.CapsuleGeometry(0.06, 0.49, 4, 8), PINK, [s * 0.18, 0.72, 0.01], [-0.22, 0, -s * 0.17], [1, 1, 0.55])
      }
      eye(0.17, 0.06, 0.43); eye(-0.17, 0.06, 0.43)
      h.add(ico(0.05, 0), '#ff6f91', [0, -0.08, 0.52]); cheeks()
      break
    case 'bear':
      h.add(ico(0.5), c.fur)
      for (const s of [1, -1]) {
        h.add(ico(0.19), c.furDark, [s * 0.35, 0.36, -0.02])
        h.add(ico(0.11), c.fur, [s * 0.35, 0.36, 0.09])
        h.add(ico(0.23), c.furDark, [s * 0.18, 0.05, 0.34], [0, 0, -s * 0.34], [0.82, 1.2, 0.58])
      }
      h.add(ico(0.25), c.belly, [0, -0.18, 0.35], [0, 0, 0], [1.2, 0.72, 0.56])
      eye(0.18, 0.08, 0.42); eye(-0.18, 0.08, 0.42)
      h.add(ico(0.08), c.furDark, [0, -0.08, 0.55]); h.add(ico(0.045, 0), INK, [0, -0.045, 0.615]); cheeks()
      break
    case 'tiger':
      h.add(ico(0.5), c.fur)
      h.add(box(0.055, 0.17, 0.035), c.furDark, [0, 0.29, 0.39])
      h.add(box(0.055, 0.14, 0.035), c.furDark, [-0.14, 0.27, 0.38], [0, 0, -0.3])
      h.add(box(0.055, 0.14, 0.035), c.furDark, [0.14, 0.27, 0.38], [0, 0, 0.3])
      for (const s of [1, -1]) {
        h.add(ico(0.15), c.furDark, [s * 0.33, 0.34, 0.02], [0, 0, -s * 0.25], [1, 1, 0.62])
        h.add(ico(0.12), c.belly, [s * 0.31, -0.18, 0.3], [0, 0, s * 0.25], [0.8, 1.1, 0.55])
        h.add(box(0.08, 0.22, 0.045), c.furDark, [s * 0.32, 0.02, 0.38], [0, 0, s * 0.26])
        h.add(box(0.07, 0.18, 0.045), c.furDark, [s * 0.25, -0.25, 0.35], [0, 0, -s * 0.24])
      }
      eye(0.17, 0.08, 0.43); eye(-0.17, 0.08, 0.43)
      h.add(ico(0.22), c.belly, [0, -0.19, 0.37], [0, 0, 0], [1.15, 0.68, 0.55])
      h.add(ico(0.055, 0), INK, [0, -0.08, 0.55]); cheeks()
      break
    case 'chicken':
      h.add(ico(0.48), c.fur, [0, -0.01, 0], [0, 0, 0], [1.04, 1, 0.96])
      for (const s of [1, -1]) {
        h.add(ico(0.105), '#ff665e', [s * 0.12, 0.48, 0.02], [0, 0, s * 0.18], [0.75, 1.25, 0.8])
        h.add(new THREE.CapsuleGeometry(0.12, 0.18, 3, 8), c.fur, [s * 0.43, -0.12, -0.04], [0, 0, s * 0.9])
      }
      h.add(cone(0.18, 0.3, 8), '#ff9d3d', [0, -0.1, 0.52], [Math.PI / 2, 0, 0])
      for (let i = -1; i <= 1; i += 1) h.add(ico(0.105), '#ff665e', [i * 0.16, 0.51 + (i === 0 ? 0.06 : 0), -0.02], [0, 0, 0], [0.8, 1.25, 0.75])
      eye(0.17, 0.08, 0.39, 1, 0.065); eye(-0.17, 0.08, 0.39, 1, 0.065); cheeks(-0.2, 0.32)
      break
    case 'buffalo':
      h.add(ico(0.5), c.fur)
      h.add(ico(0.26), c.belly, [0, -0.2, 0.31], [0, 0, 0], [1.15, 0.74, 0.62])
      for (const s of [1, -1]) {
        h.add(ico(0.16), c.furDark, [s * 0.36, 0.28, 0.02], [0, 0, -s * 0.28], [1, 0.75, 0.65])
        h.add(new THREE.CapsuleGeometry(0.08, 0.28, 4, 8), '#fff0c2', [s * 0.47, 0.49, 0], [0, 0, -s * 0.75])
      }
      eye(0.17, 0.08, 0.43); eye(-0.17, 0.08, 0.43)
      h.add(ico(0.065, 0), INK, [0, -0.12, 0.56]); cheeks(-0.19, 0.38)
      break
    case 'dog':
      h.add(ico(0.5), c.fur)
      for (const s of [1, -1]) h.add(new THREE.CapsuleGeometry(0.12, 0.35, 4, 8), c.furDark, [s * 0.4, 0.12, 0.02], [0.18, 0, s * 0.72], [1.1, 1.15, 0.72])
      h.add(ico(0.24), c.belly, [0, -0.18, 0.34], [0, 0, 0], [1.25, 0.7, 0.58])
      h.add(ico(0.15), c.furDark, [0.25, 0.23, 0.37], [0, 0, 0], [0.72, 1.15, 0.45])
      eye(0.17, 0.07, 0.43); eye(-0.17, 0.07, 0.43)
      h.add(ico(0.075), INK, [0, -0.04, 0.57]); cheeks()
      break
  }
  const headMesh = h.mesh()
  head.add(headMesh)
  driver.add(head)

  if (c.id === 'dog' || c.id === 'buffalo') {
    tail = new THREE.Group()
    tail.position.set(0, 0.8, -0.95)
    const t = new Parts()
    if (c.id === 'dog') {
      t.add(new THREE.CapsuleGeometry(0.09, 0.3, 4, 8), c.fur, [0, 0.11, -0.04], [0.8, 0, 0], [0.8, 1, 0.8])
      t.add(ico(0.13), c.belly, [0, 0.35, -0.2])
    } else {
      t.add(new THREE.CapsuleGeometry(0.045, 0.34, 4, 8), c.furDark, [0, 0.16, -0.04], [0.75, 0, 0], [0.7, 1, 0.7])
      t.add(ico(0.12), c.furDark, [0, 0.39, -0.19])
    }
    tail.add(t.mesh())
    driver.add(tail)
  } else if (c.id === 'bunny' || c.id === 'chicken') {
    const t = new Parts().add(ico(0.12), c.id === 'bunny' ? WHITE : c.belly, [0, 0.82, -0.72])
    driver.add(t.mesh())
  }
  return { driver, head, tail }
}

export function buildKart(c: Character): KartView {
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)

  const chassis = new Parts()
  const kc = c.kart
  const ac = c.kartAccent
  chassis.add(box(1.36, 0.26, 2.0), kc, [0, 0.42, 0])
  chassis.add(box(1.0, 0.24, 0.62), kc, [0, 0.5, 1.12], [-0.28, 0, 0])
  chassis.add(box(0.36, 0.3, 1.25), ac, [0.72, 0.44, -0.05])
  chassis.add(box(0.36, 0.3, 1.25), ac, [-0.72, 0.44, -0.05])
  chassis.add(cyl(0.13, 0.13, 1.5, 8), WHITE, [0, 0.33, 1.45], [0, 0, Math.PI / 2])
  chassis.add(box(0.78, 0.12, 0.62), '#4a2f3c', [0, 0.6, -0.34])
  chassis.add(box(0.82, 0.72, 0.16), ac, [0, 0.94, -0.72], [-0.12, 0, 0])
  chassis.add(box(0.95, 0.42, 0.48), '#5b3a2a', [0, 0.62, -0.98])
  for (const s of [1, -1]) {
    chassis.add(cyl(0.1, 0.12, 0.5, 7), ac, [s * 0.3, 0.8, -1.26], [-1.1, 0, 0])
    chassis.add(cyl(0.12, 0.1, 0.1, 7), WHITE, [s * 0.3, 0.9, -1.48], [-1.1, 0, 0])
    chassis.add(box(0.06, 0.45, 0.06), INK, [s * 0.55, 1.05, -1.02])
  }
  chassis.add(box(1.55, 0.08, 0.38), ac, [0, 1.27, -1.08], [0.12, 0, 0])
  chassis.add(box(1.55, 0.05, 0.4), kc, [0, 1.32, -1.08], [0.12, 0, 0])
  chassis.add(cyl(0.04, 0.04, 0.5, 5), INK, [0, 0.78, 0.42], [-0.9, 0, 0])
  chassis.add(new THREE.TorusGeometry(0.2, 0.045, 5, 10), INK, [0, 0.96, 0.3], [-0.55, 0, 0])
  // Paw emblem on the nose.
  chassis.add(cyl(0.12, 0.12, 0.03, 8), WHITE, [0, 0.66, 1.1], [1.29, 0, 0])
  for (const [x, z] of [[-0.11, 0.1], [0, 0.14], [0.11, 0.1]]) chassis.add(cyl(0.045, 0.045, 0.03, 6), WHITE, [x, 0.7 + z * 0.3, 1.2 - z * 0.1], [1.29, 0, 0])
  body.add(chassis.mesh())

  const { driver, head, tail } = buildDriver(c)
  body.add(driver)

  const wheels: THREE.Object3D[] = []
  const frontPivots: THREE.Group[] = []
  const makeWheel = (r: number, w: number) => {
    const p = new Parts()
    p.add(cyl(r, r, w, 32), '#3a2430', [0, 0, 0], [0, 0, Math.PI / 2])
    p.add(cyl(r * 0.55, r * 0.55, w + 0.04, 24), ac, [0, 0, 0], [0, 0, Math.PI / 2])
    p.add(cyl(r * 0.2, r * 0.2, w + 0.08, 20), WHITE, [0, 0, 0], [0, 0, Math.PI / 2])
    for (const side of [-1, 1]) p.add(new THREE.TorusGeometry(r * 0.82, r * 0.07, 8, 28), '#5b4352', [side * w * 0.43, 0, 0], [0, Math.PI / 2, 0])
    return p.mesh()
  }
  for (const s of [1, -1]) {
    const pivot = new THREE.Group()
    pivot.position.set(s * 0.8, 0.33, 0.78)
    const w = makeWheel(0.33, 0.3)
    pivot.add(w)
    root.add(pivot)
    frontPivots.push(pivot)
    wheels.push(w)
    const rear = makeWheel(0.39, 0.4)
    rear.position.set(s * 0.82, 0.39, -0.78)
    root.add(rear)
    wheels.push(rear)
  }

  const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(1.75, 2), bubbleMaterial())
  shield.position.y = 0.95
  shield.visible = false
  root.add(shield)

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 16),
    new THREE.MeshBasicMaterial({ color: '#2b1430', transparent: true, opacity: 0.32, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.scale.set(0.85, 1.25, 1)
  shadow.renderOrder = 1

  return {
    root,
    body,
    driver,
    head,
    tail,
    frontPivots,
    wheels,
    sparkPoints: [new THREE.Vector3(0.82, 0.05, -1.05), new THREE.Vector3(-0.82, 0.05, -1.05)],
    exhausts: [new THREE.Vector3(0.3, 0.95, -1.55), new THREE.Vector3(-0.3, 0.95, -1.55)],
    shield,
    shadow,
  }
}

/** Head-and-shoulders portraits for UI cards, rendered once with the game renderer. */
export function renderPortraits(gl: THREE.WebGLRenderer, roster: Character[], size = 160): Map<string, string> {
  const out = new Map<string, string>()
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight('#fff4f8', '#8a6a9a', 1.6))
  const key = new THREE.DirectionalLight('#fff0e0', 2.4)
  key.position.set(2, 3, 4)
  scene.add(key)
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20)
  cam.position.set(0.9, 1.75, 3.1)
  cam.lookAt(0, 1.38, 0)
  const target = new THREE.WebGLRenderTarget(size, size, { samples: 4 })
  target.texture.colorSpace = THREE.SRGBColorSpace
  const pixels = new Uint8Array(size * size * 4)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const prevTarget = gl.getRenderTarget()
  const prevClear = gl.getClearColor(new THREE.Color())
  const prevAlpha = gl.getClearAlpha()
  const prevTone = gl.toneMapping
  gl.setClearColor(0x000000, 0)
  for (const c of roster) {
    const { driver } = buildDriver(c)
    driver.rotation.y = 0.35
    scene.add(driver)
    gl.setRenderTarget(target)
    gl.clear()
    gl.render(scene, cam)
    gl.readRenderTargetPixels(target, 0, 0, size, size, pixels)
    const img = ctx.createImageData(size, size)
    for (let y = 0; y < size; y += 1) {
      const src = (size - 1 - y) * size * 4
      img.data.set(pixels.subarray(src, src + size * 4), y * size * 4)
    }
    ctx.clearRect(0, 0, size, size)
    ctx.putImageData(img, 0, 0)
    out.set(c.id, canvas.toDataURL('image/png'))
    scene.remove(driver)
    driver.traverse(o => (o as THREE.Mesh).geometry?.dispose())
  }
  gl.setRenderTarget(prevTarget)
  gl.setClearColor(prevClear, prevAlpha)
  gl.toneMapping = prevTone
  target.dispose()
  return out
}
