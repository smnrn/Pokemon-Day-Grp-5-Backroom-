import { clearPath, EXIT_POSITION, walkable, type Collider, type Point } from './explorationLogic.ts'

export const CRY_STUN_SECONDS = 1
export const CRY_INTERACTION_RADIUS = 2.2
export function chooseCryingLocation(player:Point, locations:Point[], walls:Collider[], previous:Point|null=null, random:()=>number=Math.random):Point|null {
  const valid=locations.filter(p=>walkable(p,walls)&&Math.hypot(p.x-player.x,p.z-player.z)>=5&&Math.hypot(p.x-EXIT_POSITION.x,p.z-EXIT_POSITION.z)>6&&(!previous||p.x!==previous.x||p.z!==previous.z))
  const nearby=valid.filter(p=>Math.hypot(p.x-player.x,p.z-player.z)<=30)
  const pool=nearby.length?nearby:valid.sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z)).slice(0,3)
  const chosen=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))]
  return chosen?{...chosen}:null
}
export function canInvestigateCrying(player:Point, source:Point|null, walls:Collider[]) {
  return !!source&&Math.hypot(source.x-player.x,source.z-player.z)<=CRY_INTERACTION_RADIUS&&clearPath(player,source,walls)
}
export function cryingCooldown(random:()=>number=Math.random) { return 18+random()*16 }
