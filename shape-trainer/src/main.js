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
const tierSelect = document.getElementById('tierSelect')
const figureRotationEl = document.getElementById('figureRotation')
const manualRotateEl = document.getElementById('manualRotate')
const practiceModeEl = document.getElementById('practiceMode')
const wireframeEl = document.getElementById('wireframe')
const contoursEl = document.getElementById('contours')
const flatShadingEl = document.getElementById('flatShading')
const helpersEl = document.getElementById('helpers')
const lightAngleEl = document.getElementById('lightAngle')

const startBtn = document.getElementById('startBtn')
const pauseBtn = document.getElementById('pauseBtn')
const nextBtn = document.getElementById('nextBtn')
const markMistakeBtn = document.getElementById('markMistakeBtn')
const clearMistakesBtn = document.getElementById('clearMistakesBtn')
const resetStatsBtn = document.getElementById('resetStatsBtn')
const mistakeNotice = document.getElementById('mistakeNotice')

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
  if (geom.type?.includes('Box')) return

  const bbox = new THREE.Box3().setFromBufferAttribute(geom.attributes.position)
  const minY = bbox.min.y
  const maxY = bbox.max.y
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

function organicForm(){
  const geom = new THREE.IcosahedronGeometry(1.15, 2)
  const pos = geom.attributes.position
  const temp = new THREE.Vector3()
  for (let i=0; i<pos.count; i++){
    temp.set(pos.getX(i), pos.getY(i), pos.getZ(i))
    const wobble = 0.06 * Math.sin(temp.x * 4.1 + temp.y * 2.7 + temp.z * 3.5)
    temp.multiplyScalar(1 + wobble)
    pos.setXYZ(i, temp.x, temp.y, temp.z)
  }
  geom.computeVertexNormals()
  return primitive(geom)
}

function extrudedForm(){
  const shape = new THREE.Shape()
  shape.moveTo(-0.9, -0.5)
  shape.lineTo(-0.25, -0.85)
  shape.lineTo(0.45, -0.75)
  shape.lineTo(0.95, -0.1)
  shape.lineTo(0.6, 0.75)
  shape.lineTo(-0.35, 0.95)
  shape.lineTo(-0.95, 0.2)
  shape.closePath()

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.8,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.08,
    bevelThickness: 0.08,
  })
  geom.center()
  return primitive(geom)
}

function curvilinearForm(){
  const points = []
  for (let i=0; i<=12; i++){
    const t = i / 12
    const x = 0.45 + 0.35 * Math.sin(t * Math.PI)
    const y = -1.2 + t * 2.4
    points.push(new THREE.Vector2(x, y))
  }
  const geom = new THREE.LatheGeometry(points, 36)
  return primitive(geom)
}

function tubeForm(){
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.3, -0.8, 0.0),
    new THREE.Vector3(-0.5, 0.1, 0.45),
    new THREE.Vector3(0.4, 0.9, -0.35),
    new THREE.Vector3(1.2, -0.2, 0.2),
  ])
  const geom = new THREE.TubeGeometry(curve, 90, 0.22, 16, false)
  return primitive(geom)
}

// Tier system: each shape has a fixed difficulty tier so randomization can filter by tier or use mixed mode.
const SHAPES = [
  { id:'cube', name:'Cube', tier:1, build:()=>primitive(new THREE.BoxGeometry(1.6, 1.6, 1.6)) },
  { id:'cuboid', name:'Cuboid', tier:1, build:()=>primitive(new THREE.BoxGeometry(2.3, 1.2, 1.55)) },
  { id:'sphere', name:'Sphere', tier:1, build:()=>primitive(new THREE.SphereGeometry(1.1, 40, 24)) },
  { id:'cylinder', name:'Cylinder', tier:1, build:()=>primitive(new THREE.CylinderGeometry(0.75, 0.75, 2.4, 32)) },
  { id:'cone', name:'Cone', tier:1, build:()=>primitive(new THREE.ConeGeometry(0.9, 2.6, 32)) },
  { id:'pyramid', name:'Pyramid', tier:2, build:()=>primitive(new THREE.ConeGeometry(1.0, 2.1, 4)) },
  { id:'tri-prism', name:'Triangular Prism', tier:2, build:()=>primitive(new THREE.CylinderGeometry(0.95, 0.95, 2.0, 3)) },
  { id:'capsule', name:'Capsule', tier:2, build:()=>primitive(new THREE.CapsuleGeometry(0.7, 1.6, 8, 24)) },
  { id:'torus', name:'Torus', tier:2, build:()=>primitive(new THREE.TorusGeometry(1.0, 0.35, 14, 42)) },
  { id:'octahedron', name:'Octahedron', tier:2, build:()=>primitive(new THREE.OctahedronGeometry(1.2, 0)) },
  { id:'tube', name:'Tube', tier:3, build:()=>tubeForm() },
  { id:'curvilinear', name:'Curvilinear Form', tier:3, build:()=>curvilinearForm() },
  { id:'extruded', name:'Extruded Form', tier:3, build:()=>extrudedForm() },
  { id:'organic', name:'Organic Form', tier:4, build:()=>organicForm() },
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

function currentTierPool(){
  const tier = tierSelect.value
  return tier === 'mixed' ? SHAPES : SHAPES.filter(shape => shape.tier === Number(tier))
}

function buildShapeInstance(shape, options = {}){
  const { randomAngle = true, quaternion = null } = options

  clearCurrent()
  currentShape = shape
  currentGroup = shape.build()

  if (quaternion){
    currentGroup.quaternion.fromArray(quaternion)
  } else if (randomAngle){
    randomizeOrientation(currentGroup)
  }

  scene.add(currentGroup)
  frameObject(currentGroup)
  applyVisualSettings(currentGroup)
  updateModeLabel()
}

// ---------------------------
// Mistake bank (stored in localStorage)
// ---------------------------
// Structure: [{ shapeId, tier, quaternion:[x,y,z,w] }], versioned key to support future schema changes.
const MISTAKE_BANK_KEY = 'shape_trainer_mistakes_v1'
let mistakeBank = loadMistakeBank()
let mistakeCursor = 0

function loadMistakeBank(){
  try {
    const raw = localStorage.getItem(MISTAKE_BANK_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(entry => Array.isArray(entry.quaternion) && entry.quaternion.length === 4 && typeof entry.shapeId === 'string')
  } catch {
    return []
  }
}

function saveMistakeBank(){
  localStorage.setItem(MISTAKE_BANK_KEY, JSON.stringify(mistakeBank))
  mistakeNotice.textContent = `Mistake bank: ${mistakeBank.length}`
}
saveMistakeBank()

function setPracticeMode(mode){
  practiceModeEl.value = mode
  updateModeLabel()
}

function notice(text){
  mistakeNotice.textContent = text
  window.setTimeout(() => {
    mistakeNotice.textContent = `Mistake bank: ${mistakeBank.length}`
  }, 2200)
}

function updateModeLabel(){
  const practice = practiceModeEl.value === 'mistakes' ? 'Repeat Mistakes' : 'Normal'
  const rotMode = figureRotationEl.checked ? 'Same shape, new angle' : 'Randomized'
  const tierText = tierSelect.value === 'mixed' ? 'Mixed tiers' : `Tier ${tierSelect.value}`
  modeLabel.textContent = `Mode: ${practice} • ${tierText} • ${rotMode}`
  if (currentShape){
    shapeLabel.textContent = `${currentShape.name} • Tier ${currentShape.tier}`
  }
}

function nextNormalShape(){
  const pool = currentTierPool()
  const canKeepShape = figureRotationEl.checked && currentShape && pool.some(shape => shape.id === currentShape.id)

  if (canKeepShape){
    buildShapeInstance(currentShape, { randomAngle: true })
    return
  }

  const pick = pool[randomInt(0, pool.length - 1)]
  buildShapeInstance(pick, { randomAngle: true })
}

function nextMistakeShape(){
  if (!mistakeBank.length){
    notice('Mistake bank empty; switching to Normal')
    setPracticeMode('normal')
    nextNormalShape()
    return
  }

  const item = mistakeBank[mistakeCursor % mistakeBank.length]
  mistakeCursor = (mistakeCursor + 1) % mistakeBank.length
  const shape = SHAPES.find(candidate => candidate.id === item.shapeId) || SHAPES[0]

  // Repeat mode intentionally replays the saved angle and ignores "same shape, new angle" for correction drills.
  buildShapeInstance(shape, { quaternion: item.quaternion, randomAngle: false })
}

function buildNewShape(){
  if (practiceModeEl.value === 'mistakes'){
    nextMistakeShape()
  } else {
    nextNormalShape()
  }
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
  if (asRound) completeRound()
  buildNewShape()
  setRemaining(cycleTime())
}

function updateNextIn(){
  const as = Number(autoswitchSelect.value)
  nextIn.textContent = as ? formatShortDuration(as) : 'Off'
}
updateNextIn()

// ---------------------------
// Manual object rotate
// ---------------------------
let isObjectDragging = false
let lastPointer = { x: 0, y: 0 }

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!manualRotateEl.checked || event.button !== 0 || !currentGroup) return
  isObjectDragging = true
  lastPointer = { x: event.clientX, y: event.clientY }
  controls.enabled = false
  renderer.domElement.setPointerCapture(event.pointerId)
})

renderer.domElement.addEventListener('pointermove', (event) => {
  if (!isObjectDragging || !currentGroup) return
  const dx = event.clientX - lastPointer.x
  const dy = event.clientY - lastPointer.y
  lastPointer = { x: event.clientX, y: event.clientY }

  currentGroup.rotation.y += dx * 0.01
  currentGroup.rotation.x += dy * 0.01
})

function endObjectDrag(event){
  if (!isObjectDragging) return
  isObjectDragging = false
  if (event) renderer.domElement.releasePointerCapture(event.pointerId)
  controls.enabled = true
}
renderer.domElement.addEventListener('pointerup', endObjectDrag)
renderer.domElement.addEventListener('pointercancel', endObjectDrag)

// ---------------------------
// UI events
// ---------------------------
startBtn.addEventListener('click', ()=>start())
pauseBtn.addEventListener('click', ()=>pause())
nextBtn.addEventListener('click', ()=>{
  breakStreak()
  nextShape({ asRound:false })
})
markMistakeBtn.addEventListener('click', ()=>{
  if (!currentShape || !currentGroup) return
  mistakeBank.push({
    shapeId: currentShape.id,
    tier: currentShape.tier,
    quaternion: currentGroup.quaternion.toArray(),
  })
  saveMistakeBank()
  notice(`Added mistake: ${currentShape.name}`)
})
clearMistakesBtn.addEventListener('click', ()=>{
  mistakeBank = []
  mistakeCursor = 0
  saveMistakeBank()
  if (practiceModeEl.value === 'mistakes'){
    setPracticeMode('normal')
    notice('Mistake bank cleared; switched to Normal')
  }
})
resetStatsBtn.addEventListener('click', ()=>{
  if (!confirm('Reset saved stats?')) return
  stats.totalRounds = 0
  stats.totalTime = 0
  stats.bestStreak = 0
  saveStats()
  sessionRounds = 0
  sessionStreak = 0
  roundsNow.textContent = '0'
  streakNow.textContent = '0'
})

durationSelect.addEventListener('change', ()=>setRemaining(cycleTime()))
autoswitchSelect.addEventListener('change', ()=>{
  updateNextIn()
  setRemaining(cycleTime())
})

;[tierSelect, figureRotationEl, manualRotateEl, practiceModeEl, wireframeEl, contoursEl, flatShadingEl, helpersEl].forEach(el=>{
  el.addEventListener('change', ()=>{
    if (currentGroup) applyVisualSettings(currentGroup)
    if (el === practiceModeEl && practiceModeEl.value === 'mistakes' && !mistakeBank.length){
      notice('Mistake bank empty; switching to Normal')
      setPracticeMode('normal')
    }
    updateModeLabel()
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
buildNewShape()
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

  controls.update()
  renderer.render(scene, camera)
}
requestAnimationFrame(animate)
