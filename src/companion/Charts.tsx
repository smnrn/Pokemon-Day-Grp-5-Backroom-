import { useState } from 'react'
import { createMazeWalls } from '../explorationLogic'
import type { Telemetry } from './analytics'

export type ChartPoint={x:number;y:number;label?:string;color?:string;size?:number}
export function Scatter({points,centers=[],current,xLabel,yLabel,onSelect}:{points:ChartPoint[];centers?:ChartPoint[];current?:ChartPoint;xLabel:string;yLabel:string;onSelect?:(point:ChartPoint)=>void}) {
  const [hover,setHover]=useState('')
  const x=(v:number)=>43+v/100*495,y=(v:number)=>215-v/100*180
  return <div className="c-chart"><svg viewBox="0 0 580 255" role="img" aria-label={`${yLabel} versus ${xLabel}`}>
    {[0,25,50,75,100].map(n=><g key={n}><path d={`M43 ${y(n)}H538M${x(n)} 35V215`} className="c-gridline"/><text x="31" y={y(n)+3} textAnchor="end">{n}</text><text x={x(n)} y="231" textAnchor="middle">{n}</text></g>)}
    {centers.map((p,i)=><g key={i}><ellipse cx={x(p.x)} cy={y(p.y)} rx="64" ry="45" fill={p.color} fillOpacity=".045" stroke={p.color} strokeOpacity=".2" strokeDasharray="3 5"/><path d={`M${x(p.x)-6} ${y(p.y)}h12M${x(p.x)} ${y(p.y)-6}v12`} stroke={p.color} strokeWidth="1.5"/></g>)}
    {points.map((p,i)=><circle key={i} cx={x(p.x)} cy={y(p.y)} r={p.size??3.1} fill={p.color??'var(--c-green)'} opacity=".65" tabIndex={0} role="button" aria-label={p.label??`Point ${i+1}`} onMouseEnter={()=>setHover(p.label??'')} onFocus={()=>setHover(p.label??'')} onClick={()=>onSelect?.(p)} onKeyDown={e=>{if(e.key==='Enter')onSelect?.(p)}}><title>{p.label}</title></circle>)}
    {current&&<g><path d={`M${x(current.x)} 35V215M43 ${y(current.y)}H538`} stroke="var(--c-white)" strokeOpacity=".3" strokeDasharray="3 5"/><circle cx={x(current.x)} cy={y(current.y)} r="12" fill="none" stroke="var(--c-white)" opacity=".4"/><circle cx={x(current.x)} cy={y(current.y)} r="4.5" fill="var(--c-white)" className="c-current-dot"/><text x={Math.min(412,x(current.x)+12)} y={Math.max(22,y(current.y)-13)} className="c-current-label">CURRENT ENCOUNTER</text></g>}
    <text x="290" y="251" textAnchor="middle" className="c-axis-label">{xLabel}</text><text transform="translate(10 128) rotate(-90)" textAnchor="middle" className="c-axis-label">{yLabel}</text>
  </svg><div className="c-chart-readout">{hover||'HOVER A SIGNAL TO INSPECT'}<span>+ CENTROID</span></div></div>
}
export type LineSeries={name:string;color:string;points:ChartPoint[];dashed?:boolean;area?:boolean}
export function LinePlot({series,maxX=240,label='ELAPSED TIME (SECONDS)',current}:{series:LineSeries[];maxX?:number;label?:string;current?:number}) {
  const x=(v:number)=>37+Math.min(maxX,v)/Math.max(1,maxX)*493,y=(v:number)=>193-Math.max(0,Math.min(100,v))/100*160
  const path=(points:ChartPoint[])=>points.map((p,i)=>`${i?'L':'M'}${x(p.x)},${y(p.y)}`).join(' ')
  return <div className="c-chart"><svg viewBox="0 0 560 233" role="img" aria-label={series.map(s=>s.name).join(' and ')}>
    {[0,25,50,75,100].map(n=><g key={n}><path d={`M37 ${y(n)}H530`} className="c-gridline"/><text x="28" y={y(n)+3} textAnchor="end">{n}%</text></g>)}
    {[0,.25,.5,.75,1].map(n=><text key={n} x={x(n*maxX)} y="210" textAnchor="middle">{Math.round(n*maxX)}</text>)}
    {series.map(s=><g key={s.name}>{s.area&&s.points.length>1&&<path d={`${path(s.points)}L${x(s.points[s.points.length-1].x)},193L${x(s.points[0].x)},193Z`} fill={s.color} fillOpacity=".08"/>}<path d={path(s.points)} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed?'5 5':undefined}/>{!s.dashed&&s.points.map((p,i)=><circle key={i} cx={x(p.x)} cy={y(p.y)} r="2.5" fill={s.color}><title>{`${s.name}: ${p.x.toFixed(0)}s / ${p.y.toFixed(1)}%`}</title></circle>)}</g>)}
    {current!==undefined&&<path d={`M${x(current)} 27V193`} stroke="var(--c-white)" strokeOpacity=".4" strokeDasharray="2 4"/>}
    <text x="280" y="231" textAnchor="middle" className="c-axis-label">{label}</text>
  </svg><div className="c-line-legend">{series.map(s=><span key={s.name}><i style={{background:s.color}}/>{s.name}</span>)}</div></div>
}
const walls=createMazeWalls(4981024)
export function Heatmap({events,filter}:{events:Telemetry[];filter:string}) {
  const [selected,setSelected]=useState<Telemetry|null>(null)
  const rows=events.filter(e=>filter==='All telemetry'||(filter==='Eliminations'?e.event==='death':e.event==='jumpscare'))
  const x=(v:number)=>20+(v+36)*3.3,y=(v:number)=>20+(v+46)*3.3
  return <div className="c-heat-layout"><svg viewBox="0 0 280 252" role="img" aria-label="Sector 04 schematic with event density">
    <defs><radialGradient id="heat-red"><stop stopColor="var(--c-red)" stopOpacity=".8"/><stop offset="1" stopColor="var(--c-red)" stopOpacity="0"/></radialGradient><radialGradient id="heat-yellow"><stop stopColor="var(--c-yellow)" stopOpacity=".6"/><stop offset="1" stopColor="var(--c-yellow)" stopOpacity="0"/></radialGradient></defs>
    <rect x="20" y="20" width="238" height="212" fill="var(--c-inset)" stroke="var(--c-border)"/>
    {walls.map((w,i)=><rect key={i} x={x(w.x-w.w/2)} y={y(w.z-w.d/2)} width={Math.max(1,w.w*3.3)} height={Math.max(1,w.d*3.3)} fill="var(--c-map-wall)"/>)}
    {rows.slice(-300).map(e=><g key={e.id} onClick={()=>setSelected(e)} role="button" tabIndex={0} aria-label={`${e.event} at ${e.player_x.toFixed(1)}, ${e.player_y.toFixed(1)}`} onKeyDown={key=>{if(key.key==='Enter')setSelected(e)}}><circle cx={x(e.player_x)} cy={y(e.player_y)} r={e.event==='death'?17:11} fill={`url(#heat-${e.event==='death'?'red':'yellow'})`}/><circle cx={x(e.player_x)} cy={y(e.player_y)} r="1.6" fill={e.event==='death'?'var(--c-red)':'var(--c-yellow)'}><title>{`${e.session_id} · ${e.event} · ${e.source}`}</title></circle></g>)}
    <circle cx={x(0)} cy={y(14)} r="3" fill="var(--c-green)"/><text x={x(0)+6} y={y(14)+3}>SPAWN</text><circle cx={x(32)} cy={y(-45)} r="3" fill="var(--c-green)"/><text x={x(32)-5} y="12" textAnchor="end">EXIT</text>
  </svg><div className="c-heat-notes"><span className="c-small-label">DENSITY INDEX</span><div className="c-heat-scale"/><div className="c-scale-labels"><span>LOW</span><span>CRITICAL</span></div><strong>{rows.length}</strong><small>matching events</small><div className="c-hot-zone"><span>INSPECTED EVENT</span><b>{selected?selected.event.toUpperCase():'SELECT A HOTSPOT'}</b><p>{selected?`${selected.session_id} / #${selected.active_monster}`:'Select an event on the floorplan to inspect its source.'}</p>{selected&&<small>{selected.source.toUpperCase()} · ({selected.player_x.toFixed(1)}, {selected.player_y.toFixed(1)})</small>}</div><p className="c-method">Sector 04 reference layout. Imported coordinates must use this world coordinate system.</p></div></div>
}
export function RadarChart({values,colors,labels}:{values:number[][];colors:string[];labels:string[]}) {
  const angles=[-Math.PI/2,Math.PI/6,Math.PI*5/6],p=(v:number,i:number)=>[115+Math.cos(angles[i])*v*.7,108+Math.sin(angles[i])*v*.7]
  return <svg className="c-radar-chart" viewBox="0 0 230 210" role="img" aria-label="Normalized specimen comparison">
    {[25,50,75,100].map(v=><polygon key={v} points={angles.map((_,i)=>p(v,i).join(',')).join(' ')} fill="none" stroke="var(--c-border)"/>)}
    {labels.map((label,i)=><g key={label}><path d={`M115 108L${p(100,i).join(' ')}`} stroke="var(--c-border)"/><text x={p(125,i)[0]} y={p(125,i)[1]+3} textAnchor="middle">{label}</text></g>)}
    {values.map((row,i)=><polygon key={i} points={row.map((v,j)=>p(v,j).join(',')).join(' ')} fill={colors[i]} fillOpacity=".05" stroke={colors[i]} strokeWidth="1.4"/>)}
  </svg>
}
export function Bars({rows,metric}:{rows:{name:string;color:string;values:number[]}[];metric:number}) {
  const max=metric===0?100:metric===1?90:1500
  return <div className="c-bars">{rows.map(row=><div className="c-bar-row" key={row.name}><span>{row.name}</span><div><i style={{width:`${Math.min(100,row.values[metric]/max*100)}%`,background:row.color}}/><b>{row.values[metric].toFixed(metric===0?1:0)}{metric===0?'%':metric===1?'s':'ms'}</b></div></div>)}<div className="c-bar-axis">0 <span>{max}{metric===0?'%':metric===1?' SECONDS':' MILLISECONDS'}</span></div></div>
}
