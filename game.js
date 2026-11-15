'use strict';
const $=id=>document.getElementById(id), canvas=$('view'), ctx=canvas.getContext('2d');
const expand=runs=>Uint8Array.from(runs.flatMap(([id,n])=>Array(n).fill(id)));
let base=expand(TERRAIN);
const names=['','잔디','흙','돌','나무','잎','모래','판자','벽돌','유리','등불','표지판','물'];
const colors=['','#89b75b','#aa7851','#9b9f99','#977047','#508a58','#e6cd8e','#ca9a60','#b66950','#a6d8dd','#ffcd59','#ccab7a','#589fc0'];
const idx=(x,y,z)=>x+32*(z+32*y), inside=(x,y,z)=>x>=0&&x<32&&z>=0&&z<32&&y>=0&&y<24;
const spawn=[16.5,9,17.5,0.14,-0.17], starter=kits;
let blocks=base.slice(), edits={}, bag=starter.slice(), pos=spawn.slice(), selected=7;
let playing=false, cloud=false, peers=[], faces=[], vy=0, grounded=false, dirty=false,loaded=false;
let stick=[0,0], keys=new Set(), target=null,last=0, noticeTimer;
const localKey='moaseom-v1';
function say(message){$('tip').textContent=message;$('msg').textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{$('tip').textContent=''},2600)}
function voxel(x,y,z){return inside(x,y,z)?blocks[idx(x,y,z)]:0}
function loadWorld(data){biome=Object.hasOwn(landscapes,data.biome)?data.biome:"forest";title=data.title||"나의 숲";signs={...(data.signs||{})};base=expand(BIOMES[biome]||TERRAIN);edits={...(data.edits||{})};blocks=base.slice();for(const [k,v] of Object.entries(edits))blocks[k]=v;
 bag=starter.map((n,i)=>data.bag?.[i]??n);pos=(data.pos||spawn).slice();vy=0;dirty=false;remesh();belt()}
function saveLocal(){if(!cloud&&loaded){try{localStorage.setItem(storagePrefix+slot,JSON.stringify({title,biome,edits,bag,pos,signs}));$('status').textContent=title+' · 기기 저장 완료'}catch{say('기기 저장 공간을 확인해 주세요.')}}}
function enter(){$('perspective').textContent=thirdPerson?'시점 · 3인칭':'시점 · 1인칭';$('cardbutton').hidden=false;playing=true;$('panel').hidden=true;$('hud').hidden=false;keys.clear();stick=[0,0];belt();say('가까운 블록에 십자선을 맞춰 보세요.')}
function menu(){$('cardbutton').hidden=true;worldOptions();playing=false;stick=[0,0];keys.clear();if(!cloud)saveLocal();$('panel').hidden=false;$('hud').hidden=true;onlineMenu()}
$('menu').onclick=()=>playing?menu():loaded&&enter();
function belt(){$('signbutton').hidden=selected!==11;const bar=$('belt');bar.replaceChildren();for(let t=1;t<names.length;t++){if(t===12||(!bag[t]&&selected!==t))continue;const b=document.createElement('button'),i=document.createElement('i');i.style.background=colors[t];b.append(i,names[t]+' '+bag[t]);b.className=selected===t?'selected':'';b.onclick=()=>{selected=t;belt()};bar.append(b)}
 const craft=document.createElement('button');craft.textContent='작업대';craft.onclick=craftMenu;bar.append(craft)}
const sides=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
function remesh(){faces=[];for(let y=0;y<24;y++)for(let z=0;z<32;z++)for(let x=0;x<32;x++){const t=voxel(x,y,z);if(!t)continue;
 for(let s=0;s<6;s++){const [a,b,c]=sides[s];const neighbor=voxel(x+a,y+b,z+c);if((y===0&&b<0)||(neighbor&&!(neighbor===9&&t!==9)))continue;
 const X=x+.5+a*.5,Y=y+.5+b*.5,Z=z+.5+c*.5;
 const points=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([u,v])=>[X+(a?0:u),Y+(b?0:v),Z+(a?u:b?v:0)]);
 const light=[.83,.67,1,.54,.76,.88][s]*(.96+.08*((x*31+y*19+z*13)%11)/10);
 const rgb=parseInt(colors[t].slice(1),16);const shade='#'+[16,8,0].map(n=>Math.min(255,Math.round(((rgb>>n)&255)*light)).toString(16).padStart(2,'0')).join('');
 faces.push({X,Y,Z,a,b,c,points,shade,t,k:idx(x,y,z),s})}}}
function rayHit(origin,dir,limit){
 const cell=origin.map(Math.floor),step=dir.map(Math.sign),delta=dir.map(v=>v?Math.abs(1/v):Infinity);
 const dist=dir.map((v,i)=>v?(cell[i]+(v>0?1:0)-origin[i])/v:Infinity);
 for(let n=0;n<28;n++){let a=dist.indexOf(Math.min(...dist));if(dist[a]>limit)return null;let prev=cell.slice();cell[a]+=step[a];dist[a]+=delta[a];if(voxel(...cell))return {hit:cell.slice(),prev,point:origin.map((v,i)=>v+dir[i]*(dist[a]-delta[a]+.0001))}}return null}
function trace(){
 const {origin,dir,distance}=playerCamera(), head=[pos[0],pos[1]+1.55,pos[2]];
 const hit=rayHit(origin,dir,5.5+distance);
 if(!hit||!distance)return hit;
 const offset=hit.point.map((v,i)=>v-head[i]), reach=Math.hypot(...offset);
 if(reach>5.5||reach<.001)return null;
 const visible=rayHit(head,offset.map(v=>v/reach),reach+.001);
 return visible&&visible.hit.every((v,i)=>v===hit.hit[i])?hit:null;
}
function intersects(x,y,z){return Math.abs(pos[0]-x-.5)<.76&&Math.abs(pos[2]-z-.5)<.76&&y<pos[1]+1.75&&y+1>pos[1]+.01}
async function action(kind,product=7){if(!playing||document.querySelector('dialog[open]'))return;target=trace();let k=-1,t=0,old=0;
 if(kind==='craft'){const [source,cost]=RECIPES[product];if(bag[source]<cost)return say(names[source]+' 재료가 더 필요해요.')}
 else{if(!target)return say('블록에 조금 더 가까이 가세요.');const cell=kind==='mine'?target.hit:target.prev;
 if(cell[1]===0||!inside(...cell))return say('월드 경계입니다.');if(kind==='mine'&&voxel(...cell)===12)return say('물가에서는 모래 위에 건축해 보세요.');if(kind==='place'&&(!bag[selected]||intersects(...cell)))return say('재료나 놓을 자리를 확인하세요.');
 k=idx(...cell);old=blocks[k];t=kind==='place'?selected:0}
 if(cloud)return cloudEdit({kind,k,t,old,product,text:t===11?signText:""});
 if(kind==='craft'){const [source,cost,count]=RECIPES[product];bag[source]-=cost;bag[product]+=count}else{if(old)bag[old]++;if(t)bag[t]--;blocks[k]=t;edits[k]=t;if(t===11)signs[k]=signText;else delete signs[k];remesh()}saveLocal();belt();say(kind==='craft'?names[product]+' 제작 완료':kind==='mine'?names[old]+' 획득':names[t]+' 놓음')}
function solid(x,y,z){if(x<.27||x>31.73||z<.27||z>31.73||y<0)return true;
 for(const a of [-.25,.25])for(const c of [-.25,.25])for(const b of [.02,.85,1.7])if(![0,12].includes(voxel(Math.floor(x+a),Math.floor(y+b),Math.floor(z+c))))return true;return false}
function jump(){if(grounded){vy=7.25;grounded=false}}
function motion(dt){let [x,y,z,yaw]=pos;
 let f=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-stick[1],r=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+stick[0];
 let len=Math.max(1,Math.hypot(f,r)),dx=(Math.sin(yaw)*f+Math.cos(yaw)*r)*dt*4/len,dz=(-Math.cos(yaw)*f+Math.sin(yaw)*r)*dt*4/len;
 if(!solid(x+dx,y,z))x+=dx;if(!solid(x,y,z+dz))z+=dz;vy=Math.max(-12,vy-17*dt);if(solid(x,y+vy*dt,z)){grounded=vy<=0;vy=0}else{y+=vy*dt;grounded=false}
 const moved=Math.hypot(x-pos[0],z-pos[2]);walkPhase+=moved*4.1;stride+=(Math.min(1,moved/(dt*3.5||1))-stride)*Math.min(1,dt*12);
 pos[0]=x;pos[1]=y;pos[2]=z;pos[3]+=dt*1.9*(Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')));pos[4]=Math.max(-1.48,Math.min(1.48,pos[4]+dt*(Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown')))))}
function render(){let w=Math.min(innerWidth,1000),h=Math.round(w*innerHeight/innerWidth);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
 const cam=playing||loaded?playerCamera():{origin:[16,15.55,30],yaw:-.09,pitch:-.45,distance:0};
 const {origin:[x,y,z],yaw,pitch}=cam, cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 const focal=Math.min(w,h)*.89;
 function camera([X,Y,Z]){let dx=X-x,dy=Y-y,dz=Z-z,d=dx*sy-dz*cy;return [dx*cy+dz*sy,dy*cp-d*sp,d*cp+dy*sp]}
 function project([X,Y,Z]){return [w/2+X*focal/Z,h/2-Y*focal/Z]}
 const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#84c7db');sky.addColorStop(.57,'#e6eed0');sky.addColorStop(1,'#89bec0');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 let list=[];for(const f of (cam.distance>.75?faces.concat(avatarFaces()):faces)){if((x-f.X)*f.a+(y-f.Y)*f.b+(z-f.Z)*f.c<=0)continue;
 let center=camera([f.X,f.Y,f.Z]);if(center[2]<-.85||Math.abs(center[0])>(center[2]+1)*w/(2*focal)+1||Math.abs(center[1])>(center[2]+1)*h/(2*focal)+1)continue;
 list.push([center[2],f])}list.sort((a,b)=>b[0]-a[0]);
 let hit=playing&&target?idx(...target.hit):-1;
 for(const [depth,f] of list){let points=f.points.map(camera);
 if(points.some(v=>v[2]<.06)){let cut=[];for(let i=0;i<4;i++){let a=points[i],b=points[(i+1)%4];if(a[2]>=.06)cut.push(a);if((a[2]>=.06)!==(b[2]>=.06)){let u=(.06-a[2])/(b[2]-a[2]);cut.push(a.map((v,j)=>v+(b[j]-v)*u))}}points=cut}
 if(points.length<3)continue;let poly=points.map(project);ctx.beginPath();ctx.moveTo(...poly[0]);for(const p of poly.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fillStyle=f.shade;ctx.globalAlpha=f.t===9?.36:1;ctx.fill();ctx.globalAlpha=1;ctx.lineWidth=f.k===hit?2:1;ctx.strokeStyle=f.k===hit?'#fff7ae':f.shade;ctx.stroke();
 if(f.t===11&&depth>.7&&depth<12&&f.b===0&&poly.length===4){const mid=project(camera([f.X,f.Y,f.Z]));ctx.fillStyle='#392815';ctx.textAlign='center';ctx.font=Math.max(7,Math.min(22,focal/depth*.12))+'px sans-serif';ctx.fillText(signs[f.k]||'작품',mid[0],mid[1],Math.max(10,focal/depth*.85))}
 if((f.t===8||f.t===7)&&poly.length===4&&depth>.9&&depth<16){let [a,b,c,d]=poly;ctx.strokeStyle=f.t===8?'#e3b093':'#96794f';ctx.lineWidth=1;for(const v of [.33,.66]){ctx.beginPath();ctx.moveTo(a[0]+(d[0]-a[0])*v,a[1]+(d[1]-a[1])*v);ctx.lineTo(b[0]+(c[0]-b[0])*v,b[1]+(c[1]-b[1])*v);ctx.stroke()}}
 if(f.t===10&&depth>.8){ctx.strokeStyle='#ffdf89';ctx.lineWidth=1.5;ctx.stroke()}
 if(f.t>0&&depth<17&&depth>1.8&&poly.length===4){const [a,b,,d]=poly;ctx.fillStyle='rgba(46,54,29,.13)';for(let n=0;n<3;n++){let u=((f.k*7+n*37)%89)/100,v=((f.k*19+n*23)%83)/100;ctx.fillRect(a[0]+(b[0]-a[0])*u+(d[0]-a[0])*v,a[1]+(b[1]-a[1])*u+(d[1]-a[1])*v,Math.min(10,focal/depth*.12),Math.min(5,focal/depth*.06))}}}
 for(const p of peers){let v=camera([p.pos[0],p.pos[1]+1.6,p.pos[2]]);if(v[2]<.3)continue;let [a,b]=project(v),s=Math.min(60,focal/v[2]*.5);ctx.fillStyle='#e7ba88';ctx.fillRect(a-s/2,b,s,s);ctx.fillStyle='#526baf';ctx.fillRect(a-s/2,b+s,s,s*1.8);ctx.fillStyle='#153028';ctx.textAlign='center';ctx.fillText(p.name,a,b-4)}}
function frame(now){if(now-last>32){let dt=Math.min(.04,(now-last)/1000);last=now;if(playing&&!document.querySelector('dialog[open]')){motion(dt);target=trace()}if(playing||dirty||!canvas.dataset.ready){render();canvas.dataset.ready='1';dirty=false}}requestAnimationFrame(frame)}
addEventListener('resize',()=>dirty=true);addEventListener('keydown',e=>{if(!playing||document.querySelector('dialog[open]'))return;keys.add(e.code);if(['Space','ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Space')jump();if(e.code==='KeyQ')action('mine');if(e.code==='KeyE')action('place');if(e.code==='Escape')menu()});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();stick=[0,0]});
let look=null;canvas.onpointerdown=e=>{if(playing){look=[e.pointerId,e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)}};canvas.onpointermove=e=>{if(look&&look[0]===e.pointerId){pos[3]+=(e.clientX-look[1])*.008;pos[4]=Math.max(-1.48,Math.min(1.48,pos[4]-(e.clientY-look[2])*.008));look=[e.pointerId,e.clientX,e.clientY]}};canvas.onlostpointercapture=()=>look=null;
for (const surface of [canvas, $('hud'), document.querySelector('header')]) {
  for (const event of ['contextmenu', 'selectstart']) {
    surface.addEventListener(event, e => e.preventDefault());
  }
}
const pad=$('pad');function steer(e){let rect=pad.getBoundingClientRect();stick=[(e.clientX-rect.left)/rect.width*2-1,(e.clientY-rect.top)/rect.height*2-1].map(v=>Math.max(-1,Math.min(1,v)))}
pad.onpointerdown=e=>{pad.setPointerCapture(e.pointerId);steer(e)};pad.onpointermove=e=>{if(pad.hasPointerCapture(e.pointerId))steer(e)};pad.onlostpointercapture=()=>stick=[0,0];
$('perspective').onclick=togglePerspective;
$('mine').onclick=()=>action('mine');$('place').onclick=()=>action('place');$('jump').onclick=jump;
setInterval(()=>{if(playing&&!cloud)saveLocal()},3000);addEventListener('pagehide',()=>{if(!cloud)saveLocal()});remesh();requestAnimationFrame(frame);
