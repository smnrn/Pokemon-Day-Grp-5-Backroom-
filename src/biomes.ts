import type { Collider, Point } from './explorationLogic'

export type BiomeId = 'yellow' | 'lab' | 'daycare'
export const BIOMES = [
  { id:'yellow', name:'The Yellow Safari', tape:'007', sector:'02', seed:981024, wall:'#8b8050', floor:'#44452e', ceiling:'#77765d', fog:'#10140c', ambient:'#c4c499', lamp:'#e0db91', tube:'#c6c396', density:.057, description:'Damp wallpaper. Endless rooms. Something breathing in the walls.', warnings:['DO NOT FOLLOW THE VOICES','IT KNOWS YOU ARE HERE','DO NOT LOOK BACK'] },
  { id:'lab', name:'The Abandoned Cloning Lab', tape:'008', sector:'03', seed:3981024, wall:'#728486', floor:'#303d41', ceiling:'#485457', fog:'#081b20', ambient:'#a8d6d7', lamp:'#70d3d7', tube:'#a4dcda', density:.049, description:'Cold containment wings, broken specimen tanks, and machines left running.', warnings:['CONTAINMENT HAS FAILED','THEY ARE NOT THE ORIGINALS','DO NOT OPEN THE TANKS'] },
  { id:'daycare', name:'The Glitching Daycare', tape:'009', sector:'04', seed:4981024, wall:'#9a8187', floor:'#655665', ceiling:'#746b7c', fog:'#1b1023', ambient:'#d0b5d4', lamp:'#bd87d1', tube:'#d2a9cc', density:.054, description:'An empty nursery, warped toys, abandoned cribs, and a broken lullaby.', warnings:['QUIET TIME NEVER ENDS','THE CHILDREN ARE NOT HERE','DO NOT FOLLOW THE LAUGHTER'] },
] as const
export function getBiome(id: BiomeId) { return BIOMES.find(b=>b.id===id)! }
export function biomeObstacles(id: BiomeId, rooms: Point[]) {
  const props: (Collider & { kind:'tank'|'console'|'crib'|'blocks' })[]=[]
  rooms.forEach((p,i)=>{
    if(id==='lab'&&i%7===2)props.push({x:p.x+2.4,z:p.z+2.4,w:1.7,d:1.7,kind:'tank'})
    else if(id==='lab'&&i%11===3)props.push({x:p.x-2.3,z:p.z-2.3,w:1.8,d:1.2,kind:'console'})
    else if(id==='daycare'&&i%6===1)props.push({x:p.x+2.25,z:p.z+2.3,w:2.2,d:1.4,kind:'crib'})
    else if(id==='daycare'&&i%5===2)props.push({x:p.x-2.5,z:p.z-2.4,w:1.4,d:1.2,kind:'blocks'})
  })
  return props
}
