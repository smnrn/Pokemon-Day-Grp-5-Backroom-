import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allPokemonCollected, clearPath, entityChaseSpeed, entityCount, EXIT_POSITION, findRoute, LEVEL_BOUNDS, MAZE_WALLS, PANEL_POSITION, pickEntitySpawn, pickEntitySpawns, PLAYER_START, POKEMON_LOCATIONS, randomizePokemonLocations, rollPickupScare, ROOM_CENTERS, walkable, radarContact, radarContacts, revealExploration, type Collider, type Point } from './explorationLogic.ts'

test('walls block sight and direct pursuit, but corners permit a route', () => {
  const walls = [{ x: 0, z: 0, w: .3, d: 6 }]
  const start = { x: -3, z: 0 }, target = { x: 3, z: 0 }
  assert.equal(clearPath(start, target, walls), false)
  const route = findRoute(start, target, walls)
  assert.ok(route.length > 1)
  let previous = start
  for (const point of route) {
    assert.equal(clearPath(previous, point, walls, .3), true)
    previous = point
  }
  assert.deepEqual(route[route.length - 1], target)
})

test('blocked destinations do not produce wall-crossing routes', () => {
  assert.deepEqual(findRoute({ x: 0, z: 3 }, { x: 0, z: 0 }, [{ x: 0, z: 0, w: 2, d: 2 }]), [])
  assert.equal(walkable({ x: 1.2, z: 0 }, [{ x: 0, z: 0, w: 2, d: 2 }]), false)
})

test('pursuit can repath when rounding its position would land inside a wall', () => {
  const walls = [{ x: 0, z: 0, w: .3, d: 6 }]
  const start = { x: .46, z: 0 }, target = { x: -3, z: 0 }
  const route = findRoute(start, target, walls)
  assert.ok(route.length)
  let previous = start
  for (const next of route) {
    assert.equal(clearPath(previous, next, walls, .3), true)
    previous = next
  }
})

test('radar uses live world distance and heading-relative bearings', () => {
  const player={x:2,z:3}
  const front=radarContact(player,0,{x:2,z:-7})
  assert.equal(front.distance,10)
  assert.equal(front.x,0)
  assert.equal(front.y,-.5)
  const right=radarContact(player,0,{x:12,z:3})
  assert.equal(right.x,.5)
  assert.equal(right.y,0)
  const turned=radarContact(player,Math.PI/2,{x:2,z:-7})
  assert.ok(Math.abs(turned.x-.5)<1e-9)
  assert.ok(Math.abs(turned.y)<1e-9)
  assert.equal(radarContact(player,0,{x:2,z:24}).detected,false)
  assert.equal(radarContact(player,0,{x:2,z:24}).strength,0)
})

test('exploration reveals nearby visible rooms, retains them, and respects walls', () => {
  const revealed=new Set<string>()
  const walls=[{x:0,z:0,w:.3,d:30}]
  revealExploration({x:-3,z:0},walls,revealed,6)
  assert.equal(revealed.has('-3,0'),true)
  assert.equal(revealed.has('3,0'),false)
  assert.equal(revealed.has('-3,12'),false)
  const firstSize=revealed.size
  revealExploration({x:3,z:0},walls,revealed,6)
  assert.equal(revealed.has('3,0'),true)
  assert.equal(revealed.has('-3,0'),true)
  assert.ok(revealed.size>firstSize)
})

test('all mission stations and the exit are reachable in the shared maze layout', () => {
  const walls: Collider[] = [...MAZE_WALLS]
  POKEMON_LOCATIONS.forEach(p => walls.push({ ...p, w: 1, d: .7 }))
  const stations: Point[] = POKEMON_LOCATIONS.map(p => ({ x: p.x + 1.5, z: p.z }))
  stations.push(PANEL_POSITION, {x:EXIT_POSITION.x,z:EXIT_POSITION.z+1})
  let start: Point = PLAYER_START
  for (const station of stations) {
    const route = findRoute(start, station, walls)
    assert.ok(route.length, `Unreachable station: ${JSON.stringify(station)}`)
    let previous = start
    for (const next of route) {
      assert.equal(clearPath(previous, next, walls, .3), true)
      previous = next
    }
    start = station
  }
  for (const p of POKEMON_LOCATIONS) {
    const player={x:p.x+1.5,z:p.z}
    const spawn=pickEntitySpawn(player,walls)
    assert.ok(spawn, `No safe spawn after collecting ${p.name} last`)
    assert.ok(Math.abs(spawn.x)>=6,'Entity must spawn off the central corridor')
    assert.ok(spawn.z>=player.z+7,'Entity must spawn behind the escape direction')
    assert.ok(Math.hypot(spawn.x-player.x,spawn.z-player.z)>=10,'At least a ten-meter head start')
    assert.equal(walkable(spawn,walls),true)
    assert.ok(findRoute(spawn,player,walls).length,'Entity can navigate out of its side room')
  }
})

test('the widened maze has 72 connected rooms and is wider than the original corridor', () => {
  assert.equal(ROOM_CENTERS.length,72)
  assert.ok(LEVEL_BOUNDS.maxX-LEVEL_BOUNDS.minX>22*3)
  const reached=new Set<number>([4]),queue=[4]
  for(let index=0;index<queue.length;index++){
    const current=queue[index]
    ROOM_CENTERS.forEach((room,i)=>{
      if(reached.has(i)||Math.hypot(room.x-ROOM_CENTERS[current].x,room.z-ROOM_CENTERS[current].z)!==8)return
      if(clearPath(ROOM_CENTERS[current],room,MAZE_WALLS,.3)){reached.add(i);queue.push(i)}
    })
  }
  assert.equal(reached.size,72)
})

test('pickup scares randomize type and delay and always recover within bounded durations', () => {
  const a=rollPickupScare(()=>0),b=rollPickupScare(()=>.5),c=rollPickupScare(()=>.999)
  assert.notEqual(a.stun,b.stun)
  assert.notEqual(b.blackout,c.blackout)
  assert.notEqual(a.delay,c.delay)
  for(const scare of [a,b,c]){
    assert.ok(scare.delay>=.3&&scare.delay<1.4)
    assert.ok(scare.stun>=0&&scare.stun<=.6)
    assert.ok(scare.blackout>0&&scare.blackout<=1.2)
    assert.ok(scare.apparition>0&&scare.apparition<.4)
  }
})

test('escape unlock requires all three distinct Pokémon, in any collection order', () => {
  assert.equal(allPokemonCollected([]),false)
  assert.equal(allPokemonCollected(['Pikachu','Charmander']),false)
  assert.equal(allPokemonCollected(['Pikachu','Pikachu','Charmander']),false)
  assert.equal(allPokemonCollected(['Squirtle','Pikachu','Charmander']),true)
})

test('an inactive entity never appears on radar', () => {
  const contact=radarContact({x:0,z:0},0,null)
  assert.equal(contact.detected,false)
  assert.equal(contact.strength,0)
  assert.equal(contact.distance,Infinity)
})

test('entity stays inactive until 2 rescues, chases slowly at 2, and speeds up at 3', () => {
  assert.equal(entityChaseSpeed(0),0)
  assert.equal(entityChaseSpeed(1),0)
  assert.equal(entityChaseSpeed(2),1.8)
  assert.ok(entityChaseSpeed(2)<2.8,'Slow pursuit is slower than walking')
  assert.equal(entityChaseSpeed(3),3.4)
  assert.ok(entityChaseSpeed(3)>entityChaseSpeed(2))
  assert.ok(entityChaseSpeed(3)<4.8,'Fast pursuit can still be outrun by sprinting')
  assert.equal(entityChaseSpeed(0),0,'A new run returns to inactive speed')
})

test('only one stalker becomes faster after the third rescue, without outrunning sprint', () => {
  assert.deepEqual([0,1,2].map(id=>entityChaseSpeed(3,id)),[3.4,3.4,4.35])
  assert.ok(entityChaseSpeed(3,2)<4.8)
  assert.equal(entityChaseSpeed(2,0),1.8)
  assert.equal(entityChaseSpeed(1,2),0)
  assert.equal(entityChaseSpeed(0,2),0,'Retry resets stalker speed')
})

test('rescue progression releases exactly one slow entity then three fast entities', () => {
  assert.deepEqual([0,1,2,3].map(entityCount),[0,0,1,3])
  assert.equal(entityCount(0),0,'Retry resets the expected entity count')
})

test('additional entities spawn in distinct accessible rooms, away from the player and original entity', () => {
  const walls=[...MAZE_WALLS,...POKEMON_LOCATIONS.map(p=>({...p,w:1,d:.7}))]
  for(const p of POKEMON_LOCATIONS){
    const player={x:p.x+1.5,z:p.z}
    const original=pickEntitySpawn(player,walls)!
    const additional=pickEntitySpawns(player,walls,2,[original])
    assert.equal(additional.length,2)
    const all=[original,...additional]
    for(let i=0;i<all.length;i++){
      assert.ok(Math.hypot(all[i].x-player.x,all[i].z-player.z)>=10)
      assert.ok(all[i].z>=player.z+7)
      assert.ok(findRoute(all[i],player,walls).length)
      for(let j=0;j<i;j++)assert.ok(Math.hypot(all[i].x-all[j].x,all[i].z-all[j].z)>=6)
    }
  }
})

test('radar reports all in-range entities independently and sorts nearest first', () => {
  const contacts=radarContacts({x:0,z:0},0,[{x:0,z:-12},{x:5,z:0},{x:-8,z:0},{x:30,z:0}])
  assert.equal(contacts.length,3)
  assert.deepEqual(contacts.map(c=>c.distance),[5,8,12])
  assert.ok(contacts[0].x>0)
  assert.ok(contacts[1].x<0)
  assert.ok(contacts[2].y<0)
  assert.deepEqual(radarContacts({x:0,z:0},0,[]),[])
})

function seededRandom(seed:number) {
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
}
test('new runs randomize all three species without changing their identity', () => {
  const first=randomizePokemonLocations(seededRandom(1))
  const second=randomizePokemonLocations(seededRandom(400))
  assert.notDeepEqual(first,second)
  assert.deepEqual(first.map(p=>p.name),['Pikachu','Charmander','Squirtle'])
  assert.deepEqual(first.map(p=>p.color),POKEMON_LOCATIONS.map(p=>p.color))
})
test('retry moves every Pokémon away from its previous position, even with the same random sequence', () => {
  const first=randomizePokemonLocations(()=>0)
  const second=randomizePokemonLocations(()=>0,first)
  first.forEach((p,i)=>assert.ok(p.x!==second[i].x||p.z!==second[i].z))
})
test('randomized placements are separated, reachable, and permit safe pursuing entities', () => {
  for(let seed=1;seed<=12;seed++){
    const locations=randomizePokemonLocations(seededRandom(seed))
    const walls=[...MAZE_WALLS,...locations.map(p=>({...p,w:1,d:.7}))]
    for(let i=0;i<locations.length;i++){
      const p=locations[i],approach={x:p.x+1.5,z:p.z}
      assert.ok(Math.hypot(p.x-PLAYER_START.x,p.z-PLAYER_START.z)>=16)
      assert.ok(Math.hypot(p.x-EXIT_POSITION.x,p.z-EXIT_POSITION.z)>=12)
      for(let j=0;j<i;j++)assert.ok(Math.hypot(p.x-locations[j].x,p.z-locations[j].z)>=20)
      const route=findRoute(PLAYER_START,approach,walls)
      assert.ok(route.length,`Unreachable ${p.name} for seed ${seed}`)
      let previous:Point=PLAYER_START
      for(const next of route){assert.equal(clearPath(previous,next,walls,.3),true);previous=next}
      assert.equal(pickEntitySpawns(approach,walls,3).length,3)
    }
    assert.ok(findRoute(PLAYER_START,{x:EXIT_POSITION.x,z:EXIT_POSITION.z+1},walls).length)
  }
})
