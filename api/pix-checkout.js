const {json,configured,db}=require('./_pix-core');
const {verify}=require('./_checkout-token');
module.exports=async(req,res)=>{
 if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
 if(!configured())return json(res,503,{error:'pix_disabled'});
 const info=verify(req.query?.token);if(!info)return json(res,403,{error:'invalid_or_expired_link'});
 try{
  const charges=await db('pix_charges','?select=id,order_id,amount_cents,status,qr_code_text,qr_image_url&order_id=eq.'+info.o+'&id=eq.'+info.c+'&limit=1');
  const charge=charges?.[0];if(!charge)return json(res,404,{error:'charge_not_found'});
  const orders=await db('orders','?select=id,protocol,status,payment_status,total&limit=1&id=eq.'+info.o);const order=orders?.[0];if(!order)return json(res,404,{error:'order_not_found'});
  const paid=charge.status==='paid'&&order.payment_status==='pago';
  return json(res,200,{protocol:order.protocol||null,amount:charge.amount_cents/100,status:paid?'paid':charge.status==='pending'?'pending':'unavailable',qrCode:paid?null:charge.status==='pending'?{copyPaste:charge.qr_code_text,imageUrl:/^https:\/\//i.test(charge.qr_image_url||'')?charge.qr_image_url:null}:null});
 }catch(e){console.error('checkout_query_failed',e.message);return json(res,502,{error:'checkout_unavailable'})}
};
