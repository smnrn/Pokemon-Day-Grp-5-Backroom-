import { useEffect, useRef, useState, type RefObject } from 'react'
import { radarContacts, RADAR_RANGE, revealExploration, type Collider, type Point } from './explorationLogic'

export type NavigationFrame = {
  player: Point; yaw: number; entities: (Point & { stalker?: boolean })[]; walls: Collider[]
  pokemon: (Point & { collected: boolean; name: string; color: string })[]; panel: Point; exit: Point
  powered: boolean; battery: number; disabled: boolean; run: number
}
export default function NavigationHUD({ live, scanning, sector }: { live: RefObject<NavigationFrame | null>; scanning: boolean; sector: string }) {
  const mini = useRef<HTMLCanvasElement>(null), radar = useRef<HTMLCanvasElement>(null), full = useRef<HTMLCanvasElement>(null)
  const readout = useRef<HTMLSpanElement>(null), position = useRef<HTMLSpanElement>(null)
  const scannerStatus = useRef<HTMLSpanElement>(null)
  const scanningRef = useRef(scanning); scanningRef.current = scanning
  const [expanded, setExpanded] = useState(false)
  const expandedRef = useRef(expanded); expandedRef.current = expanded
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && !e.repeat && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); setExpanded(v=>!v) }
    }
    window.addEventListener('keydown',key)
    return ()=>window.removeEventListener('keydown',key)
  },[])
  useEffect(() => {
    let frame=0,last=0,run=-1,lastReveal:Point={x:Infinity,z:Infinity}
    const discovered=new Set<string>(),trail:Point[]=[]
    const styles=getComputedStyle(document.documentElement)
    const green=styles.getPropertyValue('--crt-green').trim()||'#28e070'
    const yellow=styles.getPropertyValue('--sickly-yellow').trim()||'#d5c77a'
    const red=styles.getPropertyValue('--emergency-red').trim()||'#b81d13'
    function prepare(canvas:HTMLCanvasElement|null) {
      if(!canvas)return null
      const {width:w,height:h}=canvas.getBoundingClientRect()
      if(!w||!h)return null
      const dpr=Math.min(window.devicePixelRatio,2)
      if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
      const ctx=canvas.getContext('2d')
      if(!ctx)return null
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h)
      return {ctx,w,h}
    }
    function drawMap(canvas:HTMLCanvasElement|null,data:NavigationFrame,large:boolean) {
      const prepared=prepare(canvas);if(!prepared)return
      const {ctx,w,h}=prepared
      ctx.fillStyle='#080e0b';ctx.fillRect(0,0,w,h)
      const bounds={minX:Math.min(...data.walls.map(c=>c.x-c.w/2))-1,maxX:Math.max(...data.walls.map(c=>c.x+c.w/2))+1,minZ:Math.min(...data.walls.map(c=>c.z-c.d/2))-1,maxZ:Math.max(...data.walls.map(c=>c.z+c.d/2))+1}
      const scale=large?Math.min((w-34)/(bounds.maxX-bounds.minX),(h-28)/(bounds.maxZ-bounds.minZ)):h/30
      const center=large?{x:(bounds.minX+bounds.maxX)/2,z:(bounds.minZ+bounds.maxZ)/2}:data.player
      const project=(p:Point)=>({x:w/2+(p.x-center.x)*scale,y:h/2+(p.z-center.z)*scale})
      ctx.save();ctx.beginPath()
      for(const cell of discovered){const [x,z]=cell.split(',').map(Number),p=project({x,z});ctx.rect(p.x,p.y,scale+.5,scale+.5)}
      ctx.clip()
      ctx.fillStyle='#18251a';ctx.fillRect(0,0,w,h)
      ctx.strokeStyle='#28e0700e';ctx.lineWidth=.5
      for(let x=Math.floor(bounds.minX);x<=bounds.maxX;x+=4){const a=project({x,z:bounds.minZ}),b=project({x,z:bounds.maxZ});ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
      for(let z=Math.floor(bounds.minZ);z<=bounds.maxZ;z+=4){const a=project({x:bounds.minX,z}),b=project({x:bounds.maxX,z});ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
      ctx.fillStyle='#838763'
      for(const wall of data.walls){const p=project({x:wall.x-wall.w/2,z:wall.z-wall.d/2});ctx.fillRect(p.x,p.y,Math.max(1,wall.w*scale),Math.max(1,wall.d*scale))}
      ctx.strokeStyle='#28e07066';ctx.lineWidth=1;ctx.beginPath()
      trail.forEach((p,i)=>{const a=project(p);if(i)ctx.lineTo(a.x,a.y);else ctx.moveTo(a.x,a.y)});ctx.stroke()
      ctx.restore()
      const known=(p:Point)=>discovered.has(`${Math.floor(p.x)},${Math.floor(p.z)}`)
      const marker=(point:Point,color:string,label:string,shape:'pokemon'|'panel'|'exit')=>{
        if(!known(point))return
        const p=project(point);ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=1.5
        if(shape==='pokemon'){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);ctx.fillRect(-3,-3,6,6);ctx.restore()}
        else if(shape==='panel')ctx.strokeRect(p.x-4,p.y-4,8,8)
        else{ctx.fillRect(p.x-5,p.y-3,10,6)}
        if(large){ctx.font='9px monospace';ctx.fillText(label,p.x+8,p.y+3)}
      }
      data.pokemon.forEach(f=>{if(!f.collected)marker(f,f.color,f.name.toUpperCase(),'pokemon')})
      marker(data.panel,data.powered?green:yellow,data.powered?'EXIT ENABLED':'EXIT CONTROL','panel')
      marker(data.exit,data.powered?green:'#8c7165',data.powered?'EXIT OPEN':'EXIT LOCKED','exit')
      if(scanningRef.current&&!data.disabled&&data.battery>0)for(const contact of radarContacts(data.player,data.yaw,data.entities)){
        if(known(contact.entity)){
          const p=project(contact.entity);ctx.fillStyle=red;ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,Math.PI*2);ctx.fill()
          if(contact.entity.stalker){ctx.strokeStyle=yellow;ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);ctx.stroke();if(large){ctx.fillStyle=yellow;ctx.font='8px monospace';ctx.fillText('STALKER',p.x+9,p.y+3)}}
        }
      }
      const p=project(data.player)
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-data.yaw);ctx.fillStyle=green;ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,5);ctx.lineTo(0,2);ctx.lineTo(-4,5);ctx.closePath();ctx.fill();ctx.restore()
      ctx.fillStyle='#9ca68a';ctx.font='8px monospace';ctx.fillText('N ↑',8,13)
      ctx.strokeStyle='#9ca68a';ctx.beginPath();ctx.moveTo(9,h-12);ctx.lineTo(9+5*scale,h-12);ctx.stroke();ctx.fillText('5 M',10,h-17)
    }
    const draw=(now:number)=>{
      frame=requestAnimationFrame(draw)
      if(now-last<80)return;last=now
      const data=live.current;if(!data)return
      if(data.run!==run){run=data.run;discovered.clear();trail.length=0;lastReveal={x:Infinity,z:Infinity}}
      if(!data.disabled&&Math.hypot(data.player.x-lastReveal.x,data.player.z-lastReveal.z)>.35){
        revealExploration(data.player,data.walls,discovered)
        lastReveal={...data.player}
        if(!trail.length||Math.hypot(data.player.x-trail[trail.length-1].x,data.player.z-trail[trail.length-1].z)>.7){trail.push({...data.player});if(trail.length>2000)trail.shift()}
      }
      drawMap(mini.current,data,false)
      if(expandedRef.current)drawMap(full.current,data,true)
      if(position.current)position.current.textContent=`X ${data.player.x.toFixed(1)} / Z ${data.player.z.toFixed(1)}`
      const contacts=radarContacts(data.player,data.yaw,data.entities),contact=contacts[0]
      const enabled=scanningRef.current&&!data.disabled&&data.battery>0
      if(scannerStatus.current)scannerStatus.current.textContent=data.battery<=0?'EMPTY':data.disabled?'LOST':scanningRef.current?'LIVE':'OFF'
      if(readout.current)readout.current.textContent=data.battery<=0?'BATTERY EMPTY · OFFLINE':data.disabled?'SIGNAL INTERRUPTED':!scanningRef.current?'STANDBY · R TO SCAN':!data.entities.length?'NO ENTITY SIGNAL':!contact?`NO CONTACT · >${RADAR_RANGE} M`:`${contacts.length} CONTACT${contacts.length===1?'':'S'} · ${contact.distance.toFixed(1)} M`
      const prepared=prepare(radar.current);if(!prepared)return
      const {ctx,w,h}=prepared,cx=w/2,cy=h/2,r=Math.min(w,h)/2-12
      ctx.strokeStyle='#28e07040';ctx.lineWidth=1
      for(const fraction of [.25,.5,.75,1]){ctx.beginPath();ctx.arc(cx,cy,r*fraction,0,Math.PI*2);ctx.stroke()}
      ctx.beginPath();ctx.moveTo(cx-r,cy);ctx.lineTo(cx+r,cy);ctx.moveTo(cx,cy-r);ctx.lineTo(cx,cy+r);ctx.stroke()
      if(enabled){
        const angle=(now/1600)%(Math.PI*2)
        ctx.fillStyle='#28e07010';ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,angle-.6,angle);ctx.closePath();ctx.fill()
        ctx.strokeStyle='#28e07077';ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(angle)*r,cy+Math.sin(angle)*r);ctx.stroke()
        for(const detected of contacts){
          ctx.fillStyle=red;ctx.shadowColor=red;ctx.shadowBlur=7;ctx.beginPath();ctx.arc(cx+detected.x*r,cy+detected.y*r,3.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0
          if(detected.entity.stalker){ctx.strokeStyle=yellow;ctx.beginPath();ctx.arc(cx+detected.x*r,cy+detected.y*r,6,0,Math.PI*2);ctx.stroke()}
        }
        ctx.fillStyle=green;for(let i=0;i<12;i++)if(contact&&i/12<contact.strength)ctx.fillRect(8+i*5,h-5,3,3)
      }
      ctx.fillStyle=green;ctx.beginPath();ctx.moveTo(cx,cy-4);ctx.lineTo(cx+3,cy+3);ctx.lineTo(cx-3,cy+3);ctx.closePath();ctx.fill()
      ctx.font='7px monospace';ctx.fillStyle='#a1ac8a';ctx.fillText('FWD',cx-9,8);ctx.fillText(`${RADAR_RANGE} M`,w-28,h-3)
    }
    frame=requestAnimationFrame(draw)
    return ()=>cancelAnimationFrame(frame)
  },[live])
  return <aside className={`navigation-hud ${expanded?'navigation-expanded':''}`} aria-label="Live exploration map and entity radar">
    <div className="navigation-panels"><section className="navigation-map"><div className="panel-heading"><span>SECTOR MAP</span><button onClick={()=>setExpanded(v=>!v)} aria-label="Expand exploration map">M ↗</button></div><canvas ref={mini} aria-label="North-up map showing discovered rooms and your current heading"/><span className="nav-coordinates" ref={position}/></section>
    <section className="navigation-radar"><div className="panel-heading"><span>BIO-RADAR</span><span className="green" ref={scannerStatus}>{scanning?'LIVE':'OFF'}</span></div><canvas ref={radar} aria-label="Heading-relative radar displaying nearby entities when battery power is available"/><span className="nav-contact" ref={readout}/></section></div>
    <div className="nav-legend"><span>▲ YOU</span><span>◆ POKÉMON</span><span>□ EXIT CONTROL</span><span>● ENTITY</span></div>
    {expanded&&<div className="expanded-map-overlay"><section role="dialog" aria-label="Explored sector map" aria-modal="false"><div className="panel-heading"><span>SECTOR {sector} / WIDE NAVIGATION MAP</span><button onClick={()=>setExpanded(false)} aria-label="Close exploration map">CLOSE [ M ] ×</button></div><canvas ref={full} aria-label="Wide north-up map showing explored rooms and this run's randomized Pokémon locations"/><div className="nav-legend"><span>▲ YOU</span><span>◆ UNRESCUED POKÉMON</span><span>□ EXIT CONTROL</span><span>▬ EXIT</span></div><p>Yellow-ring contact: STALKER, 4.35 m/s · After 3 rescues: 2 hunters and 1 faster stalker · M closes map</p></section></div>}
  </aside>
}
