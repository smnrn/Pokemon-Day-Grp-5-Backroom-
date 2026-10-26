import * as THREE from 'three'
import { biomeObstacles, type BiomeId } from './biomes'
import type { Collider, Point } from './explorationLogic'

export function addBiomeScenery(scene: THREE.Scene, id: BiomeId, rooms: Point[], colliders: Collider[]) {
  const textures:THREE.Texture[]=[]
  const animated:{mesh:THREE.Object3D;baseY:number;phase:number}[]=[]
  const steel=new THREE.MeshStandardMaterial({color:'#34484b',metalness:.65,roughness:.45})
  const cyan=new THREE.MeshStandardMaterial({color:'#73c6b5',emissive:'#1b5b56',emissiveIntensity:.5,roughness:.5})
  const glass=new THREE.MeshStandardMaterial({color:'#6ec6bf',transparent:true,opacity:.15,metalness:.15,roughness:.18,depthWrite:false})
  const cream=new THREE.MeshStandardMaterial({color:'#a79b89',roughness:1})
  const mattress=new THREE.MeshStandardMaterial({color:'#6d6578',roughness:1})
  const blockMaterials=['#aa6579','#6e9c9d','#c7ac73'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.9}))
  function box(x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);scene.add(mesh);return mesh
  }
  biomeObstacles(id,rooms).forEach((p,i)=>{
    colliders.push(p)
    if(p.kind==='tank'){
      for(const y of [.18,2.8]){
        const cap=new THREE.Mesh(new THREE.CylinderGeometry(.85,.85,.2,20),steel);cap.position.set(p.x,y,p.z);scene.add(cap)
        const ring=new THREE.Mesh(new THREE.TorusGeometry(.76,.035,6,24),cyan);ring.rotation.x=Math.PI/2;ring.position.set(p.x,y+.13,p.z);scene.add(ring)
      }
      const tube=new THREE.Mesh(new THREE.CylinderGeometry(.73,.73,2.5,20),glass);tube.position.set(p.x,1.5,p.z);scene.add(tube)
      const specimen=new THREE.Mesh(new THREE.SphereGeometry(.38,12,10),new THREE.MeshStandardMaterial({color:'#263d35',roughness:1}))
      specimen.scale.set(.7,1.8,.8);specimen.position.set(p.x,1.45,p.z);scene.add(specimen)
      animated.push({mesh:specimen,baseY:1.45,phase:i})
    }else if(p.kind==='console'){
      box(p.x,.48,p.z,1.8,.96,1.2,steel)
      box(p.x,1.27,p.z-.25,.85,.55,.15,steel)
      box(p.x,1.27,p.z-.16,.73,.4,.025,cyan)
      for(let j=0;j<4;j++)box(p.x-.45+j*.27,1.01,p.z+.25,.1,.04,.1,j%2?cyan:cream)
    }else if(p.kind==='crib'){
      box(p.x,.4,p.z,2.2,.15,1.4,cream);box(p.x,.53,p.z,1.95,.18,1.18,mattress)
      for(const side of [-1,1]){
        box(p.x,1.25,p.z+side*.65,2.2,.1,.08,cream)
        for(let j=0;j<7;j++)box(p.x-.96+j*.32,.85,p.z+side*.65,.045,.75,.045,cream)
        box(p.x+side*1.05,.7,p.z,.1,1.4,1.4,cream)
      }
    }else{
      for(let j=0;j<3;j++){
        const x=p.x+(j===0?-.3:j===1?.3:0),y=j===2?1.03:.35
        const block=box(x,y,p.z,.62,.62,.62,blockMaterials[(i+j)%3]);block.rotation.y=(j-1)*.17
        if(j===2)animated.push({mesh:block,baseY:y,phase:i})
      }
    }
  })
  if(id==='daycare'){
    rooms.filter((_,i)=>i%9===4).forEach((p,i)=>{
      const mobile=new THREE.Mesh(new THREE.TorusGeometry(.38,.04,6,16),blockMaterials[i%3])
      mobile.position.set(p.x-2.2,2.9,p.z+2.2);scene.add(mobile);animated.push({mesh:mobile,baseY:2.9,phase:i+5})
      box(p.x-2.2,3.25,p.z+2.2,.025,.6,.025,cream)
    })
  }
  // Some palettes are unused in a given biome; dispose their unreferenced materials too.
  return {
    animate(time:number,reduced:boolean){if(!reduced)animated.forEach(p=>{p.mesh.position.y=p.baseY+Math.sin(time*.7+p.phase)*.07;p.mesh.rotation.z=Math.sin(time*.4+p.phase)*.035})},
    dispose(){textures.forEach(t=>t.dispose());[steel,cyan,glass,cream,mattress,...blockMaterials].forEach(m=>m.dispose())},
  }
}
