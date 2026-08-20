(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.DndBeyondImport=api;
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';

function clone(v){return JSON.parse(JSON.stringify(v));}
function clean(v){return String(v??'').replace(/\r\n?/g,'\n').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();}
function num(v){let m=String(v??'').match(/[-+]?\d+(?:\.\d+)?/);return m?Number(m[0]):'';}
function pdfHexDecode(hex){
  hex=String(hex||'').replace(/\s+/g,''); if(hex.length%2)hex+='0';
  const bytes=[]; for(let i=0;i<hex.length;i+=2){let n=parseInt(hex.slice(i,i+2),16);if(Number.isFinite(n))bytes.push(n);}
  if(bytes.length>=2&&bytes[0]===0xFE&&bytes[1]===0xFF){let s='';for(let i=2;i+1<bytes.length;i+=2)s+=String.fromCharCode((bytes[i]<<8)|bytes[i+1]);return s;}
  if(bytes.length>=2&&bytes[0]===0xFF&&bytes[1]===0xFE){let s='';for(let i=2;i+1<bytes.length;i+=2)s+=String.fromCharCode(bytes[i]|(bytes[i+1]<<8));return s;}
  try{return new TextDecoder('windows-1252').decode(new Uint8Array(bytes));}catch(_){return String.fromCharCode(...bytes);}
}
function pdfLiteralDecode(raw){
  let out='';
  for(let i=0;i<raw.length;i++){
    let c=raw[i]; if(c!=='\\'){out+=c;continue;}
    if(i+1>=raw.length)break; let n=raw[++i];
    if(n==='n')out+='\n'; else if(n==='r')out+='\r'; else if(n==='t')out+='\t'; else if(n==='b')out+='\b'; else if(n==='f')out+='\f';
    else if(n==='\n'){} else if(n==='\r'){if(raw[i+1]==='\n')i++;}
    else if(/[0-7]/.test(n)){let oct=n;for(let k=0;k<2&&i+1<raw.length&&/[0-7]/.test(raw[i+1]);k++)oct+=raw[++i];out+=String.fromCharCode(parseInt(oct,8));}
    else out+=n;
  }
  return out;
}
function readPdfToken(block,key){
  const re=new RegExp('/'+key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=\\s|\\(|<|/)');
  const m=re.exec(block); if(!m)return '';
  let i=m.index+m[0].length; while(i<block.length&&/\s/.test(block[i]))i++;
  if(block[i]==='('){
    let depth=1,raw='';i++;
    for(;i<block.length;i++){
      const c=block[i];
      if(c==='\\'){raw+=c;if(i+1<block.length)raw+=block[++i];continue;}
      if(c==='('){depth++;raw+=c;continue;} if(c===')'){depth--;if(depth===0)break;raw+=c;continue;} raw+=c;
    }
    return pdfLiteralDecode(raw);
  }
  if(block[i]==='<'&&block[i+1]!=='<'){let j=block.indexOf('>',i+1);return j>=0?pdfHexDecode(block.slice(i+1,j)):'';}
  if(block[i]==='/'){let j=i+1;while(j<block.length&&!/[\s<>\[\]()/%]/.test(block[j]))j++;return block.slice(i+1,j).replace(/#([0-9A-Fa-f]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));}
  return '';
}
function extractFieldsFromBytes(bytes){
  let text; try{text=new TextDecoder('windows-1252').decode(bytes);}catch(_){let a=[];for(let i=0;i<bytes.length;i+=65535)a.push(String.fromCharCode(...bytes.slice(i,i+65535)));text=a.join('');}
  const fields={},entries=[]; let m,order=0;
  const objRe=/(?:^|[\r\n])\s*\d+\s+\d+\s+obj\b([\s\S]*?)\bendobj\b/g;
  while((m=objRe.exec(text))){let b=m[1];if(!/\/Subtype\s*\/Widget\b/.test(b))continue;let name=readPdfToken(b,'T');if(!name)continue;let value=readPdfToken(b,'V');name=clean(name);value=clean(value);fields[name]=value;entries.push({name,value,order:order++});}
  return {fields,entries};
}
function field(parsed,...names){for(const n of names){if(Object.prototype.hasOwnProperty.call(parsed.fields,n)){let v=clean(parsed.fields[n]);if(v!=='')return v;}}return '';}
function profMark(v){v=clean(v).toUpperCase();if(!v)return 0;if(v==='E'||v.includes('EXPERT'))return 2;return 1;}
function parseClassLevel(v){v=clean(v);let m=v.match(/^(.+?)\s+(\d+)$/);if(m)return {className:m[1].trim(),level:Number(m[2])};let nums=[...v.matchAll(/\b(\d+)\b/g)].map(x=>Number(x[1]));return {className:v.replace(/\s+/g,' '),level:nums.length?nums.reduce((a,b)=>a+b,0):1};}
function extractSection(text,title){text=clean(text);let re=new RegExp('===\\s*'+title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*===([\\s\\S]*?)(?=\\n\\s*===|$)','i'),m=text.match(re);return m?clean(m[1]):'';}
function compactFeatureText(v){return clean(v).replace(/^===\s*ACTIONS\s*===\s*[\s\S]*?(?=\n\s*===\s*(?:BONUS ACTIONS|REACTIONS|SPECIAL)\s*===|$)/i,'').trim();}
function buildProficiencies(parsed){
  let raw=field(parsed,'ProficienciesLang'),langs=extractSection(raw,'LANGUAGES');
  let parts=[];for(const t of ['ARMOR','WEAPONS','TOOLS']){let v=extractSection(raw,t);if(v)parts.push(t[0]+t.slice(1).toLowerCase()+': '+v.replace(/\n+/g,' '));}
  return {languages:langs,proficiencies:parts.join('\n')};
}
function buildAttacks(parsed){
  let rows=[];
  for(let i=1;i<=10;i++){
    let name=i===1?field(parsed,'Wpn Name'):field(parsed,'Wpn Name '+i);
    if(!name)continue;
    let atk=field(parsed,`Wpn${i} AtkBonus`,`Wpn${i} AtkBonus `,`Wpn${i} AtkBonus  `),dmg=field(parsed,`Wpn${i} Damage`,`Wpn${i} Damage `),notes=field(parsed,`Wpn Notes ${i}`);
    rows.push([name,atk,dmg,notes].filter(Boolean).join(' | '));
  }
  let actions=[field(parsed,'Actions1'),field(parsed,'Actions2'),field(parsed,'Actions3')].filter(Boolean).join('\n');actions=compactFeatureText(actions);
  if(actions)rows.push(actions);return clean(rows.join('\n'));
}
function buildAttackProfiles(parsed){
  let rows=[];
  for(let i=1;i<=10;i++){
    let name=i===1?field(parsed,'Wpn Name'):field(parsed,'Wpn Name '+i);
    if(!name)continue;
    let attackBonus=field(parsed,`Wpn${i} AtkBonus`,`Wpn${i} AtkBonus `,`Wpn${i} AtkBonus  `),damage=field(parsed,`Wpn${i} Damage`,`Wpn${i} Damage `),notes=field(parsed,`Wpn Notes ${i}`);
    rows.push({name,attackBonus,damage,notes});
  }
  return rows;
}
function buildActions(parsed){return compactFeatureText([field(parsed,'Actions1'),field(parsed,'Actions2'),field(parsed,'Actions3')].filter(Boolean).join('\n'));}
function buildInventoryItems(parsed){
  let rows=[];
  for(let i=0;i<100;i++){
    let name=field(parsed,`Eq Name${i}`);if(!name){if(i>35)break;continue;}
    let qty=field(parsed,`Eq Qty${i}`)||'1',weight=field(parsed,`Eq Weight${i}`);
    rows.push({id:`ddb_${i}_${String(name).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}`,name,qty,weight:weight==='--'?'':weight,equipped:false});
  }
  let profiles=buildAttackProfiles(parsed);
  for(let item of rows){if(profiles.some(a=>String(a.name).toLowerCase().trim()===String(item.name).toLowerCase().trim()))item.equipped=true;}
  return rows;
}
function buildEquipment(parsed){
  let rows=[];
  for(let i=0;i<100;i++){let name=field(parsed,`Eq Name${i}`);if(!name){if(i>35)break;continue;}let q=field(parsed,`Eq Qty${i}`),w=field(parsed,`Eq Weight${i}`);let lead=q&&q!=='1'?`${q} × `:'';rows.push(`${lead}${name}${w&&w!=='--'?` (${w})`:''}`);}
  let coins=[];for(const c of ['CP','SP','EP','GP','PP']){let v=field(parsed,c);if(v&&v!=='0')coins.push(`${v} ${c}`);}if(coins.length)rows.unshift('Currency: '+coins.join(', '));return rows.join('\n');
}
function buildFeatures(parsed){return clean([field(parsed,'FeaturesTraits1'),field(parsed,'FeaturesTraits2'),field(parsed,'FeaturesTraits3'),field(parsed,'FeaturesTraits4')].filter(Boolean).join('\n'));}

function spellLevelFromHeader(title){
  let t=clean(title).replace(/===/g,'').trim().toUpperCase();if(t.includes('CANTRIP'))return 0;
  let m=t.match(/(\d+)(?:ST|ND|RD|TH)?\s+LEVEL/);return m?Number(m[1]):0;
}
function normalizeCastingTime(v){v=clean(v);let map={'1A':'Action','1BA':'Bonus Action','1R':'Reaction','1m':'1 minute','10m':'10 minutes','1h':'1 hour','8h':'8 hours'};if(map[v])return map[v];return v.replace(/\b1A\b/g,'Action').replace(/\b1BA\b/g,'Bonus Action').replace(/\b1R\b/g,'Reaction').replace(/\b10m\b/g,'10 minutes').replace(/\b1m\b/g,'1 minute').replace(/\b1h\b/g,'1 hour').replace(/\b8h\b/g,'8 hours');}
function normalizeComponents(v){return clean(v).replace(/\s*,\s*/g,', ');}
function parseSpellSlotsHeader(v){let n=num(v);return n===''?null:{max:n,used:0};}
function buildSpellbook(parsed){
  const f=parsed.fields,book=[],slots={};let currentLevel=0,seen=new Set();
  for(const e of parsed.entries){
    let hm=e.name.match(/^spellHeader(\d+)$/i);if(hm&&e.value){currentLevel=spellLevelFromHeader(e.value);continue;}
    let sm=e.name.match(/^spellSlotHeader(\d+)$/i);if(sm&&e.value&&currentLevel>0){let slot=parseSpellSlotsHeader(e.value);if(slot)slots[currentLevel]=slot;continue;}
    let nm=e.name.match(/^spellName(\d+)$/i);if(!nm||!e.value)continue;let i=nm[1];if(seen.has(i))continue;seen.add(i);
    let get=(base)=>clean(f[base+i]??f[base+i+' ']??'');
    let rawName=clean(e.value),ritual=/\[R\]/i.test(rawName),name=rawName.replace(/\s*\[R\]\s*/ig,'').trim();
    let prep=get('spellPrepared').toUpperCase(),source=get('spellSource'),saveAttack=get('spellSaveHit'),castingTime=normalizeCastingTime(get('spellCastingTime')),range=get('spellRange'),components=normalizeComponents(get('spellComponents')),duration=get('spellDuration'),notes=get('spellNotes');
    let concentration=/^concentration\b/i.test(duration)||/\bconcentration\b/i.test(notes);
    let status=currentLevel===0?'atwill':/always prepared/i.test(source)?'always':/magic initiate/i.test(source)?'known':prep==='P'?'prepared':'unprepared';
    book.push({id:`ddb_spell_${i}`,name,level:currentLevel,status,source,castingTime,range,saveAttack:saveAttack==='--'?'':saveAttack,components,duration,ritual,concentration,notes});
  }
  return {book,slots};
}

function buildSpells(parsed){
  const f=parsed.fields,groups=[];let current={title:'Spells',slot:'',rows:[]};groups.push(current);let seen=new Set();
  for(const e of parsed.entries){
    let hm=e.name.match(/^spellHeader(\d+)$/i);if(hm&&e.value){current={title:e.value.replace(/===/g,'').trim(),slot:'',rows:[]};groups.push(current);continue;}
    let sm=e.name.match(/^spellSlotHeader(\d+)$/i);if(sm&&e.value){current.slot=e.value.trim();continue;}
    let nm=e.name.match(/^spellName(\d+)$/i);if(!nm||!e.value)continue;let i=nm[1];if(seen.has(i))continue;seen.add(i);
    let get=(base)=>clean(f[base+i]??f[base+i+' ']??'');
    let prep=get('spellPrepared'),source=get('spellSource'),save=get('spellSaveHit'),time=get('spellCastingTime'),range=get('spellRange'),comp=get('spellComponents'),dur=get('spellDuration'),notes=get('spellNotes');
    let meta=[];if(source)meta.push(source);if(save&&save!=='--')meta.push(save);if(time)meta.push(time);if(range)meta.push(range);if(comp)meta.push(comp);if(dur)meta.push(dur);if(notes&&!meta.includes(notes))meta.push(notes);
    current.rows.push(`${prep.toUpperCase()==='P'?'★ ':''}${e.value}${meta.length?' — '+meta.join(' | '):''}`);
  }
  return groups.filter(g=>g.rows.length).map(g=>`${g.title}${g.slot?` ${g.slot}`:''}\n${g.rows.join('\n')}`).join('\n\n');
}
function parseDdb(parsed){
  const f=(...n)=>field(parsed,...n),cl=parseClassLevel(f('CLASS  LEVEL','CLASS LEVEL'));
  if(!f('CharacterName')||!f('CLASS  LEVEL','CLASS LEVEL'))throw new Error("This PDF doesn't look like a D&D Beyond character export.");
  const abilities={str:num(f('STR')),dex:num(f('DEX')),con:num(f('CON')),int:num(f('INT')),wis:num(f('WIS')),cha:num(f('CHA'))};
  const saveNames={str:'StrProf',dex:'DexProf',con:'ConProf',int:'IntProf',wis:'WisProf',cha:'ChaProf'},saveProficiencies={};for(const [k,n] of Object.entries(saveNames))saveProficiencies[k]=profMark(f(n))>0;
  const skillNames={acrobatics:'AcrobaticsProf',animalHandling:'AnimalHandlingProf',arcana:'ArcanaProf',athletics:'AthleticsProf',deception:'DeceptionProf',history:'HistoryProf',insight:'InsightProf',intimidation:'IntimidationProf',investigation:'InvestigationProf',medicine:'MedicineProf',nature:'NatureProf',perception:'PerceptionProf',performance:'PerformanceProf',persuasion:'PersuasionProf',religion:'ReligionProf',sleightOfHand:'SleightOfHandProf',stealth:'StealthProf',survival:'SurvivalProf'},skillProficiencies={};for(const [k,n] of Object.entries(skillNames))skillProficiencies[k]=profMark(f(n));
  const pr=buildProficiencies(parsed),maxHp=num(f('MaxHP')),currentHp=num(f('CurrentHP')),structuredSpells=buildSpellbook(parsed);
  return {
    source:'D&D Beyond PDF',name:f('CharacterName'),playerName:f('PLAYER NAME'),className:cl.className,level:cl.level,species:f('RACE','RACE2'),background:f('BACKGROUND','BACKGROUND2'),alignment:f('ALIGNMENT'),experience:f('EXPERIENCE POINTS'),
    size:f('SIZE'),gender:f('GENDER'),age:f('AGE'),faith:f('FAITH'),eyes:f('EYES'),hair:f('HAIR'),
    stats:abilities,saveProficiencies,skillProficiencies,proficiencyBonus:num(f('ProfBonus')),hitDice:f('Total'),
    maxHp,currentHp,ac:num(f('AC')),speed:num(f('Speed')),passive:num(f('Passive1')),spellDC:num(f('spellSaveDC0')),spellcastingAbility:f('spellCastingAbility0'),spellAttackBonus:f('spellAtkBonus0'),senses:f('AdditionalSenses'),defenses:f('Defenses'),
    languages:pr.languages,proficiencies:pr.proficiencies,attacks:buildAttacks(parsed),actions:buildActions(parsed),attackProfiles:buildAttackProfiles(parsed),inventoryItems:buildInventoryItems(parsed),spells:buildSpells(parsed),spellbook:structuredSpells.book,spellSlots:structuredSpells.slots,equipment:buildEquipment(parsed),features:buildFeatures(parsed),
    personality:f('PersonalityTraits ','PersonalityTraits'),ideals:f('Ideals'),bonds:f('Bonds'),flaws:f('Flaws'),backstory:f('Backstory'),notes:f('Notes','NOTES'),
    counts:{spells:Object.keys(parsed.fields).filter(k=>/^spellName\d+$/i.test(k)&&clean(parsed.fields[k])).length,equipment:Object.keys(parsed.fields).filter(k=>/^Eq Name\d+$/i.test(k)&&clean(parsed.fields[k])).length,fields:Object.keys(parsed.fields).length}
  };
}
async function parseFile(file){if(!file)throw new Error('Choose a PDF first.');if(file.type&&file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name||''))throw new Error('Please choose a PDF file.');let bytes=new Uint8Array(await file.arrayBuffer());let parsed=extractFieldsFromBytes(bytes);return parseDdb(parsed);}
function applyToCharacter(character,data){
  let p=clone(character||{});if(typeof CharacterSheets!=='undefined'&&CharacterSheets.normalize)CharacterSheets.normalize(p);else{p.sheet=p.sheet||{};p.stats=p.stats||{};}
  const s=p.sheet||{};let oldMax=Number(p.maxHp)||0,oldHp=Number(p.hp)||0;
  p.name=data.name||p.name;s.playerName=data.playerName||s.playerName;s.className=data.className||s.className;s.level=data.level||s.level;s.species=data.species||s.species;s.background=data.background||s.background;s.alignment=data.alignment||s.alignment;
  for(const k of ['experience','size','gender','age','faith','eyes','hair','spellcastingAbility','spellAttackBonus','senses','defenses'])if(data[k]!==''&&data[k]!=null)s[k]=data[k];
  if(data.proficiencyBonus!=='')s.proficiencyBonus=data.proficiencyBonus;if(data.hitDice)s.hitDice=data.hitDice;
  s.stats={...(s.stats||{}),...Object.fromEntries(Object.entries(data.stats||{}).filter(([,v])=>v!==''))};s.saveProficiencies={...(s.saveProficiencies||{}),...(data.saveProficiencies||{})};s.skillProficiencies={...(s.skillProficiencies||{}),...(data.skillProficiencies||{})};
  for(const k of ['languages','proficiencies','attacks','actions','spells','equipment','features','personality','ideals','bonds','flaws','backstory','notes'])if(data[k])s[k]=data[k];
  if(Array.isArray(data.spellbook)&&data.spellbook.length)s.spellbook=clone(data.spellbook);
  if(data.spellSlots&&typeof data.spellSlots==='object')s.spellSlots={...(s.spellSlots||{}),...clone(data.spellSlots)};
  if(Array.isArray(data.inventoryItems)&&data.inventoryItems.length){
    let oldGear=s.gear&&typeof s.gear==='object'?s.gear:null,oldEq=new Map();
    if(oldGear&&Array.isArray(oldGear.inventory))for(const it of oldGear.inventory){if(it&&it.name)oldEq.set(String(it.name).toLowerCase().trim(),!!it.equipped);}
    let inv=clone(data.inventoryItems);for(const it of inv){let k=String(it.name||'').toLowerCase().trim();if(oldEq.has(k))it.equipped=oldEq.get(k);}
    s.gear={version:1,inventory:inv,attackProfiles:clone(data.attackProfiles||[]),initialEquipMatched:true};
  }
  p.sheet=s;p.stats={...s.stats};
  if(data.maxHp!==''){p.maxHp=data.maxHp;if(data.currentHp!=='')p.hp=Math.max(0,Math.min(Number(data.currentHp),Number(data.maxHp)||Number(data.currentHp)));else if(oldMax<=0||oldHp===oldMax)p.hp=data.maxHp;else p.hp=Math.max(0,Math.min(oldHp,Number(data.maxHp)||oldHp));}
  if(data.ac!=='')p.ac=data.ac;if(data.speed!=='')p.speed=data.speed;if(data.passive!=='')p.passive=data.passive;if(data.spellDC!=='')p.spellDC=data.spellDC;
  return p;
}
function summary(d){let bits=[`${d.name} — ${d.className} ${d.level}`,[d.species,d.background].filter(Boolean).join(' · ')];let vit=[];if(d.maxHp!=='')vit.push(`HP ${d.maxHp}`);if(d.ac!=='')vit.push(`AC ${d.ac}`);if(d.speed!=='')vit.push(`Speed ${d.speed}`);if(d.passive!=='')vit.push(`Passive ${d.passive}`);if(vit.length)bits.push(vit.join(' · '));let c=[];if(d.counts.spells)c.push(`${d.counts.spells} spell${d.counts.spells===1?'':'s'}`);if(d.counts.equipment)c.push(`${d.counts.equipment} equipment item${d.counts.equipment===1?'':'s'}`);if(c.length)bits.push(c.join(' · '));return bits.filter(Boolean).join('\n');}
return {parseFile,extractFieldsFromBytes,parseDdb,applyToCharacter,summary};
});
