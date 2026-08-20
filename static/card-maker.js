(function(root){
'use strict';
function esc(s=''){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function clone(v){return JSON.parse(JSON.stringify(v))}
function keyName(s=''){return String(s).toLowerCase().replace(/\s*\[r\]\s*/g,'').replace(/\s*\(\d+\/\d+\)\s*$/,'').replace(/[’']/g,"'").replace(/\s+/g,' ').trim()}
function deriveSpellClass(sp,p){let src=String(sp.source||'').toUpperCase();for(const c of ['DRUID','WIZARD','CLERIC','RANGER','PALADIN','BARD','SORCERER','WARLOCK'])if(src.includes(c))return c;let cls=String(p.sheet?.className||'').trim().toUpperCase();return cls||'SPELL'}
function spellCards(p){
  if(root.CharacterSheets?.normalize)root.CharacterSheets.normalize(p);
  const fullLib=root.SrdSpellLibrary?.byName||{};
  const druidLib=root.SrdDruidSpellCards||{};
  return (p.sheet?.spellbook||[]).filter(s=>s&&s.name).map((sp,i)=>{
    let sr=fullLib[keyName(sp.name)]||druidLib[keyName(sp.name)]||null;
    return {id:`spell:${sp.id||i}`,kind:'spell',name:sp.name,level:Number(sp.level)||0,status:sp.status||'',source:sp.source||'',spellClass:deriveSpellClass(sp,p),school:sp.school||sr?.school||'',castingTime:sp.castingTime||sr?.castingTime||'',range:sp.range||sr?.range||'',saveAttack:sp.saveAttack||'',components:sp.components||sr?.components||'',duration:sp.duration||sr?.duration||'',ritual:!!sp.ritual,concentration:!!sp.concentration,notes:sp.notes||'',description:sp.description||sr?.description||'',srdDescription:sr?.description||'',srd:!!sr,prepared:['prepared','always','known','atwill'].includes(sp.status)};
  }).sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name));
}
function equipmentCards(p){
  if(!root.CharacterEquipment)return [];
  root.CharacterEquipment.normalize(p);
  let inv=p.sheet?.gear?.inventory||[];
  return inv.map((it,i)=>{
    let cat=it.category||'other',badge=cat==='weapon'?'WEAPON':cat==='armor'?'ARMOR':cat==='shield'?'SHIELD':'GEAR';
    let attack='',damage='',versatile='',detail='';
    if(cat==='weapon'){
      let info=root.CharacterEquipment.attackInfo(p,it,{preferImported:true});attack=info.attack||'';damage=info.damage||'';versatile=info.versatile||'';detail=info.notes||it.properties||'';
    }else if(cat==='armor'){
      let dex=it.dexCap===0?'No DEX':it.dexCap===2?'DEX max +2':'Add DEX';detail=[Number.isFinite(Number(it.baseAc))?`Base AC ${it.baseAc} (${dex})`:'',it.properties||''].filter(Boolean).join(' · ');
    }else if(cat==='shield'){
      detail=`AC +${Number(it.acBonus)||2}${it.properties?` · ${it.properties}`:''}`;
    }else detail=it.properties||'';
    return {id:`gear:${it.id||i}`,kind:'equipment',name:it.name||'Item',badge,category:cat,qty:it.qty||1,weight:it.weight||'',equipped:!!it.equipped,attack,damage,versatile,detail,cardText:it.cardText||''};
  }).sort((a,b)=>(Number(b.equipped)-Number(a.equipped))||a.badge.localeCompare(b.badge)||a.name.localeCompare(b.name));
}
function build(p){
  p=clone(p);if(root.CharacterSheets?.normalize)root.CharacterSheets.normalize(p);if(root.CharacterEquipment?.normalize)root.CharacterEquipment.normalize(p);
  const data={character:p.name||'Character',className:p.sheet?.className||'',spells:spellCards(p),gear:equipmentCards(p)};
  const payload=JSON.stringify(data).replace(/</g,'\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(data.character)} - Card Maker</title><link rel="stylesheet" href="/static/card-maker.css"></head><body><script>window.CARD_DATA=${payload};</script><script src="/static/card-maker-window.js"></script></body></html>`;
}
function openCards(p){if(!p)return;let w=window.open('','_blank');if(!w){alert('Your browser blocked the card maker window. Allow pop-ups for this local DM Control Room site and try again.');return;}w.document.open();w.document.write(build(p));w.document.close()}
root.CharacterCards={open:openCards,build,spellCards,equipmentCards};
})(typeof window!=='undefined'?window:globalThis);
