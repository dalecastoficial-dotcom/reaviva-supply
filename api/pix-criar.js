const {json,uuid,configured,db,provider,requireAdmin,PROVIDER,amountCents}=require('./_pix-core');
const {sign}=require('./_checkout-token');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
 if(!configured())return json(res,503,{error:'pix_disabled'});
 if(!(process.env.PIX_CHECKOUT_SIGNING_KEY||'').match(/^.{32,}$/))return json(res,503,{error:'checkout_signing_key_missing'});
 try{
  if(!await requireAdmin(req))return json(res,403,{error:'admin_required'});
  const id=req.body?.order_id;if(!uuid(id))return json(res,400,{error:'invalid_order_id'});
  const rows=await db('orders','?select=id,protocol,status,total,customer_agreed,payment_status&limit=1&id=eq.'+id);
  const order=rows[0];if(!order)return json(res,404,{error:'order_not_found'});
  // Financial values must be verified by admin after supplier & freight calculation.
  if(order.status!=='confirmado'||order.customer_agreed!==true||!(Number(order.total)>0)||order.payment_status==='pago')return json(res,409,{error:'order_not_ready_for_charge'});
  const existing=await db('pix_charges','?select=id,provider_charge_id,amount_cents,status,qr_code_text,qr_image_url&order_id=eq.'+id+'&status=eq.pending&limit=1');
  if(existing.length)return json(res,200,{charge:existing[0],reused:true,checkoutPath:'/pagamento.html?token='+encodeURIComponent(sign(id,existing[0].id))});
  const cents=amountCents(order.total);if(!Number.isSafeInteger(cents)||cents<100)return json(res,409,{error:'invalid_amount'});
  const tx=await provider('/deposit',{method:'POST',body:JSON.stringify({amount:cents/100,description:'REAVIVA '+(order.protocol||id.slice(0,8))})});
  const transactionId=String(tx.transactionId||'');
  const qr=tx.qrCode||{};
  if(!transactionId||!qr.copyPaste)throw Error('provider_contract_incomplete');
  const charge={order_id:id,provider:PROVIDER,provider_charge_id:transactionId,amount_cents:cents,status:'pending',qr_code_text:qr.copyPaste,qr_image_url:qr.imageUrl||null};
  const rowsCharge=await db('pix_charges','?select=id,provider_charge_id,amount_cents,status,qr_code_text,qr_image_url',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(charge)});
  await db('orders','?id=eq.'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({payment_status:'aguardando_pagamento',payment_external_id:transactionId})});
  return json(res,201,{charge:rowsCharge[0],checkoutPath:'/pagamento.html?token='+encodeURIComponent(sign(id,rowsCharge[0].id))});
 }catch(e){console.error('pix_create_error',e.message);return json(res,502,{error:'charge_creation_failed_check_provider_and_db'})}
};
