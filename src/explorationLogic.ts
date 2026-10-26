export type Point = { x: number; z: number }
export type Collider = Point & { w: number; d: number }
export const LEVEL_BOUNDS = { minX: -36, maxX: 36, minZ: -46, maxZ: 18 }
export const PLAYER_START = { x: 0, z: 14 }
export const EXIT_POSITION = { x: 32, z: -45.65 }
export const PANEL_POSITION = { x: 30, z: -42 }
const CELL_SIZE = 8, COLS = 9, ROWS = 8
export const ROOM_CENTERS: Point[] = Array.from({length:COLS*ROWS},(_,i)=>({x:-32+(i%COLS)*CELL_SIZE,z:14-Math.floor(i/COLS)*CELL_SIZE}))
// Seeded connected maze with additional loops: renderer, navigation and tests share these walls.
export function createMazeWalls(seed=981024): Collider[] {
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  const passage=new Set<string>(),visited=new Set<number>([4]),stack=[4]
  const edge=(a:number,b:number)=>`${Math.min(a,b)}:${Math.max(a,b)}`
  while(stack.length){
    const cell=stack[stack.length-1],c=cell%COLS,r=Math.floor(cell/COLS)
    const neighbors=[c>0?cell-1:-1,c<COLS-1?cell+1:-1,r>0?cell-COLS:-1,r<ROWS-1?cell+COLS:-1].filter(n=>n>=0&&!visited.has(n))
    if(!neighbors.length){stack.pop();continue}
    const next=neighbors[Math.floor(random()*neighbors.length)]
    passage.add(edge(cell,next));visited.add(next);stack.push(next)
  }
  for(let i=0;i<COLS*ROWS;i++){
    if(i%COLS<COLS-1&&random()<.22)passage.add(edge(i,i+1))
    if(i+COLS<COLS*ROWS&&random()<.22)passage.add(edge(i,i+COLS))
  }
  const walls:Collider[]=[
    {x:-36,z:-14,w:.3,d:64},{x:36,z:-14,w:.3,d:64},
    {x:0,z:18,w:72,d:.3},{x:0,z:-46,w:72,d:.3},
  ]
  ROOM_CENTERS.forEach((p,i)=>{
    if(i%COLS<COLS-1&&!passage.has(edge(i,i+1)))walls.push({x:p.x+4,z:p.z,w:.3,d:8})
    if(i+COLS<COLS*ROWS&&!passage.has(edge(i,i+COLS)))walls.push({x:p.x,z:p.z-4,w:8,d:.3})
  })
  return walls
}
export const MAZE_WALLS = createMazeWalls()
export const POKEMON_LOCATIONS = [
  { name: 'Pikachu', x: -32, z: -2, color: '#f2ce3b' },
  { name: 'Charmander', x: 32, z: -26, color: '#ef8640' },
  { name: 'Squirtle', x: -24, z: -42, color: '#6fc4d5' },
]
export function randomizePokemonLocations(random:()=>number=Math.random, previous: readonly Point[] = []) {
  const candidates=ROOM_CENTERS
    .filter(p=>p.z<=-2&&Math.hypot(p.x-PLAYER_START.x,p.z-PLAYER_START.z)>=16&&Math.hypot(p.x-EXIT_POSITION.x,p.z-EXIT_POSITION.z)>=12)
    .map(p=>({...p}))
  for(let i=candidates.length-1;i>0;i--){
    const j=Math.min(i,Math.floor(random()*(i+1)))
    ;[candidates[i],candidates[j]]=[candidates[j],candidates[i]]
  }
  const selected:Point[]=[]
  return POKEMON_LOCATIONS.map((species,i)=>{
    const different=(p:Point)=>!previous[i]||p.x!==previous[i].x||p.z!==previous[i].z
    const point=candidates.find(p=>different(p)&&selected.every(other=>Math.hypot(p.x-other.x,p.z-other.z)>=20))
    if(!point)throw new Error('No safe, separated Pokémon room available')
    selected.push(point)
    return {...species,...point}
  })
}
export function rollPickupScare(random:()=>number=Math.random) {
  const variant=Math.min(2,Math.floor(random()*3))
  return { delay:.3+random()*1.1, stun:[.6,0,.3][variant], blackout:[.25,1.2,.6][variant], apparition:[.22,.14,.35][variant], offset:(random()-.5)*.5 }
}
export function allPokemonCollected(names: readonly string[]) {
  return POKEMON_LOCATIONS.every(p => names.includes(p.name))
}
export function entityChaseSpeed(rescuedCount: number, entityId = 0) {
  return rescuedCount >= 3 ? (entityId === 2 ? 4.35 : 3.4) : rescuedCount >= 2 ? 1.8 : 0
}
export function entityCount(rescuedCount: number) {
  return rescuedCount >= 3 ? 3 : rescuedCount >= 2 ? 1 : 0
}
export function pickEntitySpawns(player: Point, walls: Collider[], count: number, occupied: Point[] = []): Point[] {
  const candidates = ROOM_CENTERS
    .filter(p=>Math.abs(p.x)>=8&&p.z>=player.z+7&&Math.hypot(p.x-player.x,p.z-player.z)>=10&&walkable(p,walls))
    .sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))
  const selected: Point[]=[]
  for(const candidate of candidates){
    if(selected.length>=count)break
    if([...occupied,...selected].every(p=>Math.hypot(p.x-candidate.x,p.z-candidate.z)>=6))selected.push({...candidate})
  }
  return selected
}
export function pickEntitySpawn(player: Point, walls: Collider[]): Point | null {
  return pickEntitySpawns(player,walls,1)[0] ?? null
}
export const RADAR_RANGE = 20
export function radarContact(player: Point, yaw: number, entity: Point | null, range = RADAR_RANGE) {
  if (!entity) return { distance: Infinity, detected: false, x: 0, y: 0, strength: 0 }
  const dx = entity.x - player.x, dz = entity.z - player.z
  const distance = Math.hypot(dx, dz)
  return { distance, detected: distance <= range, x: (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / range, y: (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / range, strength: Math.max(0, 1 - distance / range) }
}
export function radarContacts<T extends Point>(player: Point, yaw: number, entities: T[]) {
  return entities.map(entity=>({...radarContact(player,yaw,entity),entity})).filter(c=>c.detected).sort((a,b)=>a.distance-b.distance)
}
export function revealExploration(player: Point, walls: Collider[], revealed: Set<string>, radius = 8) {
  for (let x = Math.floor(player.x - radius); x <= Math.ceil(player.x + radius); x++)
    for (let z = Math.floor(player.z - radius); z <= Math.ceil(player.z + radius); z++) {
      const key = `${x},${z}`, point = { x: x + .5, z: z + .5 }
      if (revealed.has(key) || Math.hypot(point.x-player.x, point.z-player.z) > radius) continue
      if (clearPath(player, point, walls)) {
        revealed.add(key)
        // Reveal the boundary of a visible room, without revealing behind it.
        for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const neighbor = { x: point.x+dx, z: point.z+dz }
          if (!walkable(neighbor, walls, .1)) revealed.add(`${x+dx},${z+dz}`)
        }
      }
    }
}
export function walkable(p: Point, walls: Collider[], radius = .3) {
  return !walls.some(w => Math.abs(p.x - w.x) < w.w / 2 + radius && Math.abs(p.z - w.z) < w.d / 2 + radius)
}
export function clearPath(a: Point, b: Point, walls: Collider[], radius = 0) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .12))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    if (!walkable({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, walls, radius)) return false
  }
  return true
}
// Repath to the last seen position, not through walls or to a hidden player.
export function findRoute(start: Point, target: Point, walls: Collider[]): Point[] {
  if (clearPath(start, target, walls, .3)) return [{ ...target }]
  const candidates: Point[] = []
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const point = { x: Math.round(start.x) + dx, z: Math.round(start.z) + dz }
    if (clearPath(start, point, walls, .3)) candidates.push(point)
  }
  const origin = candidates.sort((a,b) => Math.hypot(a.x-start.x,a.z-start.z)-Math.hypot(b.x-start.x,b.z-start.z))[0]
  if (!origin) return []
  const key = (p: Point) => `${p.x},${p.z}`
  const queue = [origin], previous = new Map<string, Point | null>([[key(origin), null]])
  let goal: Point | undefined
  for (let index = 0; index < queue.length && index < 6500; index++) {
    const current = queue[index]
    if (Math.hypot(current.x - target.x, current.z - target.z) < 1.4 && clearPath(current, target, walls, .3)) { goal = current; break }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: current.x + dx, z: current.z + dz }
      if (next.x < LEVEL_BOUNDS.minX+1 || next.x > LEVEL_BOUNDS.maxX-1 || next.z < LEVEL_BOUNDS.minZ+1 || next.z > LEVEL_BOUNDS.maxZ-1 || previous.has(key(next)) || !clearPath(current, next, walls, .3)) continue
      previous.set(key(next), current); queue.push(next)
    }
  }
  if (!goal) return []
  const route: Point[] = [{ ...target }]
  for (let p: Point | null = goal; p; p = previous.get(key(p)) ?? null) route.unshift(p)
  while (route.length > 1 && clearPath(start, route[1], walls, .3)) route.shift()
  return route
}
