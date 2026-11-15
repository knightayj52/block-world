'use strict';
const apiRoot=SERVER_URL.replace(/\/$/,'')||(['localhost','127.0.0.1'].includes(location.hostname)?location.origin:'');
let token='',student='',world='',role='',lock=false,epoch=0,worlds=[];
async function api(op,data={}){const res=await fetch(apiRoot+'/api/'+op,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(data),signal:AbortSignal.timeout(8000)});
 const json=await res.json();if(!res.ok){if(res.status===401&&op!=='logout'){disconnect(false);menu()}throw Error(json.error||'서버 연결을 확인하세요.')}return json}
function disconnect(invalidate=true){epoch++;if(token&&invalidate)api('logout').catch(()=>{});token='';cloud=false;loaded=false;peers=[];world='';student='';lock=false;onlineMenu()}
function showError(e){say(e.message||'서버에 연결하지 못했습니다.')}
function onlineMenu(){const box=$('online');box.replaceChildren();
 function input(label,type='text'){let i=document.createElement('input');i.type=type;i.placeholder=label;i.setAttribute('aria-label',label);box.append(i);return i}
 function button(label,fn){let b=document.createElement('button');b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await fn()}catch(e){showError(e)}finally{b.disabled=false}};box.append(b)}
 if(!apiRoot){box.textContent='학급 서버 연결 전입니다. 지금은 기기 연습 월드에서 플레이할 수 있어요.';return}
 if(!token){const room=input('학급 코드'),id=input('학생 아이디'),pw=input('비밀번호 (8자 이상)','password');async function auth(op){let a=await api(op,{room:room.value,name:id.value.trim(),pw:pw.value,...settings()});if(loaded&&!cloud)saveLocal();token=a.token;student=a.name;worlds=(await api('list')).worlds;await openWorld(student)}
 button('로그인',()=>auth('login'));button('처음 가입',()=>auth('register'));return}
 const sel=document.createElement('select');sel.setAttribute('aria-label','월드 선택');for(const w of worlds)sel.add(new Option(w===student?'내 월드':w+'의 월드',w));sel.value=world;box.append(sel);
 button('선택한 월드 열기',()=>openWorld(sel.value));button('초대 새로고침',async()=>{worlds=(await api('list')).worlds;onlineMenu()});
 if(world===student){const friend=input('친구의 학생 아이디');for(const [label,value] of [['구경 초대','view'],['건축 초대','edit'],['초대 종료','remove']])button(label,async()=>{await api('invite',{world,friend:friend.value.trim(),role:value});say('친구 권한을 변경했습니다.')})}
 button('로그아웃',()=>{disconnect();menu();$('status').textContent='로그아웃됨'})}
async function openWorld(id){const seq=++epoch;let data=await api('sync',{world:id});if(seq!==epoch)return;world=id;cloud=true;loaded=true;lock=false;role=data.role;peers=data.peers;loadWorld(data);$('status').textContent=id+'의 월드';onlineMenu();enter()}
function reconcile(data){signs=data.signs||{};let changed=Object.keys(edits).length!==Object.keys(data.edits).length||Object.entries(data.edits).some(([k,v])=>edits[k]!==v);
 if(changed){edits=data.edits;blocks=base.slice();for(const [k,v] of Object.entries(edits))blocks[k]=v;remesh()}if(bag.some((v,i)=>v!==data.bag[i])){bag=data.bag;belt()}role=data.role;peers=data.peers}
async function exchange(op,extra){if(lock||!cloud)return;const seq=epoch;lock=true;try{let data=await api(op,{world,...extra});if(epoch!==seq)return;reconcile(data);$('status').textContent=title+' · 서버 저장 완료';if(op==='edit')say('월드에 반영했습니다.')}
 catch(e){if(seq===epoch){$('status').textContent='서버 저장 확인 필요';showError(e)}}finally{if(epoch===seq)lock=false}}
async function cloudEdit(data){if(role==='view')return say('구경 중인 월드입니다.');if(lock)return say('동기화 중입니다. 다시 눌러 주세요.');await exchange('edit',data)}
setInterval(()=>{if(cloud&&playing)exchange('sync',{pos:[...pos]})},850);
onlineMenu();
