import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { allPokemonCollected, clearPath, createMazeWalls, entityChaseSpeed, entityCount, EXIT_POSITION, findRoute, PANEL_POSITION, pickEntitySpawns, PLAYER_START, POKEMON_LOCATIONS, randomizePokemonLocations, rollPickupScare, ROOM_CENTERS, type Point } from './explorationLogic'
import NavigationHUD, { type NavigationFrame } from './NavigationHUD'
import { createPokemon } from './pokemonModels'
import { HorrorAudio, type EntitySound } from './HorrorAudio'
import { BATTERY_CAPACITY, devicePower, drainBattery } from './batteryLogic'
import { biomeObstacles, getBiome, type BiomeId } from './biomes'
import { addBiomeScenery } from './biomeScenery'
import { canInvestigateCrying, chooseCryingLocation, CRY_STUN_SECONDS, cryingCooldown } from './daycareLogic'
import { RunDebriefButton } from './companion/LearningGuide'
import { createLocalRunRecorder } from './companion/local-run-learning'
import { LEARNING_OVERLAY_EVENT, type LearningRun } from './companion/education-model'
import { usePlaySession } from './companion/Access'
import { accountRequest } from './companion/api'
import type { Telemetry, Monster, EventKind } from '../supabase/functions/server/telemetry'

type Props = { biomeId: BiomeId; volume: number; scanning: boolean; onBatteryChange: (charge: number) => void }
export default function Exploration({ biomeId, volume, scanning, onBatteryChange }: Props) {
  const biome=getBiome(biomeId)
  const host = useRef<HTMLDivElement>(null)
  const navigation = useRef<NavigationFrame | null>(null)
  const scanningRef = useRef(scanning)
  scanningRef.current = scanning
  const controls = useRef({ active: false, keys: new Set<string>(), flashlight: true, restart: false, interact: false })
  const audio = useRef<HorrorAudio | null>(null)
  const volumeRef = useRef(volume)
  volumeRef.current = volume
  const [started, setStarted] = useState(false)
  const [ended, setEnded] = useState<'caught' | 'escaped' | null>(null)
  const [learningRun, setLearningRun] = useState<LearningRun | null>(null)
  const [error, setError] = useState(false)
  const [light, setLight] = useState(true)
  const [sound, setSound] = useState(true)
  const [audioUnavailable, setAudioUnavailable] = useState(false)
  const [locked, setLocked] = useState(false)
  const [mission, setMission] = useState({ rescued: [] as string[], powered: false, stamina: 100, battery: BATTERY_CAPACITY, threat: 'NO ENTITY PRESENT', prompt: '', target: 'PIKACHU', meters: 0, blackout: false, stunned: false })

  const playSession = usePlaySession()
  const activeSessionId = useRef(playSession?.id || '')
  useEffect(() => {
    if (playSession?.id) activeSessionId.current = playSession.id
  }, [playSession?.id])

  const currentMonster: Monster = biomeId === 'yellow' ? '025' : biomeId === 'daycare' ? '094' : biomeId === 'lab' ? '934' : '823'
  const telemetryBatch = useRef<Telemetry[]>([])
  const inFlight = useRef(false)
  const lastSampleTime = useRef(0)
  const chaseReported = useRef(false)

  const flushTelemetry = async (force = false) => {
    if (!telemetryBatch.current.length || inFlight.current) return
    if (!force && telemetryBatch.current.length < 3) return
    const batch = [...telemetryBatch.current]
    telemetryBatch.current = []
    inFlight.current = true
    try {
      await accountRequest('/telemetry', {
        method: 'POST',
        body: JSON.stringify({ events: batch }),
      })
    } catch {
      telemetryBatch.current = [...batch, ...telemetryBatch.current].slice(-200)
    } finally {
      inFlight.current = false
    }
  }

  const recordEvent = (
    event: EventKind,
    elapsed: number,
    coords: { x: number; y: number },
    battery: number,
    staminaLevel: number,
    options?: { chaseDuration?: number; reactionMs?: number; immediate?: boolean }
  ) => {
    if (!activeSessionId.current) {
      activeSessionId.current = playSession?.id || `PLAY-${crypto.randomUUID()}`
    }
    const row: Telemetry = {
      id: crypto.randomUUID(),
      session_id: activeSessionId.current,
      timestamp: new Date().toISOString(),
      player_x: Math.round(Math.max(-36, Math.min(36, coords.x))),
      player_y: Math.round(Math.max(-46, Math.min(18, coords.y))),
      heart_rate_proxy: Math.round(
        event === 'chase' ? 140 + Math.random() * 40 : event === 'jumpscare' ? 165 + Math.random() * 30 : 75 + Math.random() * 30
      ),
      active_monster: currentMonster,
      battery_level: Math.round(Math.max(0, Math.min(100, battery))),
      stamina: Math.round(Math.max(0, Math.min(100, staminaLevel))),
      elapsed: Math.round(elapsed),
      sprint_ratio: 0.5,
      crouch_ratio: 0.2,
      first_clue: 45,
      chase_duration: options?.chaseDuration ?? 0,
      reaction_ms: options?.reactionMs ?? 420,
      event,
      source: 'game',
    }
    telemetryBatch.current.push(row)
    if (options?.immediate || event === 'death' || event === 'escape' || event === 'jumpscare') {
      void flushTelemetry(true)
    }
  }

  useEffect(()=>{ audio.current?.setMix(volume, sound) },[volume,sound])
  useEffect(()=>{ audio.current?.cue('scanner') },[scanning])
  useEffect(() => {
    const mount = host.current!
    const mazeWalls=createMazeWalls(biome.seed)
    onBatteryChange(BATTERY_CAPACITY)
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }) }
    catch { setError(true); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.25
    mount.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(biome.fog)
    const fog=new THREE.FogExp2(biome.fog,biome.density)
    scene.fog = fog
    const camera = new THREE.PerspectiveCamera(72, 1, .06, 85)
    camera.rotation.order = 'YXZ'
    camera.position.set(PLAYER_START.x, 1.65, PLAYER_START.z)
    scene.add(camera)
    const ambient = new THREE.HemisphereLight(biome.ambient, '#111711', .42)
    scene.add(ambient)
    const textureCanvas = document.createElement('canvas')
    textureCanvas.width = textureCanvas.height = 128
    const context = textureCanvas.getContext('2d')!
    context.fillStyle = biome.wall; context.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 5000; i++) { context.fillStyle = `rgba(30,29,12,${Math.random() * .15})`; context.fillRect(Math.random()*128, Math.random()*128, 1, 8) }
    context.strokeStyle = '#6c623b'; context.lineWidth = 1
    for (let x = 0; x < 128; x += 16) { context.beginPath(); context.moveTo(x,0); context.lineTo(x,128); context.stroke() }
    for(let i=0;i<20;i++){
      const x=Math.random()*128,y=Math.random()*128
      context.fillStyle='rgba(25,36,22,.18)';context.beginPath();context.ellipse(x,y,4+Math.random()*16,6+Math.random()*23,0,0,Math.PI*2);context.fill()
      context.strokeStyle='rgba(48,38,23,.28)';context.beginPath();context.moveTo(x,y);context.lineTo(x+3,y+35);context.stroke()
    }
    const texture = new THREE.CanvasTexture(textureCanvas)
    if(biomeId==='lab'){
      context.strokeStyle='#41575c';context.lineWidth=2;context.strokeRect(2,2,124,60);context.strokeRect(2,66,124,60)
      context.fillStyle='#bcc3bd';for(const x of [7,120])for(const y of [7,58,71,120])context.fillRect(x,y,2,2)
    }else if(biomeId==='daycare'){
      context.fillStyle='#698888';context.fillRect(0,96,128,32);context.fillStyle='#b9a26e';context.fillRect(0,91,128,5)
      context.strokeStyle='#5c485b';context.lineWidth=2;context.beginPath();context.moveTo(18,83);context.lineTo(18,62);context.lineTo(32,50);context.lineTo(47,62);context.lineTo(47,83);context.closePath();context.stroke()
    }
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(2, 1)
    texture.colorSpace = THREE.SRGBColorSpace
    const wall = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 })
    let floorTexture:THREE.CanvasTexture|null=null
    if(biomeId==='daycare'){
      const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d')!
      const colors=['#685464','#586f71','#847858','#6b657d']
      for(let y=0;y<2;y++)for(let x=0;x<2;x++){g.fillStyle=colors[y*2+x];g.fillRect(x*64,y*64,64,64);g.strokeStyle='#35353a';g.strokeRect(x*64,y*64,64,64)}
      floorTexture=new THREE.CanvasTexture(c);floorTexture.wrapS=floorTexture.wrapT=THREE.RepeatWrapping;floorTexture.repeat.set(18,16);floorTexture.colorSpace=THREE.SRGBColorSpace
    }
    const floorMat = new THREE.MeshStandardMaterial({ color:floorTexture?'#ffffff':biome.floor,map:floorTexture,roughness:biomeId==='lab'?.65:1,metalness:biomeId==='lab'?.3:0 })
    const ceilingMat = new THREE.MeshStandardMaterial({ color: biome.ceiling, roughness: 1 })
    const metal = new THREE.MeshStandardMaterial({ color: '#292e28', roughness: .7, metalness: .5 })
    const colliders: {x:number; z:number; w:number; d:number}[] = []
    function box(x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material,solid=false) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material)
      mesh.position.set(x,y,z); scene.add(mesh)
      if (solid) colliders.push({x,z,w,d})
      return mesh
    }
    box(0,-.1,-14,72,.2,64,floorMat)
    box(0,3.6,-14,72,.2,64,ceilingMat)
    mazeWalls.forEach(w=>box(w.x,1.75,w.z,w.w,3.5,w.d,wall,true))
    const scenery=addBiomeScenery(scene,biomeId,ROOM_CENTERS,colliders)
    const stainMaterial=new THREE.MeshStandardMaterial({color:'#111912',transparent:true,opacity:.55,roughness:.4})
    ROOM_CENTERS.filter((_,i)=>i%4===0).forEach((p,i)=>{
      const stain=new THREE.Mesh(new THREE.CircleGeometry(1.2+(i%3)*.3,14),stainMaterial)
      stain.rotation.x=-Math.PI/2;stain.scale.set(1.7,.8,1);stain.position.set(p.x+1.3,.012,p.z-1.4);scene.add(stain)
    })
    const warningTextures:THREE.Texture[]=[]
    const warnings=biome.warnings
    mazeWalls.filter((_,i)=>i>4&&i%8===0).forEach((w,i)=>{
      const c=document.createElement('canvas');c.width=512;c.height=128
      const g=c.getContext('2d')!;g.fillStyle='#684633';g.font='bold 27px monospace';g.textAlign='center'
      g.translate(256,65);g.rotate(-.04);g.fillText(warnings[i%warnings.length],0,0)
      for(let j=0;j<9;j++){g.fillStyle='rgba(65,43,24,.45)';g.fillRect(-190+j*45,8,2,8+(j*13)%35)}
      const t=new THREE.CanvasTexture(c);warningTextures.push(t)
      const decal=new THREE.Mesh(new THREE.PlaneGeometry(2.8,.8),new THREE.MeshBasicMaterial({map:t,transparent:true,opacity:.75,depthWrite:false}))
      if(w.w>w.d)decal.position.set(w.x,1.75,w.z+.16)
      else{decal.position.set(w.x+.16,1.7,w.z);decal.rotation.y=Math.PI/2}
      scene.add(decal)
    })
    const fixtures: THREE.PointLight[] = []
    const tube = new THREE.MeshBasicMaterial({color:biome.tube})
    ROOM_CENTERS.forEach(p=>box(p.x,3.45,p.z,.38,.04,2.1,tube))
    for (const x of [-24,0,24]) for (const z of [14,-10,-34]) {
      const lamp = new THREE.PointLight(biome.lamp, 17, 24, 1.6)
      lamp.position.set(x,3.15,z);scene.add(lamp);fixtures.push(lamp)
    }
    for(let z=18;z>=-46;z-=8)box(0,3.48,z,72,.04,.06,metal)
    const exitCanvas = document.createElement('canvas');exitCanvas.width=256;exitCanvas.height=100
    const ec=exitCanvas.getContext('2d')!;ec.fillStyle='#183d25';ec.fillRect(0,0,256,100);ec.fillStyle='#a9e5b2';ec.font='bold 60px monospace';ec.textAlign='center';ec.fillText('EXIT',128,72)
    const exitTexture=new THREE.CanvasTexture(exitCanvas)
    box(EXIT_POSITION.x,2.85,EXIT_POSITION.z-.05,1.7,.65,.06,new THREE.MeshBasicMaterial({map:exitTexture}))
    const exitDoor = box(EXIT_POSITION.x,1.25,EXIT_POSITION.z,2.2,2.5,.08,metal)
    const pokemon = randomizePokemonLocations().map(p => {
      const mesh = createPokemon(p.name,p.color)
      mesh.position.set(p.x,.85,p.z);scene.add(mesh)
      const table=box(p.x,.5,p.z,1,.7,.7,metal)
      const obstacle={x:p.x,z:p.z,w:1,d:.7}
      colliders.push(obstacle)
      const beacon = new THREE.PointLight(p.color,2,4)
      beacon.position.set(p.x,1.5,p.z);scene.add(beacon)
      return { mesh, table, obstacle, label:null as THREE.Object3D|null, beacon, collected: false, name: p.name, color: p.color }
    })
    const panelPosition = PANEL_POSITION
    const panelMaterial = new THREE.MeshStandardMaterial({ color: '#343c33', emissive: '#8b2415', emissiveIntensity: .5 })
    box(panelPosition.x,1.25,panelPosition.z,.35,1.1,.7,panelMaterial)
    const signTextures: THREE.Texture[] = []
    function sign(text: string, x: number, z: number, color = '#d5c77a') {
      const c = document.createElement('canvas');c.width=512;c.height=128
      const g=c.getContext('2d')!;g.fillStyle='#151b11';g.fillRect(0,0,512,128);g.fillStyle=color;g.font='bold 32px monospace';g.textAlign='center';g.fillText(text,256,76)
      const t=new THREE.CanvasTexture(c);signTextures.push(t)
      return box(x,2.3,z,2.8,.7,.03,new THREE.MeshBasicMaterial({map:t}))
    }
    pokemon.forEach(p=>{p.label=sign(p.name.toUpperCase(),p.mesh.position.x,p.mesh.position.z-.6,p.color)})
    sign('RESCUE ALL 3 / EXIT ↑',EXIT_POSITION.x,EXIT_POSITION.z+1)
    sign(biome.name.replace('The ','').toUpperCase(),PLAYER_START.x,PLAYER_START.z-2,biome.tube)
    const flashlight = new THREE.SpotLight('#f2ebce', 24, 26, .43, .7, 1)
    camera.add(flashlight);camera.add(flashlight.target);flashlight.position.set(.2,-.15,0);flashlight.target.position.set(0,0,-8)
    const creature = new THREE.Group()
    const skin=new THREE.MeshStandardMaterial({color:'#303a30',roughness:.98})
    const dark=new THREE.MeshBasicMaterial({color:'#040504'})
    const eyes=new THREE.MeshBasicMaterial({color:'#e05138'})
    const teeth=new THREE.MeshBasicMaterial({color:'#c8c39c'})
    function sphere(x:number,y:number,z:number,sx:number,sy:number,sz:number,mat:THREE.Material) {
      const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);creature.add(mesh);return mesh
    }
    const head=sphere(0,1.95,0,.4,.69,.32,skin);head.name='entity-head';head.rotation.z=.2
    sphere(0,1.05,0,.3,.65,.22,skin)
    for(const side of [-1,1]) {
      sphere(side*.26,2.14,.29,.17,.14,.09,dark)
      sphere(side*.26,2.14,.36,.07,.055,.035,eyes)
      const arm=sphere(side*.48,.83,0,.07,.88,.08,skin);arm.name=side<0?'arm-left':'arm-right'
      sphere(side*.18,.3,0,.10,.55,.11,skin)
      sphere(side*.31,2.64,-.07,.13,.57,.11,skin)
      for(let finger=0;finger<3;finger++) sphere(side*(.43+finger*.06),.22,.03,.025,.21,.025,skin)
    }
    sphere(0,1.73,.3,.23,.31,.085,dark)
    const bone=new THREE.MeshStandardMaterial({color:'#85836a',roughness:1})
    for(let rib=0;rib<5;rib++){
      const r=sphere(0,1.32-rib*.105,.2,.25-rib*.018,.022,.035,bone);r.rotation.z=.12
    }
    for(let i=0;i<7;i++) {
      const tooth=new THREE.Mesh(new THREE.ConeGeometry(.027,.15,5),teeth)
      tooth.position.set((i-3)*.05,1.91,.37);tooth.rotation.z=Math.PI;creature.add(tooth)
      const lower=new THREE.Mesh(new THREE.ConeGeometry(.022,.12+(i%2)*.04,5),teeth)
      lower.position.set((i-3)*.05,1.51,.37);creature.add(lower)
    }
    creature.position.set(-6,0,7);creature.visible=false;scene.add(creature)
    const apparition = creature.clone()
    camera.add(apparition);apparition.position.set(0,-1.85,-1.15);apparition.visible=false
    const entities=Array.from({length:3},(_,id)=>{
      const mesh=id===0?creature:creature.clone()
      if(id>0)scene.add(mesh)
      if(id===2){
        mesh.scale.set(.8,1.04,.86)
        const stalkerSkin=skin.clone();stalkerSkin.color.set('#292b28')
        mesh.traverse(o=>{if(o instanceof THREE.Mesh&&o.material===skin)o.material=stalkerSkin})
        const glow=new THREE.PointLight('#d43623',1.2,3.2,2);glow.position.set(0,2,.4);mesh.add(glow)
      }
      return {id,mesh,head:mesh.getObjectByName('entity-head'),leftArm:mesh.getObjectByName('arm-left'),rightArm:mesh.getObjectByName('arm-right'),releaseAt:Infinity,lastSeen:-100,nextPath:0,patrolDirection:1,route:[] as Point[],lastKnown:{...PLAYER_START},chasing:false}
    })
    let caughtEntity=creature
    let yaw=0,pitch=0,frame=0,last=performance.now(),walkTime=0,scareTime=-1,finished=false,lastDistance=0
    let previousFlashlight=true
    let powered=false,stamina=100,batteryLevel=BATTERY_CAPACITY,gameTime=0,entityHoldUntil=0,fakeTime=-100
    let fakeStun=0,fakeBlackout=0,fakeApparition=0
    let pendingScare: (ReturnType<typeof rollPickupScare> & { at: number }) | null = null
    const cryingLocations=biomeId==='daycare'?biomeObstacles('daycare',ROOM_CENTERS).filter(p=>p.kind==='crib').map(p=>({x:p.x,z:p.z-1.2})):[]
    let crying:{point:Point;until:number;nextVoice:number}|null=null
    let previousCry:Point|null=null,nextCryAt=biomeId==='daycare'?6+Math.random()*7:Infinity
    let published='',notice='',noticeUntil=0,run=0
    let learning = createLocalRunRecorder(`LOCAL-SECTOR-${biome.sector}-RUN-1`)
    let learningPaused = false
    let dragging=false,dragX=0,dragY=0
    const resize=()=>{const {width,height}=mount.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix()}
    const observer=new ResizeObserver(resize);observer.observe(mount);resize()
    const canMove=(x:number,z:number)=>!colliders.some(c=>Math.abs(x-c.x)<c.w/2+.25 && Math.abs(z-c.z)<c.d/2+.25)
    const look=(dx:number,dy:number)=>{yaw-=dx*.0025;pitch=THREE.MathUtils.clamp(pitch-dy*.0025,-1.2,1.2)}
    const onMouse=(e:MouseEvent)=>{if(!controls.current.active||finished)return;if(document.pointerLockElement===renderer.domElement)look(e.movementX,e.movementY)}
    const pointerDown=(e:PointerEvent)=>{if(!controls.current.active||finished)return;dragging=true;dragX=e.clientX;dragY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)}
    const pointerMove=(e:PointerEvent)=>{if(dragging&&document.pointerLockElement!==renderer.domElement){look(e.clientX-dragX,e.clientY-dragY);dragX=e.clientX;dragY=e.clientY}}
    const pointerUp=()=>{dragging=false}
    const down=(e:KeyboardEvent)=>{
      if(!controls.current.active || learningPaused || e.target instanceof HTMLInputElement)return
      if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft'].includes(e.code)){e.preventDefault();controls.current.keys.add(e.code)}
      if(e.code==='KeyF'&&!e.repeat&&batteryLevel>0){controls.current.flashlight=!controls.current.flashlight;setLight(controls.current.flashlight)}
      if(e.code==='KeyE'&&!e.repeat)controls.current.interact=true
    }
    const up=(e:KeyboardEvent)=>controls.current.keys.delete(e.code)
    const blur=()=>{controls.current.keys.clear();dragging=false}
    const visibility=()=>audio.current?.setActive(!document.hidden&&controls.current.active&&!learningPaused)
    const learningOverlay=(event:Event)=>{learningPaused=(event as CustomEvent<{open:boolean}>).detail.open;controls.current.keys.clear();visibility()}
    const lockChange=()=>{setLocked(document.pointerLockElement===renderer.domElement);controls.current.keys.clear()}
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('mousemove',onMouse);window.addEventListener('blur',blur)
    document.addEventListener('pointerlockchange',lockChange)
    document.addEventListener('visibilitychange',visibility)
    window.addEventListener(LEARNING_OVERLAY_EVENT,learningOverlay)
    renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointermove',pointerMove);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('pointercancel',pointerUp)
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const animate=(now:number)=>{
      frame=requestAnimationFrame(animate)
      const dt=Math.min((now-last)/1000,.04);last=now
      const state=controls.current
      if(state.restart){
        run++
        learning = createLocalRunRecorder(`LOCAL-SECTOR-${biome.sector}-RUN-${run+1}`)
        state.restart=false;state.interact=false;state.keys.clear();camera.position.set(PLAYER_START.x,1.65,PLAYER_START.z);camera.fov=72;camera.updateProjectionMatrix();yaw=0;pitch=0
        entities.forEach(e=>{scene.add(e.mesh);e.mesh.position.set(-6,0,7);e.mesh.rotation.set(0,0,0);e.mesh.visible=false;e.releaseAt=Infinity;e.lastSeen=-100;e.nextPath=0;e.patrolDirection=1;e.route=[];e.lastKnown={...PLAYER_START};e.chasing=false})
        caughtEntity=creature;scareTime=-1;finished=false
        powered=false;stamina=100;gameTime=0;entityHoldUntil=0;fakeTime=-100;pendingScare=null;fakeStun=0;fakeBlackout=0;fakeApparition=0;apparition.visible=false;notice='';noticeUntil=0;published=''
        batteryLevel=BATTERY_CAPACITY;state.flashlight=true;setLight(true);onBatteryChange(BATTERY_CAPACITY)
        crying=null;previousCry=null;nextCryAt=biomeId==='daycare'?6+Math.random()*7:Infinity;audio.current?.stopCrying()
        const locations=randomizePokemonLocations(Math.random,pokemon.map(p=>({x:p.mesh.position.x,z:p.mesh.position.z})))
        pokemon.forEach((p,i)=>{
          const location=locations[i]
          p.collected=false;p.mesh.visible=true;p.beacon.visible=true
          p.mesh.position.set(location.x,.85,location.z);p.table.position.set(location.x,.5,location.z)
          p.obstacle.x=location.x;p.obstacle.z=location.z
          p.beacon.position.set(location.x,1.5,location.z);p.label?.position.set(location.x,2.3,location.z-.6)
        })
        panelMaterial.emissive.set('#8b2415');exitDoor.visible=true
      }
      if(state.active&&!finished&&!learningPaused) {
        gameTime+=dt
        if(scareTime<0){
          if(crying&&gameTime>=crying.until){previousCry=crying.point;crying=null;nextCryAt=gameTime+cryingCooldown();audio.current?.stopCrying()}
          if(!crying&&gameTime>=nextCryAt){
            const point=chooseCryingLocation(camera.position,cryingLocations,colliders,previousCry)
            if(point)crying={point,until:gameTime+22+Math.random()*6,nextVoice:gameTime}
            else nextCryAt=gameTime+5
          }
          if(crying&&state.interact&&!pendingScare&&gameTime-fakeTime>=Math.max(fakeStun,fakeBlackout)&&!pokemon.some(p=>!p.collected&&camera.position.distanceTo(p.mesh.position)<2.3)&&canInvestigateCrying(camera.position,crying.point,colliders)){
            previousCry=crying.point;crying=null;nextCryAt=gameTime+cryingCooldown()
            fakeTime=gameTime;fakeStun=CRY_STUN_SECONDS;fakeBlackout=CRY_STUN_SECONDS;fakeApparition=.28
            apparition.position.x=(Math.random()-.5)*.3
            state.interact=false;audio.current?.stopCrying();audio.current?.cue('scare')
            recordEvent('jumpscare',gameTime,{x:camera.position.x,y:camera.position.z},batteryLevel,stamina,{immediate:true})
            notice='EMPTY CRIB · HALLUCINATION · STUNNED FOR 1 SECOND';noticeUntil=gameTime+2.5
          }
          if(crying&&gameTime>=crying.nextVoice){
            const dx=crying.point.x-camera.position.x,dz=crying.point.z-camera.position.z,distance=Math.hypot(dx,dz)
            const pan=distance>.01?(dx*Math.cos(yaw)-dz*Math.sin(yaw))/distance:0
            audio.current?.childCry(distance,THREE.MathUtils.clamp(pan,-1,1),!clearPath(camera.position,crying.point,colliders))
            crying.nextVoice=gameTime+3.8+Math.random()*2.8
          }
          if(pendingScare&&gameTime>=pendingScare.at){
            fakeTime=gameTime;fakeStun=pendingScare.stun;fakeBlackout=pendingScare.blackout;fakeApparition=pendingScare.apparition
            apparition.position.x=pendingScare.offset;pendingScare=null;audio.current?.cue('scare')
            recordEvent('jumpscare',gameTime,{x:camera.position.x,y:camera.position.z},batteryLevel,stamina,{immediate:true})
          }
          const k=state.keys
          const fakeAge=gameTime-fakeTime
          const stunned=fakeAge<fakeStun
          const blackout=fakeAge<fakeBlackout
          const deviceBefore=devicePower(batteryLevel,state.flashlight,scanningRef.current,blackout)
          const previousBattery=batteryLevel
          if(!document.hidden)batteryLevel=drainBattery(batteryLevel,dt,deviceBefore.flashlight,deviceBefore.radar)
          if(previousBattery>20&&batteryLevel<=20)audio.current?.cue('scanner')
          if(previousBattery>0&&batteryLevel<=0){
            state.flashlight=false;setLight(false);onBatteryChange(0);audio.current?.cue('blackout')
          }
          const activeDevices=devicePower(batteryLevel,state.flashlight,scanningRef.current,blackout)
          const forward=Number(k.has('KeyW')||k.has('ArrowUp'))-Number(k.has('KeyS')||k.has('ArrowDown'))
          const side=Number(k.has('KeyD'))-Number(k.has('KeyA'))
          if(k.has('ArrowLeft'))yaw+=dt*1.7
          if(k.has('ArrowRight'))yaw-=dt*1.7
          const sprint=k.has('ShiftLeft')&&stamina>5&&!!(forward||side)&&!stunned
          stamina=THREE.MathUtils.clamp(stamina+(sprint?-26:12)*dt,0,100)
          const speed=(stunned?0:sprint?4.8:2.8)*dt/Math.max(1,Math.hypot(forward,side))
          const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed
          const dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed
          const oldX=camera.position.x,oldZ=camera.position.z
          if(canMove(camera.position.x+dx,camera.position.z))camera.position.x+=dx
          if(canMove(camera.position.x,camera.position.z+dz))camera.position.z+=dz
          const moved=Math.hypot(camera.position.x-oldX,camera.position.z-oldZ)
          learning.tick(gameTime,batteryLevel,sprint&&moved>.001,dt)
          if(moved>.001){walkTime+=dt;camera.position.y=1.65+(reduced?0:Math.sin(walkTime*10)*.035)}
          camera.rotation.set(pitch,yaw,0,'YXZ')
          const rescuedCount=pokemon.filter(p=>p.collected).length
          const entitySounds:EntitySound[]=[]
          let catching:THREE.Group|null=null
          for(const e of entities){
            const mesh=e.mesh, released=gameTime>=e.releaseAt
            mesh.visible=released
            if(!released)continue
            const stalker=rescuedCount>=3&&e.id===2
            const chaseSpeed=entityChaseSpeed(rescuedCount,e.id)
            if(e.head)e.head.rotation.z=.2+(reduced?0:Math.sin(gameTime*(stalker?2.8:1.3)+e.id)*.1)
            if(!reduced){if(e.leftArm)e.leftArm.rotation.x=Math.sin(gameTime*(stalker?7:4)+e.id)*.12;if(e.rightArm)e.rightArm.rotation.x=-Math.sin(gameTime*(stalker?7:4)+e.id)*.12}
            const canPursue=gameTime>=entityHoldUntil&&!blackout&&!stunned
            const beforeDistance=Math.hypot(mesh.position.x-camera.position.x,mesh.position.z-camera.position.z)
            const toward=new THREE.Vector3(camera.position.x-mesh.position.x,0,camera.position.z-mesh.position.z).normalize()
            const facing=new THREE.Vector3(0,0,1).applyQuaternion(mesh.quaternion)
            const oldEntityX=mesh.position.x,oldEntityZ=mesh.position.z
            const seesPlayer=beforeDistance<18&&(beforeDistance<2.5||facing.dot(toward)>.25)&&clearPath(mesh.position,camera.position,colliders)
            if(seesPlayer){e.lastSeen=gameTime;e.lastKnown={x:camera.position.x,z:camera.position.z};e.chasing=true}
            if(e.chasing&&gameTime-e.lastSeen>7&&Math.hypot(mesh.position.x-e.lastKnown.x,mesh.position.z-e.lastKnown.z)<1.5){e.chasing=false;e.route=[]}
            if(canPursue){
              const target=e.chasing?e.lastKnown:(e.patrolDirection>0?PLAYER_START:EXIT_POSITION)
              if(!e.chasing&&Math.hypot(mesh.position.x-target.x,mesh.position.z-target.z)<.6)e.patrolDirection*=-1
              if(gameTime>=e.nextPath){e.route=findRoute(mesh.position,target,colliders);e.nextPath=gameTime+.5+e.id*.025}
              const next=e.route[0]
              if(next){
                const delta=new THREE.Vector3(next.x-mesh.position.x,0,next.z-mesh.position.z)
                const remaining=delta.length()
                if(remaining<.15)e.route.shift()
                else{
                  mesh.lookAt(next.x,0,next.z);delta.normalize().multiplyScalar(Math.min((e.chasing?chaseSpeed:.9)*dt,remaining))
                  const spaceFree=(x:number,z:number)=>canMove(x,z)&&entities.every(other=>other.id===e.id||gameTime<other.releaseAt||Math.hypot(x-other.mesh.position.x,z-other.mesh.position.z)>=.8)
                  const beforeX=mesh.position.x,beforeZ=mesh.position.z
                  if(spaceFree(mesh.position.x+delta.x,mesh.position.z))mesh.position.x+=delta.x
                  if(spaceFree(mesh.position.x,mesh.position.z+delta.z))mesh.position.z+=delta.z
                  if(stalker&&Math.hypot(mesh.position.x-beforeX,mesh.position.z-beforeZ)<.001){
                    for(const side of [1,-1]){
                      const x=mesh.position.x+side*delta.z*.8,z=mesh.position.z-side*delta.x*.8
                      if(spaceFree(x,z)){mesh.position.set(x,0,z);e.nextPath=Math.min(e.nextPath,gameTime+.15);break}
                    }
                  }
                }
              }
            }
            const distance=Math.hypot(mesh.position.x-camera.position.x,mesh.position.z-camera.position.z)
            const pan=distance>.01?((mesh.position.x-camera.position.x)*Math.cos(yaw)-(mesh.position.z-camera.position.z)*Math.sin(yaw))/distance:0
            const occluded=!clearPath(mesh.position,camera.position,colliders)
            entitySounds.push({id:e.id,moved:Math.hypot(mesh.position.x-oldEntityX,mesh.position.z-oldEntityZ),distance,pan:THREE.MathUtils.clamp(pan,-1,1),chasing:e.chasing,occluded,stalker})
            if(canPursue&&distance<.95&&!occluded&&!catching)catching=mesh
          }
          audio.current?.update({moved,entities:entitySounds,sprinting:sprint&&moved>.001,stamina,blackout,scanning:activeDevices.radar})
          if(catching){caughtEntity=catching;scareTime=0;audio.current?.cue('caught');apparition.visible=false;camera.add(caughtEntity);caughtEntity.position.set(0,-1.85,-3);caughtEntity.rotation.set(0,0,0)}
          // Pickup hallucinations never kill; pursuit pauses until the player can recover.
          apparition.visible=gameTime-fakeTime<fakeApparition
          const nearbyPokemon=pokemon.find(f=>!f.collected&&camera.position.distanceTo(f.mesh.position)<2.3)
          const atExit=Math.hypot(camera.position.x-EXIT_POSITION.x,camera.position.z-EXIT_POSITION.z)<2.5
          const nearCrying=crying&&canInvestigateCrying(camera.position,crying.point,colliders)
          let prompt=nearbyPokemon?`[ E ] RESCUE ${nearbyPokemon.name.toUpperCase()}`:atExit?(powered?'[ E ] OPEN EXIT & ESCAPE':'EXIT LOCKED · RESCUE ALL 3 POKÉMON'):nearCrying?'[ E ] INVESTIGATE CRYING CRIB':crying&&Math.hypot(crying.point.x-camera.position.x,crying.point.z-camera.position.z)<12?'[ a child is crying nearby · follow the sound ]':''
          if(state.interact&&!stunned){
            if(nearbyPokemon){
              nearbyPokemon.collected=true;nearbyPokemon.mesh.visible=false;nearbyPokemon.beacon.visible=false
              const names=pokemon.filter(p=>p.collected).map(p=>p.name)
              learning.record({elapsed:gameTime,label:`RESCUE ${names.length}/3`,evidence:`${nearbyPokemon.name} rescued · ${batteryLevel.toFixed(1)}% battery. Progression observed, not a sensor-cluster inference.`})
              const scare=rollPickupScare()
              pendingScare={...scare,at:gameTime+scare.delay}
              notice=`${nearbyPokemon.name.toUpperCase()} RESCUED · ${names.length}/3`;noticeUntil=gameTime+2.5;audio.current?.cue('pickup',pokemon.indexOf(nearbyPokemon))
              const releaseAt=gameTime+scare.delay+Math.max(scare.stun,scare.blackout)+3
              const desired=entityCount(names.length)
              const additions=entities.slice(0,desired).filter(e=>!Number.isFinite(e.releaseAt))
              const spawns=pickEntitySpawns(camera.position,colliders,additions.length,entities.filter(e=>Number.isFinite(e.releaseAt)).map(e=>e.mesh.position))
              additions.forEach((e,i)=>{
                const spawn=spawns[i];if(!spawn)return
                e.mesh.position.set(spawn.x,0,spawn.z);e.mesh.lookAt(camera.position.x,0,camera.position.z)
                e.releaseAt=releaseAt;e.lastSeen=releaseAt;e.lastKnown={x:camera.position.x,z:camera.position.z};e.chasing=true;e.route=[];e.nextPath=releaseAt+e.id*.08
              })
              if(names.length===2){
                notice='2 RESCUED · SLOW ENTITY RELEASED AFTER YOUR RECOVERY · FIND THE LAST POKÉMON';noticeUntil=gameTime+6;audio.current?.cue('release')
              }
              if(allPokemonCollected(names)){
                powered=true;panelMaterial.emissive.set('#28e070');exitDoor.visible=false;stamina=100
                entityHoldUntil=releaseAt
                // The original entity stays in place; two new pursuers join after recovery.
                entities.forEach(e=>{e.lastSeen=releaseAt;e.lastKnown={x:camera.position.x,z:camera.position.z};e.chasing=true;e.route=[];e.nextPath=releaseAt+e.id*.08})
                notice='EXIT UNLOCKED · THE STALKER HAS AWAKENED · SAVE YOUR SPRINT!';noticeUntil=gameTime+6;audio.current?.cue('escalate')
              }
            }
            else if(atExit&&powered){finished=true;state.active=false;audio.current?.setActive(false);audio.current?.cue('escape');recordEvent('escape',gameTime,{x:camera.position.x,y:camera.position.z},batteryLevel,stamina,{immediate:true});setLearningRun(learning.finish(gameTime,batteryLevel,'escaped'));setEnded('escaped');if(document.pointerLockElement===renderer.domElement)document.exitPointerLock()}
          }
          state.interact=false
          if(gameTime<noticeUntil)prompt=notice
          const remaining=pokemon.filter(f=>!f.collected).sort((a,b)=>camera.position.distanceTo(a.mesh.position)-camera.position.distanceTo(b.mesh.position))
          const target=remaining[0]?.mesh.position??EXIT_POSITION
          if(now-lastDistance>180){
            lastDistance=now
            if(gameTime-lastSampleTime.current>=3.5){
              lastSampleTime.current=gameTime
              recordEvent('sample',gameTime,{x:camera.position.x,y:camera.position.z},batteryLevel,stamina)
              void flushTelemetry()
            }
            const anyChasing=entities.some(e=>e.chasing)
            if(anyChasing&&!chaseReported.current){
              chaseReported.current=true
              recordEvent('chase',gameTime,{x:camera.position.x,y:camera.position.z},batteryLevel,stamina,{chaseDuration:6})
            }else if(!anyChasing){
              chaseReported.current=false
            }
            const rescued=pokemon.filter(p=>p.collected).map(p=>p.name)
            const phase=rescued.length>=3?'STALKER + 2 HUNTERS':'SLOW PURSUIT'
            const active=entities.filter(e=>gameTime>=e.releaseAt)
            const threat=rescued.length<2?'NO ENTITY PRESENT':gameTime<entityHoldUntil?`STALKER RELEASE IN ${Math.ceil(entityHoldUntil-gameTime)} S`:!active.length?`SLOW ENTITY RELEASE IN ${Math.ceil(entities[0].releaseAt-gameTime)} S`:`${active.length} ACTIVE · ${phase}`
            const battery=Math.ceil(batteryLevel)
            onBatteryChange(battery)
            const next={rescued,powered,stamina:Math.round(stamina),battery,threat,prompt,target:remaining[0]?.name.toUpperCase()??'EXIT DOOR',meters:Math.round(Math.hypot(target.x-camera.position.x,target.z-camera.position.z)),blackout,stunned}
            const signature=JSON.stringify(next)
            if(signature!==published){published=signature;setMission(next)}
          }
        }else{
          scareTime+=dt
          caughtEntity.position.z=THREE.MathUtils.lerp(-3,-.9,Math.min(1,scareTime/.3))
          if(!reduced){camera.rotation.z=Math.sin(scareTime*55)*.035;caughtEntity.position.x=Math.sin(scareTime*47)*.035}
          if(scareTime>1.3){finished=true;state.active=false;audio.current?.setActive(false);recordEvent('death',gameTime,{x:camera.position.x,y:camera.position.z},batteryLevel,stamina,{immediate:true});setLearningRun(learning.finish(gameTime,batteryLevel,'caught'));setEnded('caught');if(document.pointerLockElement===renderer.domElement)document.exitPointerLock()}
        }
      }
      const powerFailure=gameTime-fakeTime<fakeBlackout
      navigation.current={player:{x:camera.position.x,z:camera.position.z},yaw,entities:entities.filter(e=>gameTime>=e.releaseAt).map(e=>({x:e.mesh.position.x,z:e.mesh.position.z,stalker:powered&&e.id===2})),walls:colliders,pokemon:pokemon.map(f=>({x:f.mesh.position.x,z:f.mesh.position.z,collected:f.collected,name:f.name,color:f.color})),panel:panelPosition,exit:EXIT_POSITION,powered,battery:batteryLevel,disabled:powerFailure||scareTime>=0||finished,run}
      flashlight.visible=devicePower(batteryLevel,state.flashlight,false,powerFailure).flashlight
      if(state.flashlight!==previousFlashlight){previousFlashlight=state.flashlight;audio.current?.cue('flashlight')}
      const nearest=entities.filter(e=>gameTime>=e.releaseAt).reduce((distance,e)=>Math.min(distance,Math.hypot(e.mesh.position.x-camera.position.x,e.mesh.position.z-camera.position.z)),Infinity)
      const dread=Math.max(0,1-nearest/10)
      ambient.intensity=powerFailure?.025:.42-dread*.09
      fog.density=biome.density+dread*.012
      tube.color.set(powerFailure?'#0b0e08':biome.tube)
      scenery.animate(gameTime,reduced)
      pokemon.forEach(f=>{f.beacon.visible=!f.collected&&!powerFailure;if(!f.collected)f.mesh.rotation.y=Math.sin(gameTime*.7)*.3})
      fixtures.forEach((lamp,i)=>{
        const nearEntity=entities.some(e=>gameTime>=e.releaseAt&&Math.hypot(e.mesh.position.x-lamp.position.x,e.mesh.position.z-lamp.position.z)<7)
        const sag=reduced?1:.72+.28*Math.pow(Math.sin(gameTime*.6+i*2.1),2)
        lamp.intensity=powerFailure?0:14*sag*(nearEntity?.35:1)*(scareTime>=0?.3:1)
        if(biomeId==='daycare'&&!reduced)lamp.color.setHSL(.76+Math.sin(gameTime*.15+i)*.07,.32,.65)
      })
      renderer.render(scene,camera)
    }
    frame=requestAnimationFrame(animate)
    return ()=>{
      cancelAnimationFrame(frame);observer.disconnect()
      window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('mousemove',onMouse);window.removeEventListener('blur',blur);document.removeEventListener('pointerlockchange',lockChange)
      document.removeEventListener('visibilitychange',visibility)
      window.removeEventListener(LEARNING_OVERLAY_EVENT,learningOverlay)
      if(document.pointerLockElement===renderer.domElement)document.exitPointerLock()
      const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>()
      scene.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach((m:THREE.Material)=>materials.add(m))}})
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());texture.dispose();floorTexture?.dispose();exitTexture.dispose();signTextures.forEach(t=>t.dispose());warningTextures.forEach(t=>t.dispose());scenery.dispose();renderer.dispose();renderer.domElement.remove()
    }
  },[onBatteryChange,biomeId])
  useEffect(()=>()=>{audio.current?.dispose();audio.current=null},[])
  const begin=()=>{
    try{
      if(!audio.current)audio.current=new HorrorAudio(biomeId)
      audio.current.setMix(volumeRef.current,sound)
      void audio.current.start().catch(()=>setAudioUnavailable(true))
    }catch{setAudioUnavailable(true)}
    controls.current.active=true;controls.current.restart=!!ended
    if (ended) {
      activeSessionId.current = playSession?.id || ('PLAY-' + crypto.randomUUID().slice(0, 8))
      telemetryBatch.current = []
    }
    setStarted(true);setEnded(null);setLearningRun(null)
    const canvas=host.current?.querySelector('canvas')
    if(canvas?.requestPointerLock)try{const request=canvas.requestPointerLock() as Promise<void>|undefined;request?.catch(()=>setLocked(false))}catch{setLocked(false)}
  }
  return <div className="exploration">
    <div ref={host} className="world-canvas"/>
    <div className="dread-vignette" aria-hidden="true"/>
    {started&&!ended&&!error&&<button className="audio-toggle" onClick={()=>{if(!sound)void audio.current?.start().catch(()=>setAudioUnavailable(true));setSound(v=>!v)}} aria-pressed={!sound}>{audioUnavailable?'AUDIO UNAVAILABLE':sound?'AUDIO ON · MUTE':'AUDIO MUTED · ENABLE'}</button>}
    {started&&!ended&&!error&&<div style={{position:'fixed',top:14,right:14,display:'flex',alignItems:'center',gap:7,padding:'4px 10px',background:'rgba(10,16,10,0.85)',border:'1px solid #375232',borderRadius:4,fontFamily:'monospace',fontSize:11,color:'#8ae88b',zIndex:9999,pointerEvents:'none',letterSpacing:'0.06em'}}><span style={{width:7,height:7,borderRadius:'50%',background:'#3fb950',display:'inline-block',boxShadow:'0 0 8px #3fb950'}}/>LIVE TELEMETRY · DB ACTIVE</div>}
    {started&&!ended&&!error&&<NavigationHUD live={navigation} scanning={scanning} sector={biome.sector}/>}
    {started&&!ended&&!error&&<div className={`device-battery ${mission.battery<=20?'battery-low':''}`} role="status"><label>SHARED BATTERY <b>{mission.battery}%</b></label><progress max={100} value={mission.battery}/><small>{mission.battery<=0?'EMPTY · FLASHLIGHT & RADAR OFFLINE':`F LIGHT ${light&&!mission.blackout?'ON':'OFF'} / R RADAR ${scanning&&!mission.blackout?'ON':'OFF'}`}</small>{mission.battery<=20&&<p>{mission.battery<=0?'M MAP STILL AVAILABLE':'LOW POWER · TURN OFF UNUSED DEVICES'}</p>}<button disabled={mission.battery<=0} onClick={()=>{controls.current.flashlight=!controls.current.flashlight;setLight(controls.current.flashlight)}}>F · TOGGLE FLASHLIGHT</button></div>}
    {(!started||ended||error)&&<div className="exploration-gate"><section>
      <span className="eyebrow">TAPE_{biome.tape} / SECTOR {biome.sector} / {biome.name.toUpperCase()}</span>
      <h2>{error?'SIGNAL UNAVAILABLE':ended==='caught'?'IT FOUND YOU.':ended==='escaped'?'TAPE RECOVERED.':'ENTER THE BACKROOMS'}</h2>
      <p>{error?'This device could not initialize WebGL. Try a browser with hardware acceleration.':ended==='caught'?'Something followed you through the dark. After the third rescue, the tall stalker moves at 4.35 m/s. Save your sprint, watch its yellow radar ring, and break sight around corners.':ended==='escaped'?`Pikachu, Charmander, and Squirtle are safe. You escaped ${biome.name} together.`:`${biome.description} Rescue all three Pokémon—but the final rescue awakens a faster stalker among the hunters.`}</p>
      {!ended&&!error&&<><ol className="mission-brief"><li>Use M to navigate 72 rooms. Do not trust the distant sounds.</li><li>Press E to rescue Pokémon. At 2 rescues, 1 slow entity follows.</li><li>After the third: 2 hunters and 1 faster stalker. Sprint to the northeast exit and press E.</li></ol><div className="exploration-keymap"><span><kbd>W A S D</kbd> MOVE</span><span><kbd>MOUSE / DRAG</kbd> LOOK</span><span><kbd>SHIFT</kbd> SPRINT</span><span><kbd>E</kbd> INTERACT</span><span><kbd>F</kbd> FLASHLIGHT</span></div><p className="scare-notice">At 2 rescues: 1 entity at 1.8 m/s. At 3: two hunters at 3.4 m/s and one stalker at 4.35 m/s. Your sprint is 4.8 m/s. Pickup hallucinations, recovery time, and a head start remain. Optional startling sound; no strobe.</p></>}
      {!ended&&!error&&<p>Pokémon locations change every new game and retry. Explore to discover their markers; press M for the wide sector map.</p>}
      {!ended&&!error&&biomeId==='daycare'&&<p className="scare-notice">DAYCARE ANOMALY: crying sometimes comes from a random empty crib. Follow the directional sound and press E nearby to investigate. It is a trap: a fake jump scare, a one-second stun, and a brief blackout. Your rescues stay safe, and entities cannot catch you during the stun.</p>}
      <label className="game-audio"><input type="checkbox" checked={sound} onChange={e=>setSound(e.target.checked)}/> ENABLE SOUND</label>
      {!ended&&!error&&<p className="battery-instructions"><strong>CONSERVE YOUR BATTERY.</strong> Flashlight (F) and radar (R) share one charge. They drain only while running; using both drains faster—about 3 minutes from full. Switch off devices when not needed. No automatic recharge. At 0%, both stop working; your explored map (M) remains available. A new run starts at 100%.</p>}
      {ended&&learningRun&&<RunDebriefButton run={learningRun}/>}
      {!error&&<button className="enter-exploration" onClick={begin}>{ended?'REWIND & TRY AGAIN':'BEGIN EXPLORATION'} ↗</button>}
    </section></div>}
    {started&&!ended&&!error&&<><aside className="mission-tracker"><span className="eyebrow">RESCUE PROTOCOL / SECTOR {biome.sector}</span><h3>{mission.powered?'ALL 3 SAFE · ESCAPE!':'RESCUE THE POKÉMON'}</h3>{POKEMON_LOCATIONS.map(p=><div key={p.name} className={mission.rescued.includes(p.name)?'objective-done':''}><span>{p.name}</span><b>{mission.rescued.includes(p.name)?'SAFE':'FIND'}</b></div>)}<div className={mission.powered?'objective-done':''}><span>Northeast exit</span><b>{mission.powered?'UNLOCKED':'LOCKED'}</b></div><small>{mission.target} · {mission.meters} M <span>STRAIGHT-LINE DISTANCE</span></small><p className={mission.powered?'threat-active':''}>{mission.threat}</p><label>STAMINA <progress max={100} value={mission.stamina}/></label></aside>{(mission.prompt||mission.blackout||mission.stunned)&&<div className={`interaction-prompt ${mission.blackout||mission.stunned?'power-warning':''}`} role="status">{mission.stunned?'HALLUCINATION · STUNNED':mission.blackout?'POWER FAILURE · LIGHTS RECOVERING':mission.prompt}</div>}<div className="exploration-help">{locked?'WASD · MOVE / MOUSE · LOOK':'WASD · MOVE / DRAG VIEW · LOOK'} <span>SHIFT · SPRINT / E · INTERACT</span><button disabled={mission.battery<=0} onClick={()=>{controls.current.flashlight=!controls.current.flashlight;setLight(controls.current.flashlight)}}>F · LIGHT {mission.battery<=0?'EMPTY':mission.blackout?'DISABLED':light?'ON':'OFF'}</button></div><div className="touch-controls">{[['KeyW','↑'],['KeyA','←'],['KeyS','↓'],['KeyD','→']].map(([key,label])=><button key={key} aria-label={`Move ${label}`} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);controls.current.keys.add(key)}} onPointerUp={()=>controls.current.keys.delete(key)} onPointerCancel={()=>controls.current.keys.delete(key)}>{label}</button>)}<button aria-label="Interact" onClick={()=>{controls.current.interact=true}}>E</button><button aria-label="Sprint" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);controls.current.keys.add('ShiftLeft')}} onPointerUp={()=>controls.current.keys.delete('ShiftLeft')} onPointerCancel={()=>controls.current.keys.delete('ShiftLeft')}>RUN</button></div></>}
  </div>
}
