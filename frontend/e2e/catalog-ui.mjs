import { expect, signIn, state, token, db, oid, unique } from './helpers.mjs';
import { randomUUID } from 'node:crypto';
export async function catalogWrite(path, body, key=randomUUID(), method='POST') {
  const response=await fetch(state.api+path,{method,headers:{Authorization:`Bearer ${await token('admin')}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)});
  return {status:response.status,body:await response.json()};
}
export async function openProducts(page){await signIn(page,'admin');await page.goto('/admin#products');await expect(page.getByRole('heading',{name:'Quản lý sản phẩm',exact:true})).toBeVisible();}
export async function openProduct(page, product){await openProducts(page);await page.getByPlaceholder('Tên hoặc mã sản phẩm').fill(product.name);await page.getByRole('button',{name:`Quản lý ${product.name}`,exact:true}).click();await expect(page.getByRole('region',{name:'Workspace sản phẩm'})).toBeVisible();}
export async function fillBasic(page,name){await page.getByRole('button',{name:'Tạo sản phẩm mới',exact:true}).click();await page.getByLabel('Tên sản phẩm',{exact:true}).fill(name);await page.getByLabel('Mã sản phẩm',{exact:true}).fill(unique('QA').toUpperCase());await page.getByRole('region',{name:'Workspace sản phẩm'}).getByRole('combobox',{name:'Danh mục',exact:true}).selectOption(state.category);await page.getByRole('region',{name:'Workspace sản phẩm'}).getByRole('combobox',{name:'Thương hiệu',exact:true}).selectOption(state.brand);await page.getByLabel('Chất liệu',{exact:true}).fill('Cotton QA');await page.getByLabel('Hướng dẫn bảo quản',{exact:true}).fill('Giặt nhẹ QA');}
export async function matrix(page,sizes='M',colors='Đen',price='150000',stock='8'){
  await page.getByRole('button',{name:'Biến thể',exact:true}).click();await page.getByLabel('Size (cách nhau bằng dấu phẩy)').fill(sizes);await page.getByLabel('Màu (cách nhau bằng dấu phẩy)').fill(colors);await page.getByLabel('Giá mặc định',{exact:true}).fill(price);await page.getByLabel('Tồn đầu mặc định',{exact:true}).fill(stock);await page.getByRole('button',{name:'Tạo tổ hợp SKU',exact:true}).click();
}
export async function image(page,url=state.web+'/images/products/1.jpg',color=''){
  await page.getByRole('button',{name:'Hình ảnh',exact:true}).click();await page.getByLabel('Hoặc đường dẫn ảnh',{exact:true}).fill(url);await page.getByRole('button',{name:'Thêm ảnh từ URL',exact:true}).click();if(color)await page.getByLabel(`Màu ảnh ${await page.locator('.catalog-image').count()}`,{exact:true}).selectOption(color);
}
export async function saveProduct(page,action='Xuất bản sản phẩm'){
  await page.getByRole('button',{name:'Kiểm tra',exact:true}).click();await page.getByRole('button',{name:action,exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Xác nhận',exact:true}).click();await expect(page.getByText('Đã lưu thông tin, SKU và ảnh nhất quán.',{exact:true})).toBeVisible();
}
export async function publishExisting(id){
  const response=await fetch(`${state.api}/products/${id}/admin/workspace`,{headers:{Authorization:`Bearer ${await token('admin')}`}});const s=(await response.json()).data;
  const result=await catalogWrite(`/products/${id}/admin/workspace`,{product:{...s.product,product_code:s.product.product_code||unique('QA').toUpperCase()},action:'publish',expected_version:s.product.__v,variants:s.variants.map(v=>({...v,expected_version:v.__v})),images:s.images},undefined,'PATCH');expect(result.status).toBe(200);return result.body.data;
}
export async function captureCatalog(page,name){await page.screenshot({path:(await import('@playwright/test')).test.info().outputPath(name+'.png'),fullPage:true});}
export async function findProduct(name){const product=await db.collection('products').findOne({name});expect(product).toBeTruthy();return {...product,_id:String(product._id)};}
