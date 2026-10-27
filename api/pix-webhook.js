const crypto=require('crypto');
const {json,configured,db,provider,reconcile}=require('./_pix-core');
// Read raw bytes before any JSON parsing. Vercel Node serverless respects config below.
const handler=async(req,res)=>{
 if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
 if(!configured())return json(res,503,{error:'pix_disabled'});
 try{
  let chunks=[],len=0;
  for await(const chunk of req){len+=chunk.length;if(len>131072)return json(res,413,{error:'payload_too_large'});chunks.push(chunk)}
  const raw=Buffer.concat(chunks);
  const signature=String(req.headers['x-signature']||'').trim().replace(/^sha256=/i,'');
  if(!/^[0-9a-f]{64}$/i.test(signature))return json(res,401,{error:'invalid_signature'});
  const expected=crypto.createHmac('sha256',process.env.PIX_WEBHOOK_SECRET).update(raw).digest();
  if(!crypto.timingSafeEqual(expected,Buffer.from(signature,'hex')))return json(res,401,{error:'invalid_signature'});
  const event=JSON.parse(raw.toString('utf8'));
  const id=String(event.transactionId||event.id||'');if(!id||id.length>160)return json(res,400,{error:'missing_transaction_id'});
  const found=await db('pix_charges','?select=*&provider_charge_id=eq.'+encodeURIComponent(id)+'&limit=1');
  if(!found.length)return json(res,202,{status:'unknown_transaction'});
  const tx=await provider('/transactions/'+encodeURIComponent(id)); // never trust webhook status alone
  const result=await reconcile(found[0],tx);
  if(result.accepted||result.reason==='not_paid')return json(res,200,{ok:true,verification:result.reason});
  return json(res,409,{error:result.reason});
 }catch(e){console.error('pix_webhook_error',e.message);return json(res,500,{error:'webhook_processing_failed'})}
};

handler.config={api:{bodyParser:false}};
module.exports=handler;
