// Checkout público simples: cria pedido a partir do preço do catálogo e emite Pix.
// Nunca aceita total/preço do navegador nem confirmação de pagamento do cliente.
const {randomUUID}=require('crypto');
const {json,configured,db,provider,PROVIDER,amountCents}=require('./_pix-core');
const {sign}=require('./_checkout-token');
const clean=(v,n=120)=>String(v??'').trim().slice(0,n);
const validUUID=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
module.exports=async(req,res)=>{
 if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
 if(!configured())return json(res,503,{error:'pix_disabled'});
 if((process.env.PIX_CHECKOUT_SIGNING_KEY||'').length<32)return json(res,503,{error:'checkout_signing_key_missing'});
 try{
  let d=req.body;if(typeof d==='string')d=JSON.parse(d);if(!d||typeof d!=='object')return json(res,400,{error:'invalid_request'});
  if(d.website)return json(res,200,{status:'received'});
  const productId=clean(d.product_id,40),name=clean(d.customer_name),phone=clean(d.customer_phone,25).replace(/\D/g,''),email=clean(d.customer_email,150),cep=clean(d.cep,12).replace(/\D/g,''),size=clean(d.size,30),color=clean(d.color,50),quantity=Number(d.quantity);
  const street=clean(d.street,140),number=clean(d.number,15),complement=clean(d.complement,100),neighborhood=clean(d.neighborhood,100),city=clean(d.city,100),state=clean(d.state,2).toUpperCase(),notes=clean(d.customer_notes,500);
  if(!validUUID(productId)||name.length<2||!/^(?:55)?\d{10,11}$/.test(phone)||!/^\d{8}$/.test(cep)||!Number.isInteger(quantity)||quantity<1||quantity>10||!street||!number||!neighborhood||!city||!/^[A-Z]{2}$/.test(state)||d.privacy_agreed!==true||email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return json(res,400,{error:'Confira os campos e aceite o tratamento de dados.'});
  const products=await db('products','?select=id,name,price,sizes,colors,active&id=eq.'+productId+'&active=eq.true&limit=1');
  const product=products?.[0];if(!product)return json(res,404,{error:'product_unavailable'});
  if(!product.sizes?.includes(size)||!product.colors?.includes(color))return json(res,400,{error:'invalid_size_or_color'});
  const unit=Number(product.price);if(!Number.isFinite(unit)||unit<=0)return json(res,409,{error:'product_price_not_configured'});
  const cents=amountCents(unit*quantity);if(!Number.isSafeInteger(cents)||cents<100)return json(res,409,{error:'invalid_amount'});
  const protocol='RV-'+randomUUID().split('-')[0].toUpperCase();
  // Valor cobrado vem exclusivamente do preço ativo no Supabase. Frete não é cobrado aqui.
  const order={customer_name:name,customer_phone:phone,product_name:product.name,size,color,quantity,total:cents/100,status:'solicitado',customer_agreed:true,customer_email:email||null,cep,street,number,complement,neighborhood,city,state,customer_notes:notes,product_id:product.id,payment_method:'pix',payment_status:'aguardando_pagamento',protocol,notes:'Pedido pelo checkout Pix. Total cobrado = subtotal dos produtos; frete a combinar separadamente. Separação depende de confirmação de disponibilidade.'};
  const created=await db('orders','?select=id,protocol,total',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(order)});
  const saved=created?.[0];if(!saved?.id)throw Error('order_insert_failed');
  const tx=await provider('/deposit',{method:'POST',body:JSON.stringify({amount:cents/100,description:'REAVIVA '+protocol})});
  const providerId=String(tx.transactionId||'');const qr=tx.qrCode||{};
  if(!providerId||!qr.copyPaste)throw Error('provider_contract_incomplete');
  const inserted=await db('pix_charges','?select=id,provider_charge_id,amount_cents,status',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({order_id:saved.id,provider:PROVIDER,provider_charge_id:providerId,amount_cents:cents,status:'pending',qr_code_text:qr.copyPaste,qr_image_url:qr.imageUrl||null})});
  const charge=inserted?.[0];if(!charge?.id)throw Error('charge_insert_failed');
  await db('orders','?id=eq.'+saved.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({payment_status:'aguardando_pagamento',payment_external_id:providerId})});
  return json(res,201,{protocol,checkoutPath:'/pagamento.html?token='+encodeURIComponent(sign(saved.id,charge.id)),amount:cents/100});
 }catch(e){console.error('public_pix_checkout_error',e.message);return json(res,502,{error:'Não foi possível gerar o Pix. Se houve registro do pedido, entre em contato com a loja antes de tentar novamente.'})}
};
