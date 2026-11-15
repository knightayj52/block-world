// The camera returns the same origin and direction for drawing and picking.
let thirdPerson = true;
try { thirdPerson = localStorage.getItem('moaseom-camera') !== 'first'; } catch {}
let walkPhase = 0, stride = 0;

function togglePerspective(){
  thirdPerson = !thirdPerson;
  try { localStorage.setItem('moaseom-camera', thirdPerson ? 'third' : 'first'); } catch {}
  $('perspective').textContent = thirdPerson ? '시점 · 3인칭' : '시점 · 1인칭';
  target = trace();
}
function playerCamera(){
  const [x,y,z,yaw,tilt] = pos;
  const head = [x,y+1.55,z];
  let origin = head, distance = 0;
  let pitch = tilt;
  if(thirdPerson){
    pitch = Math.max(-1.48,tilt-.25);
    const back = 3.9*Math.cos(pitch), side = .65;
    const offset = [-Math.sin(yaw)*back+Math.cos(yaw)*side, .28-3.9*Math.sin(pitch),
                     Math.cos(yaw)*back+Math.sin(yaw)*side];
    for(let i=1;i<=40;i++){
      const next = head.map((v,j)=>v+offset[j]*i/40);
      if([[-.13,0],[.13,0],[0,-.13],[0,.13]].some(([dx,dz])=>
        [-.13,.13].some(dy=>voxel(Math.floor(next[0]+dx),Math.floor(next[1]+dy),Math.floor(next[2]+dz))))) break;
      origin = next;
    }
    distance = Math.hypot(...origin.map((v,i)=>v-head[i]));
    if(distance<.75){origin=head;distance=0;pitch=tilt}
  }
  const dir = [Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
  return {origin,dir,yaw,pitch,distance};
}
function avatarFaces(){
  const result=[], yaw=pos[3], cos=Math.cos(yaw),sin=Math.sin(yaw);
  // Each cuboid is transformed around a joint to keep the feet and sleeves attached.
  function part(pivot,center,size,color,angle=0){
    const ca=Math.cos(angle),sa=Math.sin(angle);
    function rotate([x,y,z]){
      const ry=y*ca-z*sa,rz=y*sa+z*ca;
      return [x*cos-rz*sin,ry,x*sin+rz*cos];
    }
    const root=[pos[0]+pivot[0]*cos-pivot[2]*sin,pos[1]+pivot[1],pos[2]+pivot[0]*sin+pivot[2]*cos];
    function worldPoint(p){return rotate(p).map((v,i)=>v+root[i])}
    for(const [i,normal] of sides.entries()){
      const axis=normal.findIndex(v=>v!==0), u=(axis+1)%3,v=(axis+2)%3;
      const mid=center.map((p,j)=>p+normal[j]*size[j]/2);
      const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>{
        const p=mid.slice();p[u]+=a*size[u]/2;p[v]+=b*size[v]/2;return worldPoint(p);
      });
      const [X,Y,Z]=worldPoint(mid),[a,b,c]=rotate(normal),light=[.87,.75,1,.62,.92,.8][i];
      const shade='rgb('+[16,8,0].map(shift=>Math.round(((color>>shift)&255)*light)).join(',')+')';
      result.push({X,Y,Z,a,b,c,points,shade,t:-1,k:-2});
    }
  }
  const swing=grounded?Math.sin(walkPhase)*stride*.72:.26;
  for(const sign of [-1,1]){
    const hip=[sign*.125,.67,0],shoulder=[sign*.34,1.36,0];
    part(hip,[0,-.26,0],[.22,.52,.26],0x384f69,sign*swing);
    part(hip,[0,-.56,-.04],[.23,.16,.32],0x584337,sign*swing);
    part(shoulder,[0,-.12,0],[.18,.25,.24],0x408f83,-sign*swing);
    part(shoulder,[0,-.36,0],[.16,.24,.19],0xe4ac80,-sign*swing);
  }
  part([0,0,0],[0,1.025,0],[.5,.71,.31],0x438d80);
  part([0,0,0],[0,1.56,0],[.46,.42,.43],0xe7b187);
  part([0,0,0],[0,1.72,.015],[.49,.16,.46],0x4d362f);
  part([0,0,0],[0,1.58,.19],[.46,.2,.08],0x543930);
  part([0,0,0],[0,1.08,.21],[.36,.43,.17],0xc18448);
  part([0,0,0],[0,1.24,.24],[.38,.12,.16],0xe3aa60);
  return result;
}
