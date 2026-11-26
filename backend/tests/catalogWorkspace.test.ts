import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import productRoutes from "../src/routes/productRoutes.js";
import categoryRoutes from "../src/routes/categoryRoutes.js";
import brandRoutes from "../src/routes/brandRoutes.js";
import adminRoutes from "../src/routes/adminRoutes.js";
import LegacyProduct from "../src/models/storefrontProductModel.js";
import SizeRule from "../src/models/sizeRecommendationModel.js";
import Product from "../src/models/productModel.js";
import Variant from "../src/models/productVariantModel.js";
import Image from "../src/models/productImageModel.js";
import Category from "../src/models/categoryModel.js";
import Brand from "../src/models/brandModel.js";
import User from "../src/models/userModel.js";
import Detail from "../src/models/orderDetailModel.js";
import Movement from "../src/models/inventoryMovementModel.js";
import Receipt from "../src/models/catalogWriteReceiptModel.js";
import Mutex from "../src/models/catalogMutexModel.js";
import { errorHandler } from "../src/middlewares/errorMiddleware.js";
import { legacyBundle } from "../src/services/catalogLegacyAdapter.js";
import { parseCatalogBundle, publicationIssues } from "../src/services/catalogValidation.js";
import { visibleCategoryIds } from "../src/services/categoryPolicy.js";

// The explicitly approved QA tool lives in frontend devDependencies. No .env is read.
const { MongoMemoryReplSet } = createRequire(new URL("../../frontend/package.json",import.meta.url))("mongodb-memory-server");
let repl: { getUri(name:string):string; stop():Promise<void> }, base:string, access:string, actor:mongoose.Types.ObjectId, category:mongoose.Types.ObjectId, brand:mongoose.Types.ObjectId;
const secretBefore=process.env.JWT_SECRET;
const app=express();app.use(express.json());app.use('/products',productRoutes);app.use('/categories',categoryRoutes);app.use('/brands',brandRoutes);app.use('/admin',adminRoutes);app.use(errorHandler);
const server=app.listen(0,'127.0.0.1');
before(async()=>{
  repl=await MongoMemoryReplSet.create({replSet:{count:1,ip:'127.0.0.1',storageEngine:'wiredTiger'}});
  const uri=repl.getUri(`fstyle_catalog_test_${randomUUID().replaceAll('-','')}`);
  assert.match(uri,/^mongodb:\/\/127\.0\.0\.1:/);await mongoose.connect(uri);
  await Promise.all(Object.values(mongoose.models).map(model=>model.init()));
  await Mutex.create({_id:'categories',revision:0});
  const user=await User.create({name:'Catalog QA',email:'catalog@e2e.invalid',password:'not-a-real-login-password',role:'admin'});actor=user._id;
  process.env.JWT_SECRET=randomUUID();access=jwt.sign({id:String(actor),role:'admin'},process.env.JWT_SECRET);
  base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(async()=>{
  await Promise.all([Product.deleteMany({}),Variant.deleteMany({}),Image.deleteMany({}),Category.deleteMany({}),Brand.deleteMany({}),Detail.deleteMany({}),Movement.deleteMany({}),Receipt.deleteMany({}),LegacyProduct.deleteMany({}),SizeRule.deleteMany({})]);
  category=(await Category.create({name:'QA Áo',slug:'qa-ao'}))._id;brand=(await Brand.create({name:'QA Brand',slug:'qa-brand'}))._id;
});
after(async()=>{await mongoose.disconnect();if(repl)await repl.stop();await new Promise<void>(resolve=>server.close(()=>resolve()));if(secretBefore===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=secretBefore;});
async function call(path:string,method='GET',body?:unknown,key?:string,auth:string|null=access){
  const response=await fetch(base+path,{method,headers:{...(auth?{Authorization:`Bearer ${auth}`} :{}),'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  return {status:response.status,body:await response.json()};
}
function bundle(action='draft') {return {product:{name:'Áo QA',slug:'ao-qa',product_code:'AO-QA',category_id:String(category),brand_id:String(brand),material:'Cotton',care_instructions:'Giặt nhẹ'},variants:[{sku:'QA-M-DEN',size:'M',color:'Đen',price:200000,sale_price:null,stock_quantity:5,status:true}],images:[{image_url:'https://qa.invalid/a.jpg',is_primary:true,color:'Đen'}],action};}
async function create(action='draft'){const result=await call('/products/admin/workspace','POST',bundle(action),randomUUID());assert.equal(result.status,201,JSON.stringify(result.body));return result.body.data;}
async function editBody(id:string,action='save'){return {...await legacyBundle(id),action};}

test('CAT-P01 draft without variants/images is private, generic create also drafts',async()=>{
  const input=bundle();input.variants=[];input.images=[];
  const saved=await call('/products/admin/workspace','POST',input,randomUUID());assert.equal(saved.status,201);assert.equal(saved.body.data.product.status,false);
  assert.equal((await call(`/products/${saved.body.data.product._id}`)).status,404);
  const generic=await call('/products','POST',{name:'Draft generic',slug:'draft-generic'});assert.equal(generic.status,201);assert.equal(generic.body.data.publication_state,'draft');
  assert.equal((await call('/products','POST',{name:'Bad',slug:'bad',status:true})).status,400);
});
test('CAT-P02 publish requires code/category/brand/image/active SKU; out of stock may publish',async()=>{
  for(const missing of ['product_code','category_id','brand_id','images','variants']){
    const input:any=bundle('publish');if(missing==='images'||missing==='variants')input[missing]=[];else delete input.product[missing];
    assert.equal((await call('/products/admin/workspace','POST',input,randomUUID())).status,400,missing);
  }
  assert.equal(await Product.countDocuments(),0);
  const input=bundle('publish');input.variants[0]!.stock_quantity=0;
  const saved=await call('/products/admin/workspace','POST',input,randomUUID());assert.equal(saved.status,201);assert.equal((await call(`/products/${saved.body.data.product._id}`)).body.data.variants[0].stock_quantity,0);
});
test('CAT-P03 sparse matrix, per-SKU prices, initial stock ledger and color images persist',async()=>{
  const input=bundle('publish');input.variants.push({...input.variants[0]!,sku:'QA-L-DEN',size:'L',price:240000,stock_quantity:0},{...input.variants[0]!,sku:'QA-M-TRANG',color:'Trắng',price:220000});
  const saved=await call('/products/admin/workspace','POST',input,randomUUID());assert.equal(saved.status,201);
  const id=saved.body.data.product._id;const publicResult=await call(`/products/${id}`);assert.deepEqual(publicResult.body.data.variants.map((row:any)=>row.price),[200000,240000,220000]);
  assert.equal(await Movement.countDocuments({kind:'initial_stock'}),3);assert.equal(saved.body.data.images[0].color,'Đen');assert.equal(publicResult.body.data.material,'Cotton');
});
test('CAT-P04 numeric edge cases and case-insensitive pair/SKU duplicates leave no partial data',async()=>{
  for(const patch of [{price:-1},{price:1.2},{price:'abc'},{sale_price:300000},{stock_quantity:-1},{stock_quantity:1.5}]){
    const input:any=bundle();Object.assign(input.variants[0],patch);assert.equal((await call('/products/admin/workspace','POST',input,randomUUID())).status,400);
  }
  const duplicate=bundle();duplicate.variants.push({...duplicate.variants[0]!,sku:'OTHER',color:'  đen  ',size:'m'});assert.equal((await call('/products/admin/workspace','POST',duplicate,randomUUID())).status,400);
  duplicate.variants[1]={...duplicate.variants[0]!,size:'L'};assert.equal((await call('/products/admin/workspace','POST',duplicate,randomUUID())).status,400);
  assert.equal(await Product.countDocuments(),0);assert.equal(await Movement.countDocuments(),0);
});
test('CAT-P05 transaction rolls product, stock ledger and images back when a later row conflicts',async()=>{
  await create();const input=bundle();input.product.slug='second';input.product.product_code='SECOND';input.variants.unshift({...input.variants[0]!,sku:'SECOND-M-TRANG',color:'Trắng'});
  const saved=await call('/products/admin/workspace','POST',input,randomUUID());assert.equal(saved.status,409);assert.equal(await Product.countDocuments(),1);assert.equal(await Variant.countDocuments(),1);assert.equal(await Movement.countDocuments(),1);assert.equal(await Image.countDocuments(),1);
});
test('CAT-P06 duplicate submission and lost response replay exactly once; changed payload rejected',async()=>{
  const input=bundle(),key=randomUUID();const results=await Promise.all([call('/products/admin/workspace','POST',input,key),call('/products/admin/workspace','POST',input,key)]);
  assert.ok(results.every(row=>[200,201].includes(row.status)),JSON.stringify(results));assert.equal(await Product.countDocuments(),1);assert.equal(await Movement.countDocuments(),1);
  const receipt=await call(`/products/admin/requests/${key}`);assert.equal(receipt.status,200);assert.equal(receipt.body.data.product._id,results[0]!.body.data.product._id);
  assert.equal((await call('/products/admin/workspace','POST',{...input,product:{...input.product,name:'changed'}},key)).status,409);
});
test('CAT-P07 two admins from same version: exactly one wins, no lost update',async()=>{
  const state=await create(),id=state.product._id,input=await editBody(id);const second=structuredClone(input);input.product.name='Admin A';second.product.name='Admin B';
  const results=await Promise.all([call(`/products/${id}/admin/workspace`,'PATCH',input,randomUUID()),call(`/products/${id}/admin/workspace`,'PATCH',second,randomUUID())]);assert.deepEqual(results.map(row=>row.status).sort(),[200,409]);
});
test('CAT-P08 product editor cannot adjust persisted stock; stale warehouse version rejected',async()=>{
  const state=await create(),id=state.product._id,sku=state.variants[0],input=await editBody(id);input.variants[0]!.stock_quantity=30;
  assert.equal((await call(`/products/${id}/admin/workspace`,'PATCH',input,randomUUID())).status,400);assert.equal((await Variant.findById(sku._id))!.stock_quantity,5);
  const fresh=await editBody(id);await Variant.updateOne({_id:sku._id},{$inc:{__v:1,stock_quantity:-1}});
  assert.equal((await call(`/products/${id}/admin/workspace`,'PATCH',fresh,randomUUID())).status,409);
});
test('CAT-P09 historical SKU identity protected, soft hide retains order/images/stock',async()=>{
  const state=await create('publish'),id=state.product._id,sku=state.variants[0];
  await Detail.collection.insertOne({order_id:new mongoose.Types.ObjectId(),product_variant_id:new mongoose.Types.ObjectId(sku._id),quantity:2,price:200000});
  const input=await editBody(id);input.variants[0]!.size='L';assert.equal((await call(`/products/${id}/admin/workspace`,'PATCH',input,randomUUID())).status,400);
  assert.equal((await call(`/products/${id}`,'DELETE')).status,200);assert.equal(await Detail.countDocuments(),1);assert.equal(await Image.countDocuments(),1);assert.equal((await Variant.findById(sku._id))!.stock_quantity,5);assert.equal((await call(`/products/${id}`)).status,404);
});
test('CAT-P10 generic single/batch variant APIs share canonical uniqueness and stock rules',async()=>{
  const state=await create(),id=state.product._id,sku=state.variants[0];
  assert.equal((await call(`/products/${id}/variants`,'POST',{sku:'DIFFERENT',size:'m',color:'đen',price:100})).status,409);
  const result=await call(`/products/${id}/variants`,'POST',{sku:'  new-l-red ',size:' L ',color:' Red ',price:100,stock_quantity:2});assert.equal(result.status,201);assert.equal(result.body.data.sku,'NEW-L-RED');
  assert.equal((await call(`/products/${id}/variants/${sku._id}`,'PATCH',{stock_quantity:20,expected_version:sku.__v??0})).status,400);
  const batch=await call(`/products/${id}/variants/batch`,'POST',{variants:[{sku:'X',size:'XL',color:'Red',price:100},{sku:'Y',size:'xl',color:'red',price:100}]});assert.equal(batch.status,409);assert.equal(await Variant.countDocuments(),2);
});
test('CAT-P11 generic price patch validates sale merge, version, foreign ownership; soft stop preserved',async()=>{
  const state=await create(),id=state.product._id,sku=state.variants[0];
  assert.equal((await call(`/products/${id}/variants/${sku._id}`,'PATCH',{price:100})).status,400);
  assert.equal((await call(`/products/${id}/variants/${sku._id}`,'PATCH',{price:100,sale_price:200,expected_version:0})).status,400);
  const changed=await call(`/products/${id}/variants/${sku._id}`,'PATCH',{price:100,sale_price:null,expected_version:0});assert.equal(changed.status,200);
  assert.equal((await call(`/products/${id}/variants/${sku._id}`,'PATCH',{price:200,expected_version:0})).status,409);
  assert.equal((await call(`/products/${id}/variants/${new mongoose.Types.ObjectId()}`,'DELETE')).status,404);
  assert.equal((await call(`/products/${id}/variants/${sku._id}`,'DELETE')).status,200);assert.equal((await Variant.findById(sku._id))!.status,false);
});
test('CAT-P12 image primary/order mutations atomic and published product cannot lose last image',async()=>{
  const state=await create('publish'),id=state.product._id,image=state.images[0];
  assert.equal((await call(`/products/${id}/images/${image._id}`,'DELETE')).status,400);assert.equal(await Image.countDocuments(),1);
  const added=await call(`/products/${id}/images`,'POST',{image_url:'https://qa.invalid/b.jpg',display_order:1,is_primary:true,color:'Đen'});assert.equal(added.status,201);
  assert.equal(await Image.countDocuments({is_primary:true}),1);
  const broken=await call(`/products/${id}/images/${image._id}`,'PATCH',{image_url:'javascript:alert(1)',is_primary:true});assert.equal(broken.status,400);assert.equal((await Image.findOne({is_primary:true}))!.image_url,'https://qa.invalid/b.jpg');
});
test('CAT-C01 category create valid/idempotent; slug validation and alias conflicts',async()=>{
  const key=randomUUID(),input={name:'Áo khoác',slug:'ao-khoac',parent_id:String(category)};
  assert.equal((await call('/categories','POST',input,key)).status,201);assert.equal((await call('/categories','POST',input,key)).status,200);
  assert.equal((await call('/categories','POST',{...input,slug:'bad slug'})).status,400);assert.equal((await call('/categories','POST',input)).status,409);
  assert.equal((await call('/categories','POST',{name:'',slug:'empty'})).status,400);assert.equal((await call('/categories','POST',{name:'X',slug:'x',image:'javascript:evil'})).status,400);
});
test('CAT-C02 parent missing/inactive/self/descendant and concurrent cycles rejected',async()=>{
  assert.equal((await call('/categories','POST',{name:'X',slug:'x',parent_id:String(new mongoose.Types.ObjectId())})).status,404);
  const a=await Category.create({name:'A',slug:'a'}),b=await Category.create({name:'B',slug:'b'});
  const concurrent=await Promise.all([call(`/categories/${a._id}`,'PATCH',{parent_id:String(b._id),expected_version:0}),call(`/categories/${b._id}`,'PATCH',{parent_id:String(a._id),expected_version:0})]);assert.deepEqual(concurrent.map(row=>row.status).sort(),[200,409]);
  assert.equal((await call(`/categories/${category}`,'PATCH',{parent_id:String(category),expected_version:0})).status,409);
  await Category.updateOne({_id:category},{$set:{status:false}});assert.equal((await call('/categories','POST',{name:'Hidden child',slug:'hidden-child',parent_id:String(category)})).status,409);
});
test('CAT-C03 hide ancestor removes branch from public list but keeps product purchasable/detail',async()=>{
  const state=await create('publish'),child=await Category.create({name:'Child',slug:'child',parent_id:category});
  assert.equal((await call(`/categories/${category}`,'PATCH',{status:false,expected_version:0})).status,200);
  const list=await call('/categories');assert.ok(!list.body.data.some((row:any)=>[String(category),String(child._id)].includes(row._id)));
  assert.equal((await call('/categories/resolve/child')).body.data.visible,false);assert.equal((await call(`/products/${state.product._id}`)).status,200);
  const attempt=await editBody(state.product._id,'publish');assert.equal((await call(`/products/${state.product._id}/admin/workspace`,'PATCH',attempt,randomUUID())).status,409);
});
test('CAT-C04 rename preserves canonical alias and reserved roots, rejects stale version',async()=>{
  assert.equal((await call(`/categories/${category}`,'PATCH',{slug:'ao-moi',expected_version:0})).status,200);
  assert.equal((await call('/categories/resolve/qa-ao')).body.data.canonical_slug,'ao-moi');
  assert.equal((await call('/categories','POST',{name:'Taken alias',slug:'qa-ao'})).status,409);
  assert.equal((await call(`/categories/${category}`,'PATCH',{name:'Stale',expected_version:0})).status,409);
  const men=await Category.create({name:'Nam',slug:'nam'});assert.equal((await call(`/categories/${men._id}`,'PATCH',{slug:'men',expected_version:0})).status,409);
});
test('CAT-C05 delete impact blocks products/children/rules, deletes only empty category',async()=>{
  await create();const impact=await call(`/categories/${category}/impact`);assert.equal(impact.body.data.can_delete,false);assert.equal(impact.body.data.direct_products,1);
  assert.equal((await call(`/categories/${category}`,'DELETE')).status,409);assert.equal(await Product.countDocuments(),1);
  const parent=await Category.create({name:'Parent',slug:'parent'});await Category.create({name:'Child',slug:'child',parent_id:parent._id});
  const branch=await call(`/categories/${parent._id}/impact`);assert.equal(branch.body.data.children,1);assert.equal((await call(`/categories/${parent._id}`,'DELETE')).status,409);
  const referenced=await Category.create({name:'Size ref',slug:'size-ref'});await SizeRule.collection.insertOne({category_id:referenced._id});
  assert.equal((await call(`/categories/${referenced._id}/impact`)).body.data.size_rules,1);assert.equal((await call(`/categories/${referenced._id}`,'DELETE')).status,409);
  const reserved=await Category.create({name:'Nam',slug:'nam'});assert.equal((await call(`/categories/${reserved._id}`,'DELETE')).status,409);
  const empty=await Category.create({name:'Empty',slug:'empty'});assert.equal((await call(`/categories/${empty._id}`,'DELETE')).status,200);assert.equal(await Product.countDocuments(),1);
});
test('CAT-FIRST-WRITE same-key concurrency also works before the mutex record exists',async()=>{
  await Mutex.deleteOne({_id:'categories'});
  const key=randomUUID(),input=bundle();
  const results=await Promise.all([call('/products/admin/workspace','POST',input,key),call('/products/admin/workspace','POST',input,key)]);
  assert.ok(results.every(result=>[200,201].includes(result.status)),JSON.stringify(results));
  assert.equal(await Product.countDocuments(),1);assert.equal(await Receipt.countDocuments(),1);
});
test('CAT-AUTH admin-only workspace/list/writes including all=true and request receipts',async()=>{
  for(const path of ['/products/admin','/categories/admin','/categories?all=true','/products/admin/requests/nonexistent']){
    assert.equal((await call(path,'GET',undefined,undefined,null)).status,401,path);
    const customer=await User.create({name:'Customer',email:randomUUID()+'@e2e.invalid',password:'test',role:'customer'});const customerToken=jwt.sign({id:String(customer._id),role:'customer'},process.env.JWT_SECRET!);
    assert.equal((await call(path,'GET',undefined,undefined,customerToken)).status,403,path);
  }
});
test('CAT-VALIDATION malformed input and broken historical trees fail closed',()=>{
  for(const input of [null,[],{}, {product:{name:'a'},variants:'bad',images:[],action:'draft'}])assert.throws(()=>parseCatalogBundle(input));
  assert.equal(publicationIssues(parseCatalogBundle({product:{name:'A',slug:'a'},variants:[],images:[],action:'draft'})).length,5);
  assert.deepEqual([...visibleCategoryIds([{_id:'a',parent_id:'b',status:true},{_id:'b',parent_id:'a',status:true}])],[]);
});
test('CAT-C06 category delete and product assignment cannot create dangling reference',async()=>{
  const input=bundle();input.variants=[];input.images=[];
  const [removed,created]=await Promise.all([call(`/categories/${category}`,'DELETE'),call('/products/admin/workspace','POST',input,randomUUID())]);
  assert.ok((removed.status===200&&created.status===404)||(removed.status===409&&created.status===201),JSON.stringify({removed,created}));
  if(await Product.countDocuments())assert.ok(await Category.exists({_id:category}));
});
test('CAT-C07 inactive brand blocks publication, concurrent brand delete/assignment stays consistent',async()=>{
  await Brand.updateOne({_id:brand},{$set:{status:false}});assert.equal((await call('/products/admin/workspace','POST',bundle('publish'),randomUUID())).status,409);
  await Brand.updateOne({_id:brand},{$set:{status:true}});
  const [removed,created]=await Promise.all([call(`/brands/${brand}`,'DELETE'),call('/products/admin/workspace','POST',bundle(),randomUUID())]);
  assert.ok((removed.status===200&&created.status===404)||(removed.status===409&&created.status===201),JSON.stringify({removed,created}));
  if(await Product.countDocuments())assert.ok(await Brand.exists({_id:brand}));
});
test('CAT-P13 cannot omit persisted SKU, use foreign image or remove last active published SKU',async()=>{
  const state=await create('publish'),id=state.product._id;
  const omitted=await editBody(id);omitted.variants=[];assert.equal((await call(`/products/${id}/admin/workspace`,'PATCH',omitted,randomUUID())).status,400);
  const foreign=await editBody(id);foreign.images[0]!._id=String(new mongoose.Types.ObjectId());foreign.product.name='Do not save';assert.equal((await call(`/products/${id}/admin/workspace`,'PATCH',foreign,randomUUID())).status,409);assert.equal((await Product.findById(id))!.name,'Áo QA');
  const stop=await call(`/products/${id}/variants/${state.variants[0]._id}`,'DELETE');assert.equal(stop.status,400);assert.equal((await Variant.findById(state.variants[0]._id))!.status,true);
});
test('CAT-LEGACY preserved response shape and category assignment/delete serialization',async()=>{
  const body={name:'Legacy QA',code:'LEGACY-QA',color:'Đen',sizes:['M'],price:100000,image:'/uploads/fixture.png',categoryId:String(category)};
  const created=await call('/admin/products','POST',body);assert.equal(created.status,201);assert.equal(created.body.data.code,body.code);assert.equal(created.body.data.price,body.price);
  assert.equal((await call(`/admin/products/${created.body.data._id}`,'PUT',{...body,name:'Legacy edited'})).status,200);
  assert.equal((await call(`/categories/${category}`,'DELETE')).status,409);assert.equal(await LegacyProduct.countDocuments(),1);
  await LegacyProduct.deleteMany({});
  const [removed,assigned]=await Promise.all([call(`/categories/${category}`,'DELETE'),call('/admin/products','POST',body)]);
  assert.ok((removed.status===200&&assigned.status===404)||(removed.status===409&&assigned.status===201),JSON.stringify({removed,assigned}));
});
test('CAT-STAFF category options remain readable for Outfit/size while catalog writes stay forbidden',async()=>{
  const staff=await User.create({name:'Staff',email:randomUUID()+'@e2e.invalid',password:'test',role:'staff'}),staffToken=jwt.sign({id:String(staff._id),role:'staff'},process.env.JWT_SECRET!);
  assert.equal((await call('/categories?all=true','GET',undefined,undefined,staffToken)).status,200);
  assert.equal((await call('/categories','POST',{name:'No',slug:'no'},undefined,staffToken)).status,403);
  assert.equal((await call('/products/admin/workspace','POST',bundle(),randomUUID(),staffToken)).status,403);
});
test('CAT-COLOR new sizes share one canonical color label across workspace and single API',async()=>{
  const input=bundle('publish');input.variants.push({...input.variants[0]!,sku:'QA-L-DEN',size:'L',color:'đen'});
  const created=await call('/products/admin/workspace','POST',input,randomUUID());assert.equal(created.status,201);
  const id=created.body.data.product._id;
  const publicResult=await call(`/products/${id}`);assert.deepEqual([...new Set(publicResult.body.data.variants.map((row:any)=>row.color))],['Đen']);
  const added=await call(`/products/${id}/variants`,'POST',{sku:'QA-XL-DEN',size:'XL',color:' ĐEN ',price:250000,stock_quantity:2});assert.equal(added.status,201);assert.equal(added.body.data.color,'Đen');
});
