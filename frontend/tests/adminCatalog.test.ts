import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeMatrix,splitAttributes,categoryDescendants,validateCatalog,catalogPayload,type CatalogState } from '../lib/admin-catalog';
const state=():CatalogState=>({product:{name:'Áo',slug:'ao',category_id:null,brand_id:null},variants:[],images:[]});
test('matrix regeneration preserves edited values, manual rows, sparse combinations and normalizes case',()=>{
  const rows=mergeMatrix([],['M'],['Đen'],'AO','100','2');rows[0].price='150';rows[0].sku='CUSTOM';
  rows.push({...rows[0],key:'manual',sku:'MANUAL',size:'XL',color:'Xanh'});
  const merged=mergeMatrix(rows,['m','L'],['đen','Trắng'],'AO','200','3');
  assert.equal(merged.length,5);assert.equal(merged[0].price,'150');assert.equal(merged[0].sku,'CUSTOM');assert.equal(merged[1].sku,'MANUAL');assert.equal(rows.length,2);
  assert.deepEqual(splitAttributes(' Đen, đen, Trắng,  Trắng  '),['Đen','Trắng']);
});
test('matrix cap and missing attributes do not mutate existing draft',()=>{
  const rows=mergeMatrix([],['M'],['Red'],'A','100','0');assert.throws(()=>mergeMatrix(rows,Array.from({length:201},(_,i)=>String(i)),['Red'],'A','0','0'));assert.equal(rows.length,1);
});
test('draft permits absent sale data, publish validates it, invalid numbers/duplicates get row paths',()=>{
  const draft=state();assert.deepEqual(validateCatalog(draft,false),{});assert.equal(Object.keys(validateCatalog(draft,true)).length,5);
  draft.variants=mergeMatrix([],['M'],['Đen'],'AO','-1','1.5');draft.variants.push({...draft.variants[0],color:'đen',size:'m'});
  const issues=validateCatalog(draft,false);assert.ok(issues['variants.0.price']);assert.ok(issues['variants.0.stock_quantity']);assert.ok(issues['variants.1.sku']);assert.ok(issues['variants.1.color']);
});
test('payload uses current versions, preserves zero sale/stock, removes client-only row metadata',()=>{
  const draft=state();draft.product.__v=2;draft.variants=[{_id:'id',__v:3,sku:'S',size:'M',color:'Red',price:'100',sale_price:'0',stock_quantity:'0',status:true}];const payload=JSON.parse(JSON.stringify(catalogPayload(draft,'save')));assert.equal(payload.expected_version,2);assert.equal(payload.variants[0].expected_version,3);assert.equal(payload.variants[0].sale_price,0);assert.equal(payload.variants[0].stock_quantity,0);assert.equal(payload.variants[0].__v,undefined);
});
test('category descendants detects indirect children and terminates on broken cycles',()=>{
  const nodes=[{_id:'a',name:'A',parent_id:'b'},{_id:'b',name:'B',parent_id:'a'},{_id:'c',name:'C',parent_id:{_id:'b'}}];assert.deepEqual([...categoryDescendants(nodes,'a')].sort(),['a','b','c']);
});
