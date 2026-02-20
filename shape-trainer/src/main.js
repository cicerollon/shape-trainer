import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { APP_CONFIG } from './config/env'
import { applyCompletedRound, calculateCycleTime } from './engine/session'
import { loadStats, saveStats as persistStats } from './state/statsStore'
import { randomInt } from './utils/random'
import { formatClock, formatShortDuration } from './utils/time'

// ---------------------------
// DOM
// ---------------------------
const canvas = document.getElementById('c')
const shapeLabel = document.getElementById('shapeLabel')
const timerLabel = document.getElementById('timerLabel')
const modeLabel = document.getElementById('modeLabel')
const nextIn = document.getElementById('nextIn')
const roundsNow = document.getElementById('roundsNow')
const streakNow = document.getElementById('streakNow')

const durationSelect = document.getElementById('durationSelect')
const autoswitchSelect = document.getElementById('autoswitchSelect')
const hardModeEl = document.getElementById('hardMode')
const figureRotationEl = document.getElementById('figureRotation')
const wireframeEl = document.getElementById('wireframe')
const contoursEl = document.getElementById('contours')
const flatShadingEl = document.getElementById('flatShading')
const helpersEl = document.getElementById('helpers')
const rotSpeedEl = document.getElementById('rotSpeed')
const lightAngleEl = document.getElementById('lightAngle')

const startBtn = document.getElementById('startBtn')
const pauseBtn = document.getElementById('pauseBtn')
const nextBtn = document.getElementById('nextBtn')
const resetStatsBtn = document.getElementById('resetStatsBtn')

const totalRoundsEl = document.getElementById('totalRounds')
const totalTimeEl = document.getElementById('totalTime')
const bestStreakEl = document.getElementById('bestStreak')
const avgRoundEl = document.getElementById('avgRound')

// ---------------------------
// Stats (localStorage)
// ---------------------------
const STORAGE_KEY = APP_CONFIG.statsStorageKey
const stats = loadStats(localStorage, STORAGE_KEY)

function saveStats(){
  persistStats(localStorage, STORAGE_KEY, stats)
  renderStats()
}
function renderStats(){
  totalRoundsEl.textContent = stats.totalRounds
  totalTimeEl.textContent = formatShortDuration(stats.totalTime)
  bestStreakEl.textContent = stats.bestStreak
  avgRoundEl.textContent = stats.totalRounds ? formatShortDuration(stats.totalTime / stats.totalRounds) : '0s'
}
renderStats()

// ---------------------------
// Three.js setup
// ---------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true })
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
renderer.shadowMap.enabled = true

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
camera.position.set(4.2, 2.8, 4.8)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.target.set(0, 1.0, 0)

scene.add(new THREE.AmbientLight(0xffffff, 0.35))

const keyLight = new THREE.DirectionalLight(0xffffff, 1.15)
keyLight.position.set(4, 6, 3)
keyLight.castShadow = true
keyLight.shadow.mapSize.set(2048, 2048)
scene.add(keyLight)

const fillLight = new THREE.DirectionalLight(0xffffff, 0.45)
fillLight.position.set(-5, 3.5, -3)
scene.add(fillLight)

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshStandardMaterial({ color: 0x0b1020, roughness: 1, metalness: 0 })
)
floor.rotation.x = -Math.PI/2
floor.position.y = 0
floor.receiveShadow = true
scene.add(floor)

const helpers = {
  grid: new THREE.GridHelper(30, 30, 0x2a376b, 0x1a2346),
  axes: new THREE.AxesHelper(2.2),
}
helpers.grid.position.y = 0.001
scene.add(helpers.grid, helpers.axes)

function resize(){
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)

// ---------------------------
// Materials + overlays
// ---------------------------
const baseMat = new THREE.MeshStandardMaterial({
  color: 0xdfe6ff,
  roughness: 0.8,
  metalness: 0.02,
  flatShading: true,
})
const wireMat = new THREE.MeshBasicMaterial({
  color: 0x7aa2ff,
  wireframe: true,
  transparent: true,
  opacity: 0.35,
})
const contourMat = new THREE.LineBasicMaterial({
  color: 0xaab1d6,
  transparent:true,
  opacity:0.55,
})

function applyVisualSettings(group){
  const useWire = wireframeEl.checked
  const useFlat = flatShadingEl.checked

  group.traverse(obj=>{
    if (obj.isMesh){
      obj.material.flatShading = !!useFlat
      obj.material.needsUpdate = true
    }
    if (obj.userData.wire) obj.visible = !!useWire
    if (obj.userData.contour) obj.visible = !!contoursEl.checked
  })

  helpers.grid.visible = helpers.axes.visible = helpersEl.checked
}

// ---------------------------
// Shape library
// ---------------------------
function primitive(geom){
  const g = new THREE.Group()

  const mesh = new THREE.Mesh(geom, baseMat.clone())
  mesh.castShadow = true
  g.add(mesh)

  const wire = new THREE.Mesh(geom, wireMat)
  wire.userData.wire = true
  g.add(wire)

  addContours(g, geom)
  return g
}

function addContours(group, geom){
  // Boxes: skip (rings aren’t helpful)
  if (geom.type?.includes('Box')) return

  const bbox = new THREE.Box3().setFromBufferAttribute(geom.attributes.position)
  const minY = bbox.min.y, maxY = bbox.max.y
  const levels = 6

  for(let i=1;i<=levels;i++){
    const t = i/(levels+1)
    const y = THREE.MathUtils.lerp(minY, maxY, t)
    const ring = contourRingFromGeometry(geom, y)
    if(!ring) continue
    ring.userData.contour = true
    group.add(ring)
  }
}

function contourRingFromGeometry(geom, yTarget){
  const pos = geom.attributes.position
  const pts = []
  for(let i=0;i<pos.count;i++){
    const y = pos.getY(i)
    if (Math.abs(y - yTarget) < 0.04){
      pts.push(new THREE.Vector3(pos.getX(i), y, pos.getZ(i)))
    }
  }
  if (pts.length < 20) return null

  const center = pts.reduce((a,p)=>a.add(p), new THREE.Vector3()).multiplyScalar(1/pts.length)
  pts.sort((a,b)=>{
    const aa = Math.atan2(a.z-center.z, a.x-center.x)
    const bb = Math.atan2(b.z-center.z, b.x-center.x)
    return aa-bb
  })

  const geo = new THREE.BufferGeometry().setFromPoints(pts.concat([pts[0]]))
  return new THREE.Line(geo, contourMat)
}

function wedge(){
  const g = new THREE.Group()
  g.add(primitive(new THREE.BoxGeometry(2.2, 1.6, 1.6)))

  const cut = primitive(new THREE.BoxGeometry(2.4, 1.2, 1.8))
  cut.position.set(0, 0.6, 0)
  cut.rotation.z = THREE.MathUtils.degToRad(32)
  cut.traverse(o=>{
    if(o.isMesh){
      o.material = o.material.clone()
      o.material.transparent = true
      o.material.opacity = 0.18
    }
  })
  g.add(cut)
  return g
}

function mannequin(hard){
  const g = new THREE.Group()

  const torso = primitive(new THREE.BoxGeometry(1.2, 1.6, 0.7))
  torso.position.set(0, 1.85, 0)
  g.add(torso)

  const pelvis = primitive(new THREE.BoxGeometry(1.25, 0.7, 0.75))
  pelvis.position.set(0, 0.95, 0)
  g.add(pelvis)

  const head = primitive(new THREE.SphereGeometry(0.45, 32, 20))
  head.position.set(0, 2.95, 0)
  g.add(head)

  const upperArmL = primitive(new THREE.CapsuleGeometry(0.18, 0.8, 6, 16))
  upperArmL.position.set(-0.95, 2.2, 0)
  upperArmL.rotation.z = THREE.MathUtils.degToRad(15)
  g.add(upperArmL)

  const upperArmR = primitive(new THREE.CapsuleGeometry(0.18, 0.8, 6, 16))
  upperArmR.position.set(0.95, 2.2, 0)
  upperArmR.rotation.z = THREE.MathUtils.degToRad(-15)
  g.add(upperArmR)

  const forearmL = primitive(new THREE.CapsuleGeometry(0.16, 0.8, 6, 16))
  forearmL.position.set(-1.25, 1.55, 0)
  forearmL.rotation.z = THREE.MathUtils.degToRad(35)
  g.add(forearmL)

  const forearmR = primitive(new THREE.CapsuleGeometry(0.16, 0.8, 6, 16))
  forearmR.position.set(1.25, 1.55, 0)
  forearmR.rotation.z = THREE.MathUtils.degToRad(-35)
  g.add(forearmR)

  const thighL = primitive(new THREE.CapsuleGeometry(0.22, 1.0, 6, 16))
  thighL.position.set(-0.45, 0.25, 0)
  g.add(thighL)

  const thighR = primitive(new THREE.CapsuleGeometry(0.22, 1.0, 6, 16))
  thighR.position.set(0.45, 0.25, 0)
  g.add(thighR)

  if (hard){
    torso.rotation.y = THREE.MathUtils.degToRad(randomInt(-35,35))
    pelvis.rotation.y = THREE.MathUtils.degToRad(randomInt(-20,20))
    pelvis.rotation.x = THREE.MathUtils.degToRad(randomInt(-12,12))
    torso.rotation.x = THREE.MathUtils.degToRad(randomInt(-10,10))

    upperArmL.rotation.x = THREE.MathUtils.degToRad(randomInt(-40,40))
    upperArmR.rotation.x = THREE.MathUtils.degToRad(randomInt(-40,40))
    forearmL.rotation.x = THREE.MathUtils.degToRad(randomInt(-40,40))
    forearmR.rotation.x = THREE.MathUtils.degToRad(randomInt(-40,40))
  }

  return g
}

const SHAPES = [
  { name:'Cube', build:()=>primitive(new THREE.BoxGeometry(1.6,1.6,1.6)) },
  { name:'Rectangular Box', build:()=>primitive(new THREE.BoxGeometry(2.2,1.2,1.4)) },
  { name:'Sphere', build:()=>primitive(new THREE.SphereGeometry(1.1, 40, 24)) },
  { name:'Cylinder', build:()=>primitive(new THREE.CylinderGeometry(0.75,0.75,2.4, 32)) },
  { name:'Cone', build:()=>primitive(new THREE.ConeGeometry(0.9, 2.6, 32)) },
  { name:'Capsule', build:()=>primitive(new THREE.CapsuleGeometry(0.7, 1.6, 8, 24)) },
  { name:'Torus', build:()=>primitive(new THREE.TorusGeometry(1.0, 0.35, 14, 42)) },
  { name:'Wedge (Box Cut)', build:()=>wedge() },
  { name:'Mannequin (Simple)', build:()=>mannequin(false) },
  { name:'Mannequin (Hard)', build:()=>mannequin(true) },
]

// ---------------------------
// Model handling
// ---------------------------
let currentGroup = null
let currentShape = null

function clearCurrent(){
  if(!currentGroup) return
  scene.remove(currentGroup)
  currentGroup = null
  currentShape = null
}

function randomizeOrientation(group){
  group.rotation.set(
    THREE.MathUtils.degToRad(randomInt(-35,35)),
    THREE.MathUtils.degToRad(randomInt(0,360)),
    THREE.MathUtils.degToRad(randomInt(-25,25))
  )
}

function frameObject(group){
  const box = new THREE.Box3().setFromObject(group)
  const size = new THREE.Vector3()
  box.getSize(size)
  const center = new THREE.Vector3()
  box.getCenter(center)

  group.position.sub(center)
  group.position.y += size.y * 0.5

  const maxDim = Math.max(size.x, size.y, size.z)
  const dist = maxDim * 2.1 + 2.0
  camera.position.set(dist, dist*0.65, dist)
  controls.target.set(0, size.y*0.65, 0)
  controls.update()
}

function buildNewShape({ keepShape=false } = {}){
  const hard = hardModeEl.checked
  const figRot = figureRotationEl.checked

  let pick
  if (keepShape && currentShape){
    pick = currentShape
  } else {
    const pool = hard
      ? SHAPES
      : SHAPES.filter(s => s.name !== 'Mannequin (Hard)')

    pick = pool[randomInt(0, pool.length-1)]
    if (hard && Math.random() < 0.45) pick = SHAPES.find(s=>s.name==='Mannequin (Hard)') || pick
  }

  clearCurrent()
  currentShape = pick
  currentGroup = pick.build()

  randomizeOrientation(currentGroup)
  scene.add(currentGroup)
  frameObject(currentGroup)
  applyVisualSettings(currentGroup)

  shapeLabel.textContent = pick.name + (hard ? ' • Hard' : '')
  modeLabel.textContent = figRot ? 'Mode: Figure Rotation (same shape, new angle)' : 'Mode: Auto-switch'
}

// ---------------------------
// Timer engine
// ---------------------------
let isRunning = false
let remaining = Number(durationSelect.value)
let lastTick = performance.now()

let sessionRounds = 0
let sessionStreak = 0

function setRemaining(sec){
  remaining = sec
  timerLabel.textContent = formatClock(remaining)
}

function start(){
  if(isRunning) return
  isRunning = true
  lastTick = performance.now()
  startBtn.textContent = 'Running'
}
function pause(){
  isRunning = false
  startBtn.textContent = 'Start'
}
function toggleStartPause(){ isRunning ? pause() : start() }

function completeRound(){
  const { nextStats, nextSessionRounds, nextSessionStreak } = applyCompletedRound({
    stats,
    sessionRounds,
    sessionStreak,
    roundDurationSeconds: Number(durationSelect.value),
  })

  Object.assign(stats, nextStats)
  sessionRounds = nextSessionRounds
  sessionStreak = nextSessionStreak

  roundsNow.textContent = sessionRounds
  streakNow.textContent = sessionStreak
  saveStats()
}
function breakStreak(){
  sessionStreak = 0
  streakNow.textContent = sessionStreak
}

function cycleTime(){
  return calculateCycleTime({
    durationSeconds: Number(durationSelect.value),
    autoSwitchSeconds: Number(autoswitchSelect.value),
  })
}

function nextShape({ asRound=true } = {}){
  const figRot = figureRotationEl.checked
  if (asRound) completeRound()
  buildNewShape({ keepShape: figRot })
  setRemaining(cycleTime())
}

function updateNextIn(){
  const as = Number(autoswitchSelect.value)
  nextIn.textContent = as ? formatShortDuration(as) : 'Off'
}
updateNextIn()

// ---------------------------
// UI events
// ---------------------------
startBtn.addEventListener('click', ()=>start())
pauseBtn.addEventListener('click', ()=>pause())
nextBtn.addEventListener('click', ()=>{
  breakStreak()
  nextShape({ asRound:false })
})
resetStatsBtn.addEventListener('click', ()=>{
  if (!confirm('Reset saved stats?')) return
  stats.totalRounds = 0; stats.totalTime = 0; stats.bestStreak = 0
  saveStats()
  sessionRounds = 0; sessionStreak = 0
  roundsNow.textContent = '0'
  streakNow.textContent = '0'
})

durationSelect.addEventListener('change', ()=>setRemaining(cycleTime()))
autoswitchSelect.addEventListener('change', ()=>{
  updateNextIn()
  setRemaining(cycleTime())
})

;[hardModeEl, figureRotationEl, wireframeEl, contoursEl, flatShadingEl, helpersEl].forEach(el=>{
  el.addEventListener('change', ()=>{
    if (currentGroup) applyVisualSettings(currentGroup)
    modeLabel.textContent = figureRotationEl.checked
      ? 'Mode: Figure Rotation (same shape, new angle)'
      : 'Mode: Auto-switch'
  })
})

// Keyboard shortcuts
window.addEventListener('keydown', (e)=>{
  if (e.code === 'Space'){
    e.preventDefault()
    toggleStartPause()
  }
  if (e.key.toLowerCase() === 'n'){
    breakStreak()
    nextShape({ asRound:false })
  }
  if (e.key.toLowerCase() === 'r'){
    if (currentGroup) randomizeOrientation(currentGroup)
  }
})

// Light controls
function updateLight(){
  const deg = Number(lightAngleEl.value)
  const rad = THREE.MathUtils.degToRad(deg)
  const radius = 7.5
  keyLight.position.set(Math.cos(rad)*radius, 6.0, Math.sin(rad)*radius)
}
lightAngleEl.addEventListener('input', updateLight)
updateLight()

// ---------------------------
// Init + loop
// ---------------------------
buildNewShape({ keepShape:false })
setRemaining(cycleTime())
resize()

function animate(now){
  requestAnimationFrame(animate)
  const dt = Math.min(0.05, (now - lastTick)/1000)
  lastTick = now

  if (isRunning){
    remaining -= dt
    if (remaining <= 0){
      nextShape({ asRound:true })
    } else {
      timerLabel.textContent = formatClock(remaining)
    }
  }

  const speed = Number(rotSpeedEl.value)
  if (currentGroup && speed > 0){
    currentGroup.rotation.y += dt * speed * 0.7
  }

  controls.update()
  renderer.render(scene, camera)
}
requestAnimationFrame(animate)