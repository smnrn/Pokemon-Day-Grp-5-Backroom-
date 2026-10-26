import * as THREE from 'three'

// Small, locally built collectible figures: no external models or image requests.
export function createPokemon(name: string, color: string) {
  const group=new THREE.Group()
  const skin=new THREE.MeshStandardMaterial({color,roughness:.7,emissive:color,emissiveIntensity:.1})
  const black=new THREE.MeshStandardMaterial({color:'#10151a'})
  const cream=new THREE.MeshStandardMaterial({color:'#efdfb0'})
  const white=new THREE.MeshBasicMaterial({color:'#ffffff'})
  const geometry=new THREE.SphereGeometry(1,16,12)
  const part=(x:number,y:number,z:number,sx:number,sy:number,sz:number,material:THREE.Material)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);group.add(mesh);return mesh
  }
  part(0,.36,0,.27,.33,.22,skin)
  part(0,.76,.02,.3,.29,.26,skin)
  for(const side of [-1,1]){
    part(side*.2,.08,.1,.13,.09,.19,skin)
    part(side*.29,.4,.03,.1,.18,.1,skin)
    part(side*.12,.8,.25,.044,.066,.028,black)
    part(side*.13,.82,.275,.014,.019,.008,white)
  }
  if(name==='Pikachu'){
    const cheek=new THREE.MeshStandardMaterial({color:'#d34533'})
    for(const side of [-1,1]){
      const ear=part(side*.19,1.12,0,.075,.3,.065,skin);ear.rotation.z=-side*.2
      const tip=part(side*.24,1.34,0,.064,.09,.06,black);tip.rotation.z=-side*.2
      part(side*.24,.68,.21,.062,.06,.035,cheek)
    }
    const shape=new THREE.Shape()
    shape.moveTo(.18,.2);shape.lineTo(.52,.36);shape.lineTo(.4,.58);shape.lineTo(.68,.78);shape.lineTo(.55,.96);shape.lineTo(.27,.67);shape.lineTo(.4,.45);shape.lineTo(.18,.33)
    const tail=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:false}),skin);tail.position.z=-.21;group.add(tail)
  }else if(name==='Charmander'){
    part(0,.35,.19,.19,.25,.06,cream)
    part(0,.67,.24,.2,.11,.1,skin)
    const tail=part(.19,.22,-.35,.13,.15,.38,skin);tail.rotation.y=-.35
    const flame=new THREE.MeshStandardMaterial({color:'#f9c14b',emissive:'#f47818',emissiveIntensity:2})
    part(.31,.42,-.62,.11,.22,.1,flame)
    part(.31,.42,-.6,.055,.12,.06,cream)
  }else{
    const shell=new THREE.MeshStandardMaterial({color:'#965832',roughness:.8})
    part(0,.36,-.17,.31,.33,.16,shell)
    part(0,.36,.18,.23,.26,.07,cream)
    part(.16,.14,-.39,.15,.13,.18,skin)
    part(.22,.22,-.48,.1,.1,.1,skin)
    part(0,.65,.24,.19,.1,.09,skin)
  }
  group.scale.setScalar(.85)
  return group
}
