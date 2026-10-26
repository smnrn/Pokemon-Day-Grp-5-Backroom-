import { ambientSound, audioDynamics } from './audioLogic'
import type { BiomeId } from './biomes'

export type SoundCue = 'pickup' | 'release' | 'escalate' | 'scare' | 'caught' | 'flashlight' | 'scanner' | 'blackout' | 'restore' | 'escape'
export type EntitySound = { id: number; distance: number; pan: number; moved: number; chasing: boolean; occluded: boolean; stalker?: boolean }
type AudioFrame = {
  moved: number; entities: EntitySound[]; sprinting: boolean; stamina: number
  blackout: boolean; scanning: boolean
}

/** Procedural, session-local soundscape. Every source routes through one master limiter. */
export class HorrorAudio {
  private context: AudioContext
  private master: GainNode
  private loops: GainNode
  private ambience: GainNode
  private growls: { gain: GainNode; pan: StereoPannerNode }[] = []
  private noiseBuffer: AudioBuffer
  private sources = new Set<AudioScheduledSourceNode>()
  private active = false
  private disposed = false
  private nextBreath = 0
  private nextBeat = 0
  private nextPing = 0
  private nextAtmosphere = 0
  private nextRasp = 0
  private nextEntityStep = [0,0,0]
  private traveled = 0
  private foot = 1
  private powerOff = false
  private profile: BiomeId
  private cryBus: GainNode

  constructor(profile: BiomeId='yellow') {
    this.profile=profile
    this.context = new AudioContext()
    const ctx = this.context
    this.master = ctx.createGain(); this.master.gain.value = 0
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -15; limiter.knee.value = 10; limiter.ratio.value = 10
    limiter.attack.value = .004; limiter.release.value = .2
    this.master.connect(limiter).connect(ctx.destination)
    this.cryBus=ctx.createGain();this.cryBus.gain.value=0;this.cryBus.connect(this.master)
    this.loops = ctx.createGain(); this.loops.gain.value = 0; this.loops.connect(this.master)
    this.ambience = ctx.createGain(); this.ambience.gain.value = .055; this.ambience.connect(this.loops)
    for(let i=0;i<3;i++){
      const gain=ctx.createGain(),pan=ctx.createStereoPanner();gain.gain.value=0
      gain.connect(pan).connect(this.loops);this.growls.push({gain,pan})
    }
    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate)
    const data = this.noiseBuffer.getChannelData(0)
    let brown = 0
    for (let i = 0; i < data.length; i++) {
      brown = (brown + (Math.random() * 2 - 1) * .12) / 1.12
      data[i] = (Math.random() * 2 - 1) * .6 + brown * .4
    }
    const hum=profile==='lab'?48:profile==='daycare'?55:60
    for (const frequency of [hum, hum*2, hum*3+.7]) {
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = frequency
      const level = ctx.createGain(); level.gain.value = frequency === hum ? .5 : .15
      osc.connect(level).connect(this.ambience); this.track(osc); osc.start()
    }
    const hiss = ctx.createBufferSource(); hiss.buffer = this.noiseBuffer; hiss.loop = true
    const lowpass = ctx.createBiquadFilter(); lowpass.frequency.value = 470
    hiss.connect(lowpass).connect(this.ambience); this.track(hiss); hiss.start()
    this.growls.forEach((voice,i)=>{
      const drone = ctx.createOscillator(); drone.type = 'sawtooth'; drone.frequency.value = i===2?31:43+i*7
      const lowGrowl = ctx.createBiquadFilter(); lowGrowl.frequency.value = i===2?420:170
      drone.connect(lowGrowl).connect(voice.gain); this.track(drone); drone.start()
    })
    const undertone=ctx.createOscillator(),undertoneGain=ctx.createGain()
    undertone.frequency.value=29;undertoneGain.gain.value=.018
    undertone.connect(undertoneGain).connect(this.loops);this.track(undertone);undertone.start()
  }
  private track(source: AudioScheduledSourceNode) {
    this.sources.add(source)
    source.addEventListener('ended', () => { this.sources.delete(source); source.disconnect() }, { once: true })
  }
  setMix(volume: number, enabled: boolean) {
    if (this.disposed) return
    const gain = enabled ? Math.max(0, Math.min(100, volume)) / 100 * .7 : 0
    this.master.gain.setTargetAtTime(gain, this.context.currentTime, .035)
  }
  async start() {
    if (this.disposed) return
    await this.context.resume()
    this.active = true
    this.nextBreath = this.nextBeat = this.nextPing = this.context.currentTime
    this.traveled = 0
    this.nextEntityStep.fill(this.context.currentTime)
    this.nextAtmosphere=this.context.currentTime+8+Math.random()*8;this.nextRasp=0
    this.stopCrying()
    this.loops.gain.setTargetAtTime(1, this.context.currentTime, .25)
  }
  setActive(active: boolean) {
    if (this.disposed) return
    this.active = active
    if(!active)this.stopCrying()
    this.loops.gain.setTargetAtTime(active ? 1 : 0, this.context.currentTime, .08)
  }
  private tone(frequency: number, duration: number, gain: number, delay = 0, pan = 0, endFrequency = frequency) {
    if (this.disposed) return
    const ctx = this.context, at = ctx.currentTime + delay
    const osc = ctx.createOscillator(), envelope = ctx.createGain(), stereo = ctx.createStereoPanner()
    osc.frequency.setValueAtTime(frequency, at); osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFrequency), at + duration)
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(gain, at + .008)
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration)
    stereo.pan.value = Math.max(-1, Math.min(1, pan))
    osc.connect(envelope).connect(stereo).connect(this.master); this.track(osc)
    osc.onended = () => { envelope.disconnect(); stereo.disconnect() }
    osc.start(at); osc.stop(at + duration + .02)
  }
  private noise(duration: number, frequency: number, gain: number, delay = 0, pan = 0, breath = false, destination:AudioNode=this.master) {
    if (this.disposed) return
    const ctx = this.context, at = ctx.currentTime + delay
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain(), stereo = ctx.createStereoPanner()
    source.buffer = this.noiseBuffer; source.loop = true
    filter.type = breath ? 'bandpass' : 'lowpass'; filter.frequency.value = frequency; filter.Q.value = breath ? .7 : .5
    const attack = breath ? duration * .3 : .008
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(gain, at + attack)
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration)
    stereo.pan.value = Math.max(-1, Math.min(1, pan))
    source.connect(filter).connect(envelope).connect(stereo).connect(destination); this.track(source)
    source.onended = () => { filter.disconnect(); envelope.disconnect(); stereo.disconnect() }
    source.start(at, Math.random()); source.stop(at + duration + .02)
  }
  stopCrying() {
    if(this.disposed)return
    this.cryBus.gain.setTargetAtTime(0,this.context.currentTime,.02)
  }
  /** A synthetic, formant-filtered sob; no recording of a real child is used. */
  childCry(distance:number, pan:number, occluded:boolean) {
    if(this.disposed||!this.active||this.profile!=='daycare'||this.context.state!=='running')return
    const proximity=Math.max(0,1-distance/32)
    if(!proximity)return
    const ctx=this.context
    this.cryBus.gain.setTargetAtTime(1,ctx.currentTime,.025)
    for(let sob=0;sob<2;sob++){
      const at=ctx.currentTime+sob*1.1,pitch=510+Math.random()*95
      const voice=ctx.createOscillator(),vibrato=ctx.createOscillator(),vibratoGain=ctx.createGain()
      const throat=ctx.createBiquadFilter(),mouth=ctx.createBiquadFilter(),envelope=ctx.createGain(),stereo=ctx.createStereoPanner()
      voice.type='sawtooth';voice.frequency.setValueAtTime(pitch*.82,at);voice.frequency.exponentialRampToValueAtTime(pitch*1.18,at+.2);voice.frequency.exponentialRampToValueAtTime(pitch*.74,at+.95)
      vibrato.frequency.value=5.5+Math.random();vibratoGain.gain.value=15;vibrato.connect(vibratoGain).connect(voice.frequency)
      throat.type=mouth.type='bandpass';throat.frequency.value=950;throat.Q.value=3;mouth.frequency.value=2300;mouth.Q.value=4
      const gain=.075*proximity*(occluded?.35:1)
      envelope.gain.setValueAtTime(0,at);envelope.gain.linearRampToValueAtTime(gain,at+.13);envelope.gain.exponentialRampToValueAtTime(.0001,at+1)
      stereo.pan.value=Math.max(-1,Math.min(1,pan))
      voice.connect(throat).connect(envelope);voice.connect(mouth).connect(envelope);envelope.connect(stereo).connect(this.cryBus)
      this.track(voice);this.track(vibrato)
      voice.onended=()=>{vibratoGain.disconnect();throat.disconnect();mouth.disconnect();envelope.disconnect();stereo.disconnect()}
      voice.start(at);vibrato.start(at);voice.stop(at+1.03);vibrato.stop(at+1.03)
      this.noise(.24,1400,gain*.55,sob*1.1+.82,pan,true,this.cryBus)
    }
  }
  update(frame: AudioFrame) {
    if (!this.active || this.disposed || this.context.state !== 'running') return
    const now = this.context.currentTime
    const nearest=[...frame.entities].sort((a,b)=>a.distance-b.distance)[0]
    const mix = audioDynamics(frame.stamina, frame.sprinting, nearest?.distance??null, nearest?.chasing??false)
    if (frame.blackout !== this.powerOff) { this.powerOff = frame.blackout; this.cue(frame.blackout ? 'blackout' : 'restore') }
    this.ambience.gain.setTargetAtTime(frame.blackout ? .004 : .055, now, .12)
    const normalization=1/Math.sqrt(Math.max(1,frame.entities.length))
    this.growls.forEach((voice,id)=>{
      const entity=frame.entities.find(e=>e.id===id)
      const proximity=entity?Math.max(0,1-entity.distance/24):0
      voice.gain.gain.setTargetAtTime(entity ? proximity*(entity.chasing ? .065 : .025)*(entity.occluded ? .25 : 1)*normalization*(entity.stalker?1.2:1) : 0,now,.12)
      if(entity)voice.pan.pan.setTargetAtTime(entity.pan,now,.1)
    })
    this.traveled += frame.moved
    if (this.traveled >= (frame.sprinting ? 1.35 : 1.25)) {
      this.traveled = 0; this.foot *= -1
      this.tone(80 + Math.random() * 15, .13, frame.sprinting ? .19 : .12, 0, this.foot * .12, 35)
      this.noise(.17, this.profile==='lab'?1700:560, frame.sprinting ? .2 : .12, .015, this.foot * .12)
      this.noise(.11, 2300, .035, .02, this.foot * .12)
      if(this.profile==='lab')this.tone(240,.13,.025,.02,this.foot*.12,140)
      if(this.profile==='daycare')this.tone(180,.1,.03,.015,this.foot*.12,95)
    }
    if (now >= this.nextBreath) {
      const inhale = .7 - mix.stress * .4, exhale = .95 - mix.stress * .5
      this.noise(inhale, 1050, mix.breathGain, 0, -.035, true)
      this.noise(exhale, 650, mix.breathGain * 1.2, inhale + .12, .035, true)
      this.nextBreath = now + mix.breathPeriod
    }
    if (mix.stress > .3 && now >= this.nextBeat) {
      const gain = .025 + mix.stress * .07
      this.tone(58, .13, gain, 0, 0, 35); this.tone(49, .12, gain * .65, .14, 0, 32)
      this.nextBeat = now + mix.heartbeatPeriod
    }
    for(const entity of frame.entities){
      const proximity=Math.max(0,1-entity.distance/24)
      if(entity.moved>.001&&proximity>0&&now>=this.nextEntityStep[entity.id]){
        const gain=proximity*.23*(entity.occluded ? .25 : 1)*normalization
        this.tone(49+entity.id*5,.25,gain,0,entity.pan,24);this.noise(.28,380,gain,0,entity.pan)
        this.nextEntityStep[entity.id]=now+(entity.stalker&&entity.chasing?.3:entity.chasing?.48:.8)+entity.id*.025
      }
      if(entity.stalker&&entity.distance<18&&now>=this.nextRasp){
        this.noise(.85,880,.09*proximity*(entity.occluded?.25:1),0,entity.pan,true)
        this.nextRasp=now+2.4+Math.random()*1.5
      }
    }
    if(now>=this.nextAtmosphere){
      const pan=Math.random()>.5?.85:-.85
      switch(ambientSound(this.profile)){
        case 'wall-whisper':this.noise(1.7,1300,.04,0,pan,true);this.noise(.7,800,.02,1,-pan,true);break
        case 'ceiling-knock':[0,.32,.9].forEach(delay=>{this.tone(85,.3,.05,delay,pan,42);this.noise(.12,430,.045,delay,pan)});break
        case 'carpet-drag':this.noise(2,360,.07,0,pan);this.noise(.5,800,.025,1.6,-pan);break
        case 'pressure-vent':this.noise(2.2,2600,.065,0,pan,true);this.tone(145,.7,.035,.5,-pan,65);break
        case 'containment-thump':[0,.55].forEach(delay=>{this.tone(55,.5,.085,delay,pan,28);this.noise(.18,1800,.04,delay,pan)});break
        case 'failed-alarm':[0,.45,.9].forEach(delay=>this.tone(630,.3,.035,delay,pan,440));this.noise(.6,2100,.025,1.2,pan);break
        case 'broken-music-box':[523,622,493,392].forEach((frequency,i)=>this.tone(frequency+(i%2?7:-4),1.2,.035,i*.65,pan));break
        case 'toy-creak':this.tone(380,.8,.04,0,pan,650);this.noise(.9,850,.035,.2,pan,true);break
        case 'nursery-hush':this.noise(1.5,2400,.035,0,pan,true);this.tone(263,1.4,.018,.3,-pan,258);break
      }
      this.nextAtmosphere=now+10+Math.random()*13
    }
    if (frame.scanning && nearest && nearest.distance <= 20 && now >= this.nextPing) {
      this.tone(680 + mix.proximity * 480, .09, .035)
      this.nextPing = now + 1.8 - mix.proximity * 1.2
    }
  }
  cue(cue: SoundCue, variation = 0) {
    if (this.disposed) return
    switch (cue) {
      case 'flashlight': this.noise(.045, 3300, .09); this.tone(130, .05, .04); break
      case 'scanner': this.tone(980, .08, .05); this.tone(1250, .07, .035, .1); break
      case 'pickup':
        [440, 554, 659].forEach((f,i)=>this.tone(f * (1 + variation * .12), .3, .075, i * .09)); break
      case 'release': this.tone(180, .8, .13, 0, 0, 52); this.noise(.65, 650, .12); break
      case 'escalate':
        [0,.2,.4].forEach(delay=>this.tone(240, .18, .11, delay, 0, 100)); break
      case 'scare': this.noise(.65, 1700, .3); this.tone(160, .5, .12, 0, 0, 35); break
      case 'caught': this.noise(1.1, 2400, .52); this.tone(100, 1, .2, 0, 0, 22); break
      case 'blackout': this.noise(.15, 1400, .13); this.tone(180, .3, .06, 0, 0, 25); break
      case 'restore': this.noise(.12, 2100, .07); this.tone(55, .4, .05, 0, 0, 120); break
      case 'escape':
        this.noise(.7, 650, .18); this.tone(95, .65, .12, 0, 0, 40)
        ;[392,494,587,784].forEach((f,i)=>this.tone(f, .7, .065, .35+i*.16)); break
    }
  }
  dispose() {
    if (this.disposed) return
    this.disposed = true; this.active = false
    for (const source of this.sources) { try { source.stop() } catch {} source.disconnect() }
    this.sources.clear()
    this.master.disconnect(); this.loops.disconnect(); this.ambience.disconnect();this.cryBus.disconnect(); this.growls.forEach(v=>{v.gain.disconnect();v.pan.disconnect()})
    if (this.context.state !== 'closed') void this.context.close().catch(()=>{})
  }
}
