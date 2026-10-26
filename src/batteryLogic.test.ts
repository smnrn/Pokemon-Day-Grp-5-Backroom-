import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BATTERY_CAPACITY, devicePower, drainBattery } from './batteryLogic.ts'

test('flashlight and radar drain only when used; using both consumes their combined power', () => {
  assert.equal(drainBattery(100,10,false,false),100)
  assert.equal(drainBattery(100,10,true,false),98)
  assert.equal(drainBattery(100,10,false,true),96.5)
  assert.equal(drainBattery(100,10,true,true),94.5)
})
test('exhausted batteries shut down both devices and never recharge passively', () => {
  assert.equal(drainBattery(1,10,true,true),0)
  assert.deepEqual(devicePower(0,true,true),{flashlight:false,radar:false})
  assert.equal(drainBattery(0,60,false,false),0)
  assert.equal(drainBattery(100,-10,true,true),100)
  assert.equal(BATTERY_CAPACITY,100)
})
test('blackouts stop device operation and their drain without deleting the charge', () => {
  const power=devicePower(50,true,true,true)
  assert.equal(drainBattery(50,10,power.flashlight,power.radar),50)
  assert.deepEqual(devicePower(50,true,true),{flashlight:true,radar:true})
})
test('drain is frame-rate independent and remaining charge can be conserved', () => {
  let charge=100
  for(let i=0;i<600;i++)charge=drainBattery(charge,1/60,true,true)
  assert.ok(Math.abs(charge-94.5)<1e-8)
  assert.equal(drainBattery(charge,100,false,false),charge)
})
