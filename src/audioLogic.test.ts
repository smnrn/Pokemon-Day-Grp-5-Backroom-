import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ambientSound, audioDynamics, MAP_AMBIENT_SOUNDS } from './audioLogic.ts'

test('sprinting and exhaustion make breathing faster and louder than resting', () => {
  const rest=audioDynamics(100,false,null,false)
  for(const exertion of [audioDynamics(100,true,null,false),audioDynamics(0,false,null,false)]){
    assert.ok(exertion.breathPeriod<rest.breathPeriod)
    assert.ok(exertion.breathGain>rest.breathGain)
    assert.ok(exertion.heartbeatPeriod<rest.heartbeatPeriod)
  }
})
test('only an active nearby entity adds proximity and chase-related breathing stress', () => {
  const inactive=audioDynamics(100,false,null,true)
  const near=audioDynamics(100,false,3,true)
  const far=audioDynamics(100,false,40,true)
  assert.equal(inactive.proximity,0)
  assert.equal(inactive.stress,0)
  assert.equal(far.proximity,0)
  assert.ok(near.proximity>.8)
  assert.ok(near.stress>far.stress)
})
test('audio dynamics clamp abnormal stamina and distance inputs to safe ranges', () => {
  for(const mix of [audioDynamics(-100,true,-2,true),audioDynamics(200,false,500,false)]){
    assert.ok(mix.stress>=0&&mix.stress<=1)
    assert.ok(mix.proximity>=0&&mix.proximity<=1)
    assert.ok(mix.breathGain>0&&mix.breathGain<.12)
    assert.ok(mix.breathPeriod>=1.3&&mix.breathPeriod<=3.8)
  }
})

test('each map selects from its own distinct creepy sound bank',()=>{
  const banks=Object.values(MAP_AMBIENT_SOUNDS).flat()
  assert.equal(new Set(banks).size,9)
  assert.equal(ambientSound('yellow',0),'wall-whisper')
  assert.equal(ambientSound('lab',0),'pressure-vent')
  assert.equal(ambientSound('daycare',0),'broken-music-box')
  assert.equal(ambientSound('daycare',.999),'nursery-hush')
})
