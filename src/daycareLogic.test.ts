import { test } from 'node:test'
import assert from 'node:assert/strict'
import { biomeObstacles, getBiome } from './biomes.ts'
import { createMazeWalls, findRoute, PLAYER_START, ROOM_CENTERS, walkable } from './explorationLogic.ts'
import { canInvestigateCrying, chooseCryingLocation, CRY_STUN_SECONDS, cryingCooldown } from './daycareLogic.ts'

const props=biomeObstacles('daycare',ROOM_CENTERS)
const walls=[...createMazeWalls(getBiome('daycare').seed),...props]
const locations=props.filter(p=>p.kind==='crib').map(p=>({x:p.x,z:p.z-1.2}))
test('crying sources sit outside real crib colliders and can be reached',()=>{
  for(const point of locations){
    assert.equal(walkable(point,walls),true)
    assert.ok(findRoute(PLAYER_START,point,walls).length)
  }
})
test('crying chooses random nearby locations without immediately repeating the previous crib',()=>{
  const first=chooseCryingLocation(PLAYER_START,locations,walls,null,()=>0)
  const other=chooseCryingLocation(PLAYER_START,locations,walls,null,()=>.999)
  assert.ok(first)
  assert.ok(other)
  assert.notDeepEqual(first,other)
  assert.notDeepEqual(chooseCryingLocation(PLAYER_START,locations,walls,first,()=>0),first)
})
test('cry investigation requires proximity and an unobstructed path, with exactly a one-second stun',()=>{
  assert.equal(CRY_STUN_SECONDS,1)
  assert.equal(canInvestigateCrying({x:0,z:0},{x:0,z:1},[]),true)
  assert.equal(canInvestigateCrying({x:0,z:0},{x:0,z:4},[]),false)
  assert.equal(canInvestigateCrying({x:0,z:0},{x:0,z:2},[{x:0,z:1,w:4,d:.3}]),false)
  assert.equal(canInvestigateCrying({x:0,z:0},null,[]),false)
  assert.equal(chooseCryingLocation(PLAYER_START,[],walls),null)
  assert.equal(cryingCooldown(()=>0),18)
  assert.equal(cryingCooldown(()=>.5),26)
})
