const landscapes={forest:'숲속 빈터',island:'바닷가 작은 섬',canyon:'바위 협곡'};
const challenges={
 forest:['나무 사이 오두막','나무 두 그루 사이에 집을 짓고 창문에서 숲을 바라보세요.'],
 island:['바다 전망대','해변까지 길을 내고, 전망대 끝에 등불을 달아 보세요.'],
 canyon:['두 절벽을 잇는 다리','협곡 양쪽을 잇고 친구가 길을 찾도록 다리 입구에 표지판을 세워 보세요.']
};
const kits=[0,0,8,4,0,0,0,8,8,6,4,3,0], storagePrefix='moaseom-v2-world-';
let biome='forest',title='나의 숲',signs={},slot='legacy',signText='우리 집',goal=false;
function readSave(key){const s=localStorage.getItem(key);return s?JSON.parse(s):null}
function worldOptions(){
 const sel=$('saved');sel.replaceChildren();
 try{for(const key of Object.keys(localStorage)){
  if(!key.startsWith(storagePrefix))continue;
  const data=readSave(key);sel.add(new Option(data.title,key.slice(storagePrefix.length)))}
 if(readSave('moaseom-v1')&&![...sel.options].some(o=>o.value==='legacy'))sel.add(new Option('기존 숲 월드','legacy'));
 }catch{say('기기 저장 목록을 읽지 못했습니다.')}
 if([...sel.options].some(o=>o.value===slot))sel.value=slot;
 $('resume').hidden=!sel.options.length;
}
function settings(){return {title:$('worldname').value.trim().slice(0,24)||landscapes[$('biome').value],biome:$('biome').value}}
function beginLocal(makeNew){
 try{
 if(!cloud&&loaded)saveLocal();if(cloud)disconnect();
 slot=makeNew?Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7):$('saved').value;
 const data=makeNew?settings():readSave(storagePrefix+slot)||(slot==='legacy'?readSave('moaseom-v1'):null);
 if(!data)throw Error('저장한 월드를 찾을 수 없습니다.');
 cloud=false;loadWorld(data);loaded=true;saveLocal();worldOptions();enter();
 }catch(e){say(e.message)}
}
function showCard(){const [name,instruction]=challenges[biome];$('cardname').textContent=name;$('cardbody').textContent=instruction;$('card').showModal()}
function labelSign(){
 if(selected!==11||!playing)return;
 $('signinput').value=signText;$('signdlg').showModal();keys.clear();stick=[0,0];
}
function craftMenu(){
 const list=$('recipes');list.replaceChildren();
 for(const [out,[source,cost,count]] of Object.entries(RECIPES)){
   const b=document.createElement('button');b.textContent=names[source]+' '+cost+'개 → '+names[out]+' '+count+'개';b.disabled=bag[source]<cost;
   b.onclick=()=>{$('craftdlg').close();action('craft',Number(out))};list.append(b)
 }
 $('craftdlg').showModal()
}
function attachWorkshop(){
 $('craftclose').onclick=()=>$('craftdlg').close();
 $('newworld').onclick=()=>beginLocal(true);$('solo').onclick=()=>beginLocal(false);
 $('cardbutton').onclick=showCard;$('cardclose').onclick=()=>$('card').close();
 $('signbutton').onclick=labelSign;$('signconfirm').onclick=()=>{signText=$('signinput').value.trim().slice(0,24)||'우리 집';$('signdlg').close()};
 worldOptions()
}
