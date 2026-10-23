// 单机规则：与原服务端无连接；数值、任务与 AI 为独立设计。
export const VERSION=1;
export const CLASSES={
 warden:{name:'Warden',label:'Melee · Tough',hp:140,damage:22,range:46,speed:79,skill:'Whirlwind',desc:'Sweep nearby enemies. Extra health for your first adventure.',color:'#dfb36d'},
 ranger:{name:'Ranger',label:'Ranged · Agile',hp:105,damage:19,range:145,speed:94,skill:'Volley',desc:'Fire from afar. Swift movement and a rapid volley.',color:'#81c5a1'},
 mage:{name:'Star Mage',label:'Ranged · Burst',hp:95,damage:24,range:130,speed:80,skill:'Starburst',desc:'Unleash starlight. High damage, but watch for enemy attacks.',color:'#a9a3ed'}
};
export const REGIONS=[
 {name:'Tutoria Isle',original:'Tutoria Isle',subtitle:'A gentle breeze. An old camp. A first adventure.',enemy:'TutoriaSlime',enemyName:'Island Slime',boss:'BigShroom',bossName:'Mosscrown Guardian',kills:5,herbs:3,color:'#8dc6a2'},
 {name:'Redwater Forest',original:'Redwater Forest',subtitle:'Follow the forest lights and restore its peace.',enemy:'GoblinA',enemyName:'Forest Goblin',boss:'MassiveShroom',bossName:'Oldwood Guardian',kills:7,herbs:4,color:'#e1b67f'},
 {name:'Glacial Plains',original:'Glacial Plains',subtitle:'Beyond the snow, rekindle the embers.',enemy:'IceSprite',enemyName:'Ice Sprite',boss:'IceDemon',bossName:'Frostland Guardian',kills:8,herbs:5,color:'#a3cae8'}
];
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function blankSave(classId='warden'){
 if(!CLASSES[classId])throw Error('Unknown class');
 return {version:VERSION,classId,level:1,xp:0,gold:0,potions:4,weapon:0,armor:0,region:0,unlocked:0,hp:CLASSES[classId].hp,position:null,progress:REGIONS.map(()=>({kills:0,herbs:[],boss:false,chests:[]})),cooldowns:{attack:0,skill:0,dash:0,potion:0},settings:{auto:true,reduced:false,sound:false},playTime:0,won:false};
}
export function stats(s){const c=CLASSES[s.classId];return {...c,maxHp:c.hp+(s.level-1)*18+s.armor*16,power:c.damage+(s.level-1)*4+s.weapon*7};}
export const xpNeeded=s=>45+s.level*25;
export function validateSave(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||!CLASSES[value.classId])throw Error('Unsupported Aetheria solo save');
 const s=blankSave(value.classId);
 const integer=(key,min,max)=>{const v=value[key];if(!Number.isInteger(v)||v<min||v>max)throw Error('Invalid save field: '+key);s[key]=v;};
 for(const [k,min,max] of [['level',1,30],['xp',0,100000],['gold',0,1000000],['potions',0,99],['weapon',0,5],['armor',0,5],['region',0,2],['unlocked',0,2]])integer(k,min,max);
 if(s.region>s.unlocked)throw Error('Inconsistent region progress');
 if(!Array.isArray(value.progress)||value.progress.length!==3)throw Error('Damaged quest record');
 s.progress=value.progress.map((p,i)=>{
  if(!p||!Number.isInteger(p.kills)||p.kills<0||p.kills>100000||typeof p.boss!=='boolean')throw Error('Invalid quest record');
  for(const key of ['herbs','chests'])if(!Array.isArray(p[key])||p[key].length>(key==='herbs'?10:3)||p[key].some(x=>!Number.isInteger(x)||x<0||x>=(key==='herbs'?10:3))||new Set(p[key]).size!==p[key].length)throw Error('Invalid collection record');
  if(p.boss&&(p.kills<REGIONS[i].kills||p.herbs.length<REGIONS[i].herbs))throw Error('Inconsistent guardian progress');
  return {kills:p.kills,herbs:[...p.herbs],boss:p.boss,chests:[...p.chests]};
 });
 for(let i=0;i<s.unlocked;i++)if(!s.progress[i].boss)throw Error('Inconsistent unlock record');
 const hp=value.hp;if(typeof hp!=='number'||!Number.isFinite(hp)||hp<0||hp>stats(s).maxHp)throw Error('Invalid health value');s.hp=hp;
 if(value.position!==null){if(!value.position||!['x','y'].every(k=>Number.isFinite(value.position[k])&&value.position[k]>=0&&value.position[k]<10000))throw Error('Invalid position');s.position={x:value.position.x,y:value.position.y};}
 if(!Number.isFinite(value.playTime)||value.playTime<0||value.playTime>1e9)throw Error('Invalid play time');s.playTime=value.playTime;
 for(const k of Object.keys(s.cooldowns)){const v=value.cooldowns?.[k];if(!Number.isFinite(v)||v<0||v>30)throw Error('Invalid cooldown record');s.cooldowns[k]=v;}
 for(const k of Object.keys(s.settings)){if(typeof value.settings?.[k]!=='boolean')throw Error('Invalid settings');s.settings[k]=value.settings[k];}
 if(typeof value.won!=='boolean'||value.won!==s.progress[2].boss)throw Error('Inconsistent ending record');s.won=value.won;
 if(s.xp>=xpNeeded(s)&&s.level<30)throw Error('Invalid XP value');
 return s;
}
export function parseSave(text){if(typeof text!=='string'||text.length>50000)throw Error('Save file is too large');return validateSave(JSON.parse(text));}
export function prepareMap(data,atlas){
 const {width:w,height:h}=data;const tileById=new Map(atlas.tiles.map(t=>[t.id,t]));
 const blocked=Uint8Array.from(data.cells,id=>tileById.get(id)?.solid?1:0);
 // 场景物件仅阻挡树干/岩石基部，树冠仍可从下方经过。
 for(const d of data.decorations)if(/Tree|Rock|Tent|Table|Cabinet|Barrel|Pillar|Bookcase/.test(d.key)){
  for(let x=0;x<d.w;x++){const xx=d.x+x,yy=d.y+d.h-1;if(xx<w&&yy<h)blocked[yy*w+xx]=1;}
 }
 const seen=new Uint8Array(w*h);let largest=[];
 for(let i=0;i<w*h;i++){if(blocked[i]||seen[i])continue;const group=[i];seen[i]=1;
  for(let p=0;p<group.length;p++){const n=group[p],x=n%w,y=Math.floor(n/w);for(const q of [x>0?n-1:-1,x<w-1?n+1:-1,y>0?n-w:-1,y<h-1?n+w:-1])if(q>=0&&!blocked[q]&&!seen[q]){seen[q]=1;group.push(q);}}
  if(group.length>largest.length)largest=group;
 }
 if(largest.length<100)throw Error('Not enough walkable terrain');
 const reachable=new Set(largest);const points=largest.filter(i=>[i-1,i+1,i-w,i+w].every(n=>reachable.has(n))).map(i=>({x:(i%w)*16+8,y:Math.floor(i/w)*16+8}));
 const cx=points.reduce((s,p)=>s+p.x,0)/points.length,cy=points.reduce((s,p)=>s+p.y,0)/points.length;
 points.sort((a,b)=>Math.hypot(a.x-cx,a.y-cy)-Math.hypot(b.x-cx,b.y-cy));
 const spawn=points[0];
 // 单机章节围绕营地布置目标，避免在数千像素大图中无目的寻找。
 const nearby=points.filter(p=>dist(p,spawn)>110&&dist(p,spawn)<600);
 const pick=(n,min=42)=>{const selected=[];for(let j=0;j<nearby.length;j++){const p=nearby[(j*137+71)%nearby.length];if(selected.every(q=>dist(p,q)>min))selected.push(p);if(selected.length===n)break;}if(selected.length<n)for(const p of nearby){if(selected.every(q=>dist(p,q)>min))selected.push(p);if(selected.length===n)break;}return selected;};
 const locations=pick(35);if(locations.length<25)throw Error('Not enough quest locations');
 return {...data,blocked,tileById,reachable,spawn,locations};
}
export function walkable(map,x,y,radius=4){
 for(const [dx,dy] of [[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]]){const tx=Math.floor((x+dx)/16),ty=Math.floor((y+dy)/16);if(tx<0||ty<0||tx>=map.width||ty>=map.height||map.blocked[ty*map.width+tx])return false;}return true;
}
export function lineOfSight(map,a,b){const steps=Math.ceil(dist(a,b)/6);for(let i=1;i<steps;i++)if(!walkable(map,a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,0))return false;return true;}
export class Game{
 constructor(save,maps,atlas){this.s=validateSave(save);this.maps=maps;this.atlas=atlas;this.paused=true;this.events=[];this.effects=[];this.time=0;this.invulnerable=0;this.dashTime=0;this.direction={x:0,y:1};this.loadRegion(save.region);}
 emit(text,type='info'){this.events.push({text,type});if(this.events.length>40)this.events.shift();}
 loadRegion(id){this.s.region=id;this.map=this.maps[id];this.player={...this.map.spawn};if(this.s.position&&walkable(this.map,this.s.position.x,this.s.position.y)&&this.map.reachable.has(Math.floor(this.s.position.y/16)*this.map.width+Math.floor(this.s.position.x/16)))this.player={...this.s.position};
  this.enemies=this.map.locations.slice(0,12).map((p,i)=>({...p,home:{...p},id:i,hp:38+id*34,maxHp:38+id*34,damage:8+id*5,cd:0,wind:0,dead:false,respawn:0,boss:false}));
  const b=this.map.locations[30];this.boss={...b,home:{...b},id:99,hp:240+id*140,maxHp:240+id*140,damage:22+id*10,cd:2,wind:0,dead:this.s.progress[id].boss,boss:true};
  this.herbs=this.map.locations.slice(12,22).map((p,i)=>({...p,id:i}));this.chests=this.map.locations.slice(22,25).map((p,i)=>({...p,id:i}));this.effects=[];this.invulnerable=2;this.target=null;this.s.position={...this.player};
 }
 get progress(){return this.s.progress[this.s.region];}
 get bossReady(){return this.progress.kills>=REGIONS[this.s.region].kills&&this.progress.herbs.length>=REGIONS[this.s.region].herbs;}
 get alive(){return [...this.enemies,...(this.bossReady?[this.boss]:[])].filter(e=>!e.dead);}
 get nearCamp(){return dist(this.player,this.map.spawn)<55;}
 nearest(){return this.alive.sort((a,b)=>dist(a,this.player)-dist(b,this.player))[0];}
 snapshot(){this.s.position={...this.player};return structuredClone(this.s);}
 move(actor,dx,dy){if(walkable(this.map,actor.x+dx,actor.y))actor.x+=dx;if(walkable(this.map,actor.x,actor.y+dy))actor.y+=dy;}
 effect(x,y,text,color='#fff'){this.effects.push({x,y,text,color,life:1,max:1});}
 damage(enemy,amount){if(enemy.dead)return;enemy.hp=Math.max(0,enemy.hp-amount);this.effect(enemy.x,enemy.y-18,'−'+amount,'#f2d78e');
  if(enemy.hp>0)return;enemy.dead=true;enemy.respawn=20;this.s.gold+=enemy.boss?80+this.s.region*45:7+this.s.region*4;this.gainXP(enemy.boss?100:18+this.s.region*10);
  if(enemy.boss){this.progress.boss=true;this.s.unlocked=Math.min(2,Math.max(this.s.unlocked,this.s.region+1));this.s.potions=Math.min(99,this.s.potions+2);this.s.hp=stats(this.s).maxHp;if(this.s.region===2){this.s.won=true;this.emit('Embers rekindled · All three guardians rest. Your adventure is complete!','victory');}else this.emit('Chapter complete! Return to camp to travel onward.','chapter');}
  else {this.progress.kills++;if(this.progress.kills===REGIONS[this.s.region].kills)this.emit('Combat goal complete. Keep gathering starleaves.','quest');}
 }
 gainXP(amount){this.s.xp+=amount;while(this.s.level<30&&this.s.xp>=xpNeeded(this.s)){this.s.xp-=xpNeeded(this.s);this.s.level++;this.s.hp=stats(this.s).maxHp;this.emit('Reached level  '+this.s.level+' . Health fully restored.','level');}if(this.s.level===30)this.s.xp=Math.min(this.s.xp,100000);}
 attack(skill=false){if(this.paused||this.s.hp<=0)return false;const key=skill?'skill':'attack';if(this.s.cooldowns[key]>0)return false;
  const st=stats(this.s),range=skill?Math.max(85,st.range+20):st.range;const targets=this.alive.filter(e=>dist(e,this.player)<=range&&lineOfSight(this.map,this.player,e)).sort((a,b)=>dist(a,this.player)-dist(b,this.player));
  if(!targets.length){if(skill)this.emit('No enemies within skill range.');return false;}
  this.s.cooldowns[key]=skill?6:.62;for(const e of targets.slice(0,skill?5:1)){this.effects.push({kind:'line',x:this.player.x,y:this.player.y,ex:e.x,ey:e.y,life:.22,max:.22,color:CLASSES[this.s.classId].color});this.damage(e,Math.round(st.power*(skill?1.9:1)));}return true;
 }
 dash(){if(this.paused||this.s.cooldowns.dash>0)return false;this.s.cooldowns.dash=3.5;this.invulnerable=.55;this.dashTime=.18;return true;}
 heal(){if(this.paused||this.s.cooldowns.potion>0)return false;if(this.s.hp>=stats(this.s).maxHp){this.emit('Health is full. Potion saved.');return false;}if(!this.s.potions){this.emit('No potions left. Resupply at camp.');return false;}this.s.potions--;this.s.cooldowns.potion=5;const amount=Math.round(stats(this.s).maxHp*.55);this.s.hp=Math.min(stats(this.s).maxHp,this.s.hp+amount);this.effect(this.player.x,this.player.y-18,'+'+amount,'#8ce0ac');return true;}
 interact(){if(this.paused)return false;if(this.nearCamp){this.emit('Welcome to camp.','camp');return true;}const p=this.progress;
  const chest=this.chests.find(c=>!p.chests.includes(c.id)&&dist(c,this.player)<40);if(chest){p.chests.push(chest.id);this.s.gold+=35;this.s.potions=Math.min(99,this.s.potions+1);this.emit('Supplies found: 35 gold and 1  potions.','loot');return true;}return false;
 }
 purchase(kind){if(!this.nearCamp)return false;const cost=kind==='potion'?18:45+this.s[kind]*40;if(!['potion','weapon','armor'].includes(kind)||this.s.gold<cost||(kind==='potion'?this.s.potions>=99:this.s[kind]>=5))return false;this.s.gold-=cost;if(kind==='potion')this.s.potions++;else this.s[kind]++;this.emit('Supplies ready.','save');return true;}
 rest(){if(!this.nearCamp)return false;this.s.hp=stats(this.s).maxHp;this.emit('Fully healed at the campfire.');return true;}
 travel(id){if(!Number.isInteger(id)||id<0||id>this.s.unlocked||id>2||!this.nearCamp)return false;this.s.position=null;this.loadRegion(id);this.emit('Arrived at  '+REGIONS[id].name,'region');return true;}
 returnToCamp(){if(this.alive.some(e=>dist(e,this.player)<110)){this.emit('Enemies nearby. Leave combat first.');return false;}this.player={...this.map.spawn};this.invulnerable=2;this.emit('Returned to camp.');return true;}
 respawn(){this.player={...this.map.spawn};this.s.hp=stats(this.s).maxHp;this.invulnerable=3;this.paused=false;for(const e of this.alive){e.x=e.home.x;e.y=e.home.y;e.wind=0;e.cd=1;}this.emit('Back at camp. All quest and gear progress kept.','save');}
 tick(dt,input={x:0,y:0}){
  if(this.paused||this.s.hp<=0)return;dt=clamp(dt,0,.05);this.time+=dt;this.s.playTime+=dt;this.invulnerable=Math.max(0,this.invulnerable-dt);this.dashTime=Math.max(0,this.dashTime-dt);
  for(const k of Object.keys(this.s.cooldowns))this.s.cooldowns[k]=Math.max(0,this.s.cooldowns[k]-dt);
  const len=Math.hypot(input.x||0,input.y||0);if(len){const vx=input.x/Math.max(1,len),vy=input.y/Math.max(1,len);this.direction={x:vx,y:vy};this.move(this.player,vx*stats(this.s).speed*dt*(this.dashTime>0?3.2:1),vy*stats(this.s).speed*dt*(this.dashTime>0?3.2:1));}
  if(this.s.settings.auto)this.attack();
  for(const e of this.enemies)if(e.dead){e.respawn-=dt;if(e.respawn<=0&&dist(e.home,this.player)>100){e.dead=false;e.hp=e.maxHp;e.x=e.home.x;e.y=e.home.y;e.cd=1;e.wind=0;}}
  for(const e of this.alive){
   const d=dist(e,this.player);e.cd=Math.max(0,e.cd-dt);
   if(e.wind>0){e.wind-=dt;if(e.wind<=0){if(dist(e,this.player)<(e.boss?60:28)&&this.invulnerable<=0&&lineOfSight(this.map,e,this.player)){this.s.hp=Math.max(0,this.s.hp-e.damage);this.invulnerable=.45;this.effect(this.player.x,this.player.y-15,'−'+e.damage,'#ff8b86');}e.cd=e.boss?1.8:1.25;}continue;}
   if(d<(e.boss?48:21)){if(e.cd<=0)e.wind=e.boss?.85:.5;}
   else if(d<210&&!this.nearCamp){const speed=e.boss?32:36+this.s.region*4;this.move(e,(this.player.x-e.x)/d*speed*dt,(this.player.y-e.y)/d*speed*dt);}
   else if(dist(e,e.home)>2){const r=dist(e,e.home);this.move(e,(e.home.x-e.x)/r*24*dt,(e.home.y-e.y)/r*24*dt);}
  }
  for(const h of this.herbs)if(!this.progress.herbs.includes(h.id)&&dist(h,this.player)<20){this.progress.herbs.push(h.id);this.gainXP(12);this.emit('Gather starleaves '+Math.min(this.progress.herbs.length,REGIONS[this.s.region].herbs)+' / '+REGIONS[this.s.region].herbs,'loot');}
  if(this.bossReady&&!this._bossNotice?.[this.s.region]){this._bossNotice??={};this._bossNotice[this.s.region]=true;if(!this.progress.boss)this.emit('The guardian has awakened! Follow the gold marker.','quest');}
  this.effects=this.effects.filter(e=>(e.life-=dt)>0);
  if(this.s.hp<=0){this.paused=true;this.emit('You fell. Respawn at camp without losing progress.','death');}
 }
}
