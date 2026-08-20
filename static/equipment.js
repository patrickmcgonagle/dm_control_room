(function(root){
'use strict';
const DB={
  // Simple melee
  'club':{category:'weapon',group:'simple',die:'1d4',type:'Bludgeoning',ability:'str',properties:'Light'},
  'dagger':{category:'weapon',group:'simple',die:'1d4',type:'Piercing',ability:'finesse',properties:'Finesse, Light, Thrown (20/60)'},
  'greatclub':{category:'weapon',group:'simple',die:'1d8',type:'Bludgeoning',ability:'str',properties:'Two-Handed'},
  'handaxe':{category:'weapon',group:'simple',die:'1d6',type:'Slashing',ability:'str',properties:'Light, Thrown (20/60)'},
  'javelin':{category:'weapon',group:'simple',die:'1d6',type:'Piercing',ability:'str',properties:'Thrown (30/120)'},
  'light hammer':{category:'weapon',group:'simple',die:'1d4',type:'Bludgeoning',ability:'str',properties:'Light, Thrown (20/60)'},
  'mace':{category:'weapon',group:'simple',die:'1d6',type:'Bludgeoning',ability:'str'},
  'quarterstaff':{category:'weapon',group:'simple',die:'1d6',versatile:'1d8',type:'Bludgeoning',ability:'str',properties:'Versatile'},
  'sickle':{category:'weapon',group:'simple',die:'1d4',type:'Slashing',ability:'str',properties:'Light'},
  'spear':{category:'weapon',group:'simple',die:'1d6',versatile:'1d8',type:'Piercing',ability:'str',properties:'Thrown (20/60), Versatile'},
  // Simple ranged
  'dart':{category:'weapon',group:'simple',die:'1d4',type:'Piercing',ability:'dex',properties:'Finesse, Thrown (20/60)'},
  'light crossbow':{category:'weapon',group:'simple',die:'1d8',type:'Piercing',ability:'dex',properties:'Ammunition (80/320), Loading, Two-Handed'},
  'shortbow':{category:'weapon',group:'simple',die:'1d6',type:'Piercing',ability:'dex',properties:'Ammunition (80/320), Two-Handed'},
  'sling':{category:'weapon',group:'simple',die:'1d4',type:'Bludgeoning',ability:'dex',properties:'Ammunition (30/120)'},
  // Martial melee
  'battleaxe':{category:'weapon',group:'martial',die:'1d8',versatile:'1d10',type:'Slashing',ability:'str',properties:'Versatile'},
  'flail':{category:'weapon',group:'martial',die:'1d8',type:'Bludgeoning',ability:'str'},
  'glaive':{category:'weapon',group:'martial',die:'1d10',type:'Slashing',ability:'str',properties:'Heavy, Reach, Two-Handed'},
  'greataxe':{category:'weapon',group:'martial',die:'1d12',type:'Slashing',ability:'str',properties:'Heavy, Two-Handed'},
  'greatsword':{category:'weapon',group:'martial',die:'2d6',type:'Slashing',ability:'str',properties:'Heavy, Two-Handed'},
  'halberd':{category:'weapon',group:'martial',die:'1d10',type:'Slashing',ability:'str',properties:'Heavy, Reach, Two-Handed'},
  'lance':{category:'weapon',group:'martial',die:'1d10',type:'Piercing',ability:'str',properties:'Heavy, Reach, Two-Handed (unless mounted)'},
  'longsword':{category:'weapon',group:'martial',die:'1d8',versatile:'1d10',type:'Slashing',ability:'str',properties:'Versatile'},
  'maul':{category:'weapon',group:'martial',die:'2d6',type:'Bludgeoning',ability:'str',properties:'Heavy, Two-Handed'},
  'morningstar':{category:'weapon',group:'martial',die:'1d8',type:'Piercing',ability:'str'},
  'pike':{category:'weapon',group:'martial',die:'1d10',type:'Piercing',ability:'str',properties:'Heavy, Reach, Two-Handed'},
  'rapier':{category:'weapon',group:'martial',die:'1d8',type:'Piercing',ability:'finesse',properties:'Finesse'},
  'scimitar':{category:'weapon',group:'martial',die:'1d6',type:'Slashing',ability:'finesse',properties:'Finesse, Light'},
  'shortsword':{category:'weapon',group:'martial',die:'1d6',type:'Piercing',ability:'finesse',properties:'Finesse, Light'},
  'trident':{category:'weapon',group:'martial',die:'1d8',versatile:'1d10',type:'Piercing',ability:'str',properties:'Thrown (20/60), Versatile'},
  'warhammer':{category:'weapon',group:'martial',die:'1d8',versatile:'1d10',type:'Bludgeoning',ability:'str',properties:'Versatile'},
  'war pick':{category:'weapon',group:'martial',die:'1d8',type:'Piercing',ability:'str'},
  'whip':{category:'weapon',group:'martial',die:'1d4',type:'Slashing',ability:'finesse',properties:'Finesse, Reach'},
  // Martial ranged
  'blowgun':{category:'weapon',group:'martial',die:'1',type:'Piercing',ability:'dex',properties:'Ammunition (25/100), Loading'},
  'hand crossbow':{category:'weapon',group:'martial',die:'1d6',type:'Piercing',ability:'dex',properties:'Ammunition (30/120), Light, Loading'},
  'heavy crossbow':{category:'weapon',group:'martial',die:'1d10',type:'Piercing',ability:'dex',properties:'Ammunition (100/400), Heavy, Loading, Two-Handed'},
  'longbow':{category:'weapon',group:'martial',die:'1d8',type:'Piercing',ability:'dex',properties:'Ammunition (150/600), Heavy, Two-Handed'},
  // Armor / shields. AC is intentionally a reference/suggestion only.
  'padded armor':{category:'armor',baseAc:11,dexCap:null},'padded':{category:'armor',baseAc:11,dexCap:null},
  'leather armor':{category:'armor',baseAc:11,dexCap:null},'leather':{category:'armor',baseAc:11,dexCap:null},
  'studded leather armor':{category:'armor',baseAc:12,dexCap:null},'studded leather':{category:'armor',baseAc:12,dexCap:null},
  'hide armor':{category:'armor',baseAc:12,dexCap:2},'hide':{category:'armor',baseAc:12,dexCap:2},
  'chain shirt':{category:'armor',baseAc:13,dexCap:2},'scale mail':{category:'armor',baseAc:14,dexCap:2},
  'breastplate':{category:'armor',baseAc:14,dexCap:2},'half plate':{category:'armor',baseAc:15,dexCap:2},
  'ring mail':{category:'armor',baseAc:14,dexCap:0},'chain mail':{category:'armor',baseAc:16,dexCap:0},
  'splint':{category:'armor',baseAc:17,dexCap:0},'splint armor':{category:'armor',baseAc:17,dexCap:0},
  'plate':{category:'armor',baseAc:18,dexCap:0},'plate armor':{category:'armor',baseAc:18,dexCap:0},
  'shield':{category:'shield',acBonus:2}
};
function esc(s=''){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function keyName(s=''){return String(s).toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim()}
function uid(){return 'gear_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
function clone(v){return JSON.parse(JSON.stringify(v))}
function mod(v){let n=Number(v);return Number.isFinite(n)&&v!==''?Math.floor((n-10)/2):0}
function signed(n){n=Number(n)||0;return n>=0?'+'+n:String(n)}
function prof(p){let s=p.sheet||{},n=Number(s.proficiencyBonus);if(Number.isFinite(n)&&n>0)return n;let lvl=Math.max(1,Number(s.level)||1);return 2+Math.floor((lvl-1)/4)}
function dbFor(name){return DB[keyName(name)]||null}
function enrich(item){item=item||{};let d=dbFor(item.name)||{};if(!item.id)item.id=uid();if(item.qty===undefined||item.qty==='')item.qty=1;if((!item.category||item.category==='other')&&d.category)item.category=d.category;else if(!item.category)item.category='other';if(!item.group&&d.group)item.group=d.group;if(!item.damageDie&&d.die)item.damageDie=d.die;if(!item.versatileDie&&d.versatile)item.versatileDie=d.versatile;if(!item.damageType&&d.type)item.damageType=d.type;if(!item.ability&&d.ability)item.ability=d.ability;if(!item.properties&&d.properties)item.properties=d.properties;if(item.baseAc===undefined&&d.baseAc!==undefined)item.baseAc=d.baseAc;if(item.dexCap===undefined&&d.dexCap!==undefined)item.dexCap=d.dexCap;if(item.acBonus===undefined&&d.acBonus!==undefined)item.acBonus=d.acBonus;if(item.equipped===undefined)item.equipped=false;return item}
function parseEquipmentText(text=''){
  const out=[];for(let raw of String(text).split(/\n+/)){let line=raw.trim();if(!line||/^currency:/i.test(line))continue;let weight='';let wm=line.match(/\s+\(([^()]*(?:lb\.|lbs?\.?|oz\.)[^()]*)\)\s*$/i);if(wm){weight=wm[1];line=line.slice(0,wm.index).trim()}let qty=1;let qm=line.match(/^([\d,]+)\s*[×x]\s*(.+)$/i);if(qm){qty=qm[1].replace(/,/g,'');line=qm[2].trim()}out.push(enrich({id:uid(),name:line,qty,weight,equipped:false}));}return out
}
function parseAttackText(text=''){
  const out=[];for(let raw of String(text).split(/\n+/)){let bits=raw.split('|').map(x=>x.trim());if(bits.length<3||!/\d+d\d+|\b\d+\s+(?:bludgeoning|piercing|slashing|fire|cold|acid|poison|radiant|necrotic|force|psychic|thunder|lightning)\b/i.test(bits[2]||''))continue;out.push({name:bits[0],attackBonus:bits[1],damage:bits[2],notes:bits.slice(3).join(' | ')});}return out
}
function normalize(p){if(!p)return null;p.sheet=p.sheet||{};let s=p.sheet,g=s.gear;if(!g||typeof g!=='object')g=s.gear={version:1,inventory:[],attackProfiles:[]};g.version=1;if(!Array.isArray(g.inventory))g.inventory=[];if(!Array.isArray(g.attackProfiles))g.attackProfiles=[];if(!g.inventory.length&&s.equipment)g.inventory=parseEquipmentText(s.equipment);if(!g.attackProfiles.length&&s.attacks)g.attackProfiles=parseAttackText(s.attacks);if(!s.actions&&s.attacks){let actionLines=String(s.attacks).split(/\n+/).filter(line=>!parseAttackText(line).length);s.actions=actionLines.join('\n').trim();}g.inventory=g.inventory.map(x=>enrich(x));
  // If D&D Beyond supplied an attack profile, treat the matching carried weapon as initially readied.
  if(!g.initialEquipMatched&&g.attackProfiles.length){for(let item of g.inventory){if(item.category==='weapon'&&g.attackProfiles.some(a=>keyName(a.name)===keyName(item.name)))item.equipped=true;}g.initialEquipMatched=true;}
  return g
}
function isProficient(p,item){let s=p.sheet||{},txt=String(s.proficiencies||'').toLowerCase();if(item.group==='simple'&&txt.includes('simple weapons'))return true;if(item.group==='martial'&&txt.includes('martial weapons'))return true;if(txt.includes(keyName(item.name)))return true;return false}
function abilityFor(p,item){let a=item.ability||'str';if(a==='finesse')return mod(p.sheet?.stats?.dex)>=mod(p.sheet?.stats?.str)?'dex':'str';if(a==='auto')return item.properties&&/finesse/i.test(item.properties)?(mod(p.sheet?.stats?.dex)>=mod(p.sheet?.stats?.str)?'dex':'str'):(/ammunition|range/i.test(item.properties||'')?'dex':'str');return a}
function profileFor(g,item){return (g.attackProfiles||[]).find(a=>keyName(a.name)===keyName(item.name))||null}
function attackInfo(p,item,opt={}){let g=normalize(p),it=enrich(clone(item)),profile=profileFor(g,it);if(profile&&opt.preferImported!==false){let a0=abilityFor(p,it),m0=mod(p.sheet?.stats?.[a0]),b0=m0===0?'':(m0>0?`+${m0}`:`${m0}`),v0=it.versatileDie?`${it.versatileDie}${b0}${it.damageType?' '+it.damageType:''} two-handed`:'';return {name:it.name,attack:profile.attackBonus||'—',damage:profile.damage||'—',versatile:v0,notes:profile.notes||it.properties||'',source:'D&D Beyond'}}let a=abilityFor(p,it),m=mod(p.sheet?.stats?.[a]),atk=m+(isProficient(p,it)?prof(p):0),base=it.damageDie||'—',bonus=m===0?'':(m>0?`+${m}`:`${m}`),damage=base==='—'?'—':`${base}${bonus}${it.damageType?' '+it.damageType:''}`,versatile=it.versatileDie?`${it.versatileDie}${bonus}${it.damageType?' '+it.damageType:''} two-handed`:'';return {name:it.name,attack:signed(atk),damage,versatile,notes:it.properties||'',ability:a.toUpperCase(),source:'Calculated'} }
function weaponRows(p,onlyEquipped=false){let g=normalize(p);return g.inventory.filter(i=>i.category==='weapon'&&(!onlyEquipped||i.equipped)).map(i=>({item:i,...attackInfo(p,i,{preferImported:i.equipped})}))}
function inventoryLines(p){let g=normalize(p);return g.inventory.map(i=>{let qty=String(i.qty||1)!=='1'?`${i.qty} × `:'';let eq=i.equipped?'[EQUIPPED] ':'';let ref=i.category==='weapon'&&i.damageDie?` — ${i.damageDie}${i.versatileDie?` / ${i.versatileDie} versatile`:''} ${i.damageType||''}`:'';return `${eq}${qty}${i.name}${ref}${i.weight?` (${i.weight})`:''}`.trim()})}
function armorSuggestion(p){let g=normalize(p),armor=g.inventory.find(i=>i.category==='armor'&&i.equipped),shield=g.inventory.find(i=>i.category==='shield'&&i.equipped);if(!armor&&!shield)return null;let dex=mod(p.sheet?.stats?.dex),ac=10+dex,parts=[];if(armor&&Number.isFinite(Number(armor.baseAc))){let cap=armor.dexCap===null||armor.dexCap===undefined?dex:Math.min(dex,Number(armor.dexCap)||0);ac=Number(armor.baseAc)+cap;parts.push(armor.name)}if(shield){ac+=Number(shield.acBonus)||2;parts.push(shield.name)}return {ac,parts}}
function rowHtml(r,showEquipped=true){let src=r.source==='D&D Beyond'?'<span class="gear-source">PDF</span>':'<span class="gear-source calc">calc</span>';return `<div class="gear-attack-row">${showEquipped?'<span class="gear-ready-dot">●</span>':''}<div><b>${esc(r.name)}</b><small>${esc([r.notes,r.versatile].filter(Boolean).join(' · '))}</small></div><strong>${esc(r.attack)}</strong><span>${esc(r.damage)}</span>${src}</div>`}
function combatHtml(p){let rows=weaponRows(p,true),s=p.sheet||{},actions=s.actions||'';let weapons=rows.length?`<div class="gear-attack-table"><div class="gear-attack-head"><span></span><span>Readied Weapon</span><span>Hit</span><span>Damage</span><span></span></div>${rows.map(r=>rowHtml(r)).join('')}</div>`:`<div class="cs-text empty">No weapons currently readied. Use Equipment to ready one.</div>`;return weapons+(actions?`<div class="gear-actions"><b>Other Actions</b><div class="cs-text">${esc(actions)}</div></div>`:'')}
function referenceHtml(p){let rows=weaponRows(p,false);if(!rows.length)return '';return `<div class="gear-ref-list">${rows.map(r=>`<div class="gear-ref-row ${r.item.equipped?'equipped':''}"><div><b>${esc(r.name)}</b>${r.item.equipped?'<span class="gear-badge">Readied</span>':''}<small>${esc(r.notes||'')}</small></div><span>${esc(r.item.damageDie||'—')}${r.item.versatileDie?` / ${esc(r.item.versatileDie)}`:''}</span><span>${esc(r.item.damageType||'')}</span></div>`).join('')}</div>`}
function inventoryHtml(p){let g=normalize(p);if(!g.inventory.length)return '<div class="cs-text empty">No equipment entered yet.</div>';return `<div class="gear-inventory-list">${g.inventory.map(i=>`<div class="gear-inventory-row"><span>${i.equipped?'<b class="gear-badge">Equipped</b> ':''}${esc(String(i.qty||1)!=='1'?`${i.qty} × `:'')}${esc(i.name)}</span><small>${esc([i.category!=='other'?i.category:'',i.weight].filter(Boolean).join(' · '))}</small></div>`).join('')}</div>`}
function sheetSummaryHtml(p){normalize(p);let a=armorSuggestion(p);return `<section class="cs-section"><div class="gear-section-title"><h3>Equipment & Loadout</h3></div>${combatHtml(p)}${a?`<div class="gear-ac-note">Equipment AC reference: <b>${a.ac}</b> from ${esc(a.parts.join(' + '))}. Live AC remains ${esc(p.ac??'—')} so class features and magic bonuses aren't overwritten.</div>`:''}<h4 class="gear-subhead">Weapon Reference — all carried weapons</h4>${referenceHtml(p)||'<div class="cs-text empty">No recognized weapons in inventory.</div>'}<h4 class="gear-subhead">Inventory</h4>${inventoryHtml(p)}</section>`}
function categoryOptions(v){return [['other','Other'],['weapon','Weapon'],['armor','Armor'],['shield','Shield']].map(([x,n])=>`<option value="${x}" ${v===x?'selected':''}>${n}</option>`).join('')}
function abilityOptions(v){return [['auto','Auto'],['str','STR'],['dex','DEX'],['finesse','Finesse (best STR/DEX)']].map(([x,n])=>`<option value="${x}" ${v===x?'selected':''}>${n}</option>`).join('')}
function itemEditorRow(item,readOnly=false){item=enrich(clone(item));let dis=readOnly?'disabled':'';return `<div class="gear-editor-row" data-gear-id="${esc(item.id)}"><div class="gear-equip-cell"><label><input type="checkbox" data-gear="equipped" ${item.equipped?'checked':''} ${dis} onchange="CharacterEquipment.equipChanged(this)"> <b>Equipped</b></label></div><label class="gear-name">Item<input data-gear="name" value="${esc(item.name)}" ${dis}></label><label>Qty<input data-gear="qty" value="${esc(item.qty??1)}" ${dis}></label><label>Type<select data-gear="category" ${dis} onchange="CharacterEquipment.categoryChanged(this)">${categoryOptions(item.category)}</select></label><label>Damage Die<input data-gear="damageDie" value="${esc(item.damageDie||'')}" placeholder="1d8" ${dis}></label><label>Damage Type<input data-gear="damageType" value="${esc(item.damageType||'')}" placeholder="Slashing" ${dis}></label><label>Versatile<input data-gear="versatileDie" value="${esc(item.versatileDie||'')}" placeholder="1d10" ${dis}></label><label>Attack Ability<select data-gear="ability" ${dis}>${abilityOptions(item.ability||'auto')}</select></label><label class="gear-wide">Properties / Notes<input data-gear="properties" value="${esc(item.properties||'')}" ${dis}></label><label>Weight<input data-gear="weight" value="${esc(item.weight||'')}" ${dis}></label>${readOnly?'':`<button type="button" class="btn small danger gear-remove" onclick="CharacterEquipment.removeRow(this)">Remove</button>`}</div>`}
function managerHtml(p,opt={}){let g=normalize(p),ro=!!opt.readOnly;return `<div class="gear-manager" data-readonly="${ro?'1':'0'}"><div class="gear-manager-intro"><div><b>Carried inventory vs. equipped gear</b><br><span>Weapons can be readied or put away without removing them from inventory. Recognized weapons keep their dice reference even while unequipped.</span></div>${ro?'':`<button type="button" class="btn small primary" onclick="CharacterEquipment.addRow(this)">+ Add Item</button>`}</div><div class="gear-editor-list">${g.inventory.map(i=>itemEditorRow(i,ro)).join('')}</div>${g.inventory.length?'':'<div class="cs-text empty gear-empty">No structured equipment yet. Re-import a D&D Beyond PDF or add an item.</div>'}</div>`}
function addRow(btn){let mgr=btn.closest('.gear-manager'),list=mgr.querySelector('.gear-editor-list');list.insertAdjacentHTML('beforeend',itemEditorRow({id:uid(),name:'New Item',qty:1,category:'other'},false));let empty=mgr.querySelector('.gear-empty');if(empty)empty.remove()}
function removeRow(btn){btn.closest('.gear-editor-row')?.remove()}
function categoryChanged(sel){let row=sel.closest('.gear-editor-row');if(!row)return;if(sel.value==='armor'||sel.value==='shield'){let a=row.querySelector('[data-gear="ability"]');if(a)a.value='auto'}}
function equipChanged(box){let row=box.closest('.gear-editor-row'),mgr=box.closest('.gear-manager');if(!box.checked||!row||!mgr)return;let cat=row.querySelector('[data-gear="category"]')?.value;if(cat==='armor'||cat==='shield'){mgr.querySelectorAll('.gear-editor-row').forEach(r=>{if(r===row)return;let c=r.querySelector('[data-gear="category"]')?.value,b=r.querySelector('[data-gear="equipped"]');if(c===cat&&b)b.checked=false})}}
function collect(rootEl,p){let old=normalize(p),out={version:1,inventory:[],attackProfiles:clone(old.attackProfiles||[]),initialEquipMatched:true};rootEl.querySelectorAll('.gear-editor-row').forEach(row=>{let val=k=>row.querySelector(`[data-gear="${k}"]`)?.value??'';let chk=row.querySelector('[data-gear="equipped"]')?.checked||false;let item={id:row.dataset.gearId||uid(),name:val('name').trim(),qty:val('qty')||1,category:val('category')||'other',damageDie:val('damageDie').trim(),damageType:val('damageType').trim(),versatileDie:val('versatileDie').trim(),ability:val('ability')||'auto',properties:val('properties').trim(),weight:val('weight').trim(),equipped:chk};if(item.name)out.inventory.push(enrich(item))});return out}
function syncText(p){let g=normalize(p);p.sheet.equipment=g.inventory.map(i=>{let lead=String(i.qty||1)!=='1'?`${i.qty} × `:'';return `${lead}${i.name}${i.weight?` (${i.weight})`:''}`}).join('\n');return p}
function printReadiedHtml(p){let rows=weaponRows(p,true);if(!rows.length)return '';return `<div class="print-gear-table">${rows.map(r=>`<div class="print-gear-row"><b>${esc(r.name)}</b><span>Hit ${esc(r.attack)}</span><span>${esc(r.damage)}</span><small>${esc([r.notes,r.versatile].filter(Boolean).join(' · '))}</small></div>`).join('')}</div>`}
function printReferenceHtml(p){let rows=weaponRows(p,false);if(!rows.length)return '';return `<div class="print-ref-table">${rows.map(r=>`<div class="print-ref-row"><b>${esc(r.name)}${r.item.equipped?' ★':''}</b><span>${esc(r.item.damageDie||'—')}${r.item.versatileDie?` / ${esc(r.item.versatileDie)}`:''}</span><span>${esc(r.item.damageType||'')}</span><small>${esc(r.notes||'')}</small></div>`).join('')}</div>`}
root.CharacterEquipment={DB,normalize,enrich,attackInfo,weaponRows,inventoryLines,armorSuggestion,combatHtml,referenceHtml,inventoryHtml,sheetSummaryHtml,managerHtml,collect,syncText,addRow,removeRow,categoryChanged,equipChanged,printReadiedHtml,printReferenceHtml,keyName};
})(typeof window!=='undefined'?window:globalThis);
