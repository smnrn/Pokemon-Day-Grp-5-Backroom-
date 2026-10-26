import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BIOMES, biomeObstacles, getBiome } from './biomes.ts'
import { clearPath, createMazeWalls, EXIT_POSITION, findRoute, pickEntitySpawns, PLAYER_START, randomizePokemonLocations, ROOM_CENTERS } from './explorationLogic.ts'

test('archive levels have distinct tape identities, palettes, and playable maze layouts', () => {
  assert.equal(BIOMES.length,3)
  assert.equal(new Set(BIOMES.map(b=>b.tape)).size,3)
  assert.equal(new Set(BIOMES.map(b=>b.sector)).size,3)
  assert.notDeepEqual(createMazeWalls(getBiome('lab').seed),createMazeWalls(getBiome('yellow').seed))
  assert.notDeepEqual(createMazeWalls(getBiome('daycare').seed),createMazeWalls(getBiome('lab').seed))
  assert.ok(biomeObstacles('lab',ROOM_CENTERS).some(p=>p.kind==='tank'))
  assert.ok(biomeObstacles('daycare',ROOM_CENTERS).some(p=>p.kind==='crib'))
})
for(const biome of BIOMES){
  test(`${biome.name}: scenery preserves all 72 connected rooms and rescue/escape routes`,()=>{
    const walls=[...createMazeWalls(biome.seed),...biomeObstacles(biome.id,ROOM_CENTERS)]
    const reached=new Set([4]),queue=[4]
    for(let index=0;index<queue.length;index++){
      const current=ROOM_CENTERS[queue[index]]
      ROOM_CENTERS.forEach((p,i)=>{
        if(!reached.has(i)&&Math.hypot(p.x-current.x,p.z-current.z)===8&&clearPath(current,p,walls,.3)){reached.add(i);queue.push(i)}
      })
    }
    assert.equal(reached.size,72)
    let seed=biome.seed
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
    const pokemon=randomizePokemonLocations(random)
    walls.push(...pokemon.map(p=>({...p,w:1,d:.7})))
    for(const p of pokemon){
      const approach={x:p.x+1.5,z:p.z}
      assert.ok(findRoute(PLAYER_START,approach,walls).length)
      assert.equal(pickEntitySpawns(approach,walls,3).length,3)
    }
    assert.ok(findRoute(PLAYER_START,{x:EXIT_POSITION.x,z:EXIT_POSITION.z+1},walls).length)
  })
}
