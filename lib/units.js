const MASS = {mg:0.001,g:1,gram:1,grams:1,kg:1000,kilogram:1000,kilograms:1000};
const VOLUME = {ml:1,milliliter:1,milliliters:1,l:1000,liter:1000,liters:1000,tsp:4.92892,teaspoon:4.92892,teaspoons:4.92892,tbsp:14.7868,tablespoon:14.7868,tablespoons:14.7868,cup:236.588,cups:236.588};
function cleanUnit(unit=''){return String(unit).trim().toLowerCase().replace(/\./g,'')}
function parseFraction(s=''){const x=String(s).trim();if(!x)return null;if(/^\d+\s+\d+\/\d+$/.test(x)){const [a,f]=x.split(/\s+/),[n,d]=f.split('/').map(Number);return Number(a)+n/d}if(/^\d+\/\d+$/.test(x)){const [n,d]=x.split('/').map(Number);return d?n/d:null}const n=Number(x.replace(',','.'));return Number.isFinite(n)?n:null}
function parseAmount(amount=''){
 const raw=String(amount||'').trim();if(!raw)return {quantity:null,unit:'',note:''};
 const m=raw.match(/^\s*(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*([a-zA-Z]+)?\b\s*(.*)$/);
 if(!m)return {quantity:null,unit:'',note:raw};
 return {quantity:parseFraction(m[1]),unit:cleanUnit(m[2]||''),note:String(m[3]||'').trim()};
}
function canonical(quantity,unit){unit=cleanUnit(unit);if(quantity==null)return {quantity:null,unit,dimension:'unknown'};if(MASS[unit])return {quantity:quantity*MASS[unit],unit:'g',dimension:'mass'};if(VOLUME[unit])return {quantity:quantity*VOLUME[unit],unit:'ml',dimension:'volume'};return {quantity,unit,dimension:unit?'counted':'count'} }
function combine(a,b){const ca=canonical(a.quantity,a.unit),cb=canonical(b.quantity,b.unit);if(ca.quantity==null||cb.quantity==null||ca.dimension!==cb.dimension||ca.unit!==cb.unit)return null;return {quantity:ca.quantity+cb.quantity,unit:ca.unit,dimension:ca.dimension}}
function pretty(quantity,unit){if(quantity==null)return {quantity:null,unit};if(unit==='g'&&quantity>=1000)return {quantity:Number((quantity/1000).toFixed(2)),unit:'kg'};if(unit==='ml'&&quantity>=1000)return {quantity:Number((quantity/1000).toFixed(2)),unit:'l'};return {quantity:Number(Number(quantity).toFixed(2)),unit}}
module.exports={cleanUnit,parseFraction,parseAmount,canonical,combine,pretty};
