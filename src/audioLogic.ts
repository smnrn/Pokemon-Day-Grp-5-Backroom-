import type { BiomeId } from './biomes'

export const MAP_AMBIENT_SOUNDS = {
  yellow: ['wall-whisper','ceiling-knock','carpet-drag'],
  lab: ['pressure-vent','containment-thump','failed-alarm'],
  daycare: ['broken-music-box','toy-creak','nursery-hush'],
} as const
export function ambientSound(profile: BiomeId, roll = Math.random()) {
  const bank=MAP_AMBIENT_SOUNDS[profile]
  return bank[Math.max(0,Math.min(bank.length-1,Math.floor(roll*bank.length)))]
}

export function audioDynamics(stamina: number, sprinting: boolean, distance: number | null, chasing: boolean) {
  const energy = Math.max(0, Math.min(1, stamina / 100))
  const proximity = distance === null ? 0 : Math.max(0, Math.min(1, 1 - distance / 24))
  const stress = Math.max(1 - energy, sprinting ? .85 : 0, chasing ? proximity * .9 : 0)
  return { proximity, stress, breathPeriod: Math.max(1.3, 3.8 - stress * 2.5), breathGain: .035 + stress * .075, heartbeatPeriod: 1.05 - stress * .5 }
}
