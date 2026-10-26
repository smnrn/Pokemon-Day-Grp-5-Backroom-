export const MONSTERS = ['025','094','934','823'] as const
export type Monster = typeof MONSTERS[number]
export type Source = 'demo'|'simulation'|'manual'|'import'|'database'|'game'
export type EventKind = 'sample'|'chase'|'jumpscare'|'death'|'escape'|'hide_locker'|'corridor'|'turn_left'
export type Telemetry = {
  id:string;session_id:string;timestamp:string;player_x:number;player_y:number
  heart_rate_proxy:number;active_monster:Monster;battery_level:number;stamina:number
  elapsed:number;sprint_ratio:number;crouch_ratio:number;first_clue:number
  chase_duration:number;reaction_ms:number;event:EventKind;source:Source
}
const KINDS:EventKind[]=['sample','chase','jumpscare','death','escape','hide_locker','corridor','turn_left']
const SOURCES:Source[]=['demo','simulation','manual','import','database','game']
export function normalizeTelemetry(input:unknown, index=0, forcedSource?:Source):Telemetry {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error(`Row ${index+1}: expected a telemetry object.`)
  const r=input as Record<string,unknown>
  const number=(key:string,min:number,max:number,fallback?:number)=>{
    const raw=r[key]??fallback
    if(raw===undefined||raw===null||raw==='')throw new Error(`Row ${index+1}: ${key} is required.`)
    const n=typeof raw==='number'?raw:typeof raw==='string'&&/^-?\d+(\.\d+)?$/.test(raw.trim())?Number(raw):NaN
    if(!Number.isFinite(n)||n<min||n>max)throw new Error(`Row ${index+1}: ${key} must be ${min}–${max}.`)
    return n
  }
  if(typeof r.session_id!=='string'||!/^[\w-]{1,80}$/.test(r.session_id))throw new Error(`Row ${index+1}: invalid session_id.`)
  const stamp=typeof r.timestamp==='string'?Date.parse(r.timestamp):NaN
  if(!Number.isFinite(stamp))throw new Error(`Row ${index+1}: timestamp must be an ISO date.`)
  const monster=String(r.active_monster??'').replace(/^#/,'') as Monster
  if(!MONSTERS.includes(monster))throw new Error(`Row ${index+1}: active_monster must be 025, 094, 934, or 823.`)
  const event=(r.event??'sample') as EventKind
  const source=forcedSource??(r.source??'import') as Source
  if(!KINDS.includes(event)||!SOURCES.includes(source))throw new Error(`Row ${index+1}: invalid event or source.`)
  const id=typeof r.id==='string'&&/^[\w:.-]{1,180}$/.test(r.id)?r.id:`${r.session_id}-${stamp}-${event}-${index}`
  return {
    id,session_id:r.session_id,timestamp:new Date(stamp).toISOString(),active_monster:monster,event,source,
    player_x:number('player_x',-36,36),player_y:number('player_y',-46,18),
    heart_rate_proxy:number('heart_rate_proxy',40,220),battery_level:number('battery_level',0,100),
    stamina:number('stamina',0,100,60),elapsed:number('elapsed',0,3600,0),
    sprint_ratio:number('sprint_ratio',0,1,.4),crouch_ratio:number('crouch_ratio',0,1,.3),
    first_clue:number('first_clue',0,3600,45),chase_duration:number('chase_duration',0,3600,0),
    reaction_ms:number('reaction_ms',0,10000,450),
  }
}
export function normalizeBatch(input:unknown, forcedSource?:Source):Telemetry[] {
  const rows=Array.isArray(input)?input:input&&typeof input==='object'?(input as {events?:unknown}).events:undefined
  if(!Array.isArray(rows)||!rows.length||rows.length>5000)throw new Error('Provide 1–5,000 telemetry rows, as an array or { "events": [...] }.')
  return rows.map((r,i)=>normalizeTelemetry(r,i,forcedSource))
}
