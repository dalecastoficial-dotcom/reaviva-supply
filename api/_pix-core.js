const crypto = require('crypto');
const BASE = 'https://api.whitelabel-elite.com/v1';
const PROVIDER = 'whitelabel-elite';
const json=(res,code,data)=>{res.setHeader('Cache-Control','no-store');return res.status(code).json(data)};
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const configured=()=>process.env.PIX_ENABLED==='true'&&!!(process.env.PIX_CLIENT_ID&&process.env.PIX_CLIENT_SECRET&&process.env.PIX_WEBHOOK_SECRET&&process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
const supaHeaders=(extra={})=>({apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,...extra});
async function db(table,query='',opts={}){
 const url=new URL('/rest/v1/'+table+query,process.env.SUPABASE_URL);
 const r=await fetch(url,{...opts,headers:{...supaHeaders(),...(opts.headers||{})},signal:AbortSignal.timeout(12000)});
 if(!r.ok){console.error('db_error',table,r.status,(await r.text()).slice(0,180));throw Error('db_error')}
 const raw=await r.text();return raw?JSON.parse(raw):null;
}
async function provider(path,opts={}){
 const r=await fetch(BASE+path,{...opts,headers:{'x-client-id':process.env.PIX_CLIENT_ID,'x-client-secret':process.env.PIX_CLIENT_SECRET,'Content-Type':'application/json',...(opts.headers||{})},signal:AbortSignal.timeout(15000)});
 if(!r.ok){console.error('provider_error',r.status);throw Error('provider_error')}
 return r.json();
}
async function requireAdmin(req){
 const token=/^Bearer\s+(.+)$/i.exec(req.headers.authorization||'')?.[1];if(!token) return false;
 const r=await fetch(new URL('/auth/v1/user',process.env.SUPABASE_URL),{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'',Authorization:'Bearer '+token},signal:AbortSignal.timeout(9000)});
 if(!r.ok)return false;const u=await r.json();if(!uuid(u.id))return false;
 const admins=await db('admins','?select=user_id&user_id=eq.'+u.id+'&limit=1');return admins.length>0;
}
function hmacOK(req){
 const given=String(req.headers['x-signature']||'').trim().replace(/^sha256=/i,'');
 if(!/^[a-f0-9]{64}$/i.test(given))return false;
 // Vercel may parse the request body. For webhook use raw request stream only.
 const secret=process.env.PIX_WEBHOOK_SECRET;
 if(!secret||!Buffer.isBuffer(req.rawBodyBuffer))return false;
 const expected=crypto.createHmac('sha256',secret).update(req.rawBodyBuffer).digest();
 return crypto.timingSafeEqual(expected,Buffer.from(given,'hex'));
}
// Only literal "paid" is recognized until the provider confirms all status names.
function isPaid(status){return String(status||'').toLowerCase()==='paid'}
function amountCents(n){return Number.isFinite(Number(n))?Math.round(Number(n)*100):NaN}
async function reconcile(charge,tx){
 const providerId=String(tx.transactionId||tx.id||'');
 if(providerId!==charge.provider_charge_id)return {accepted:false,reason:'transaction_mismatch'};
 if(amountCents(tx.amount)!==Number(charge.amount_cents))return {accepted:false,reason:'amount_mismatch'};
 if(!isPaid(tx.status))return {accepted:false,reason:'not_paid'};
 // Atomic DB-side procedure ensures a single paid transition and verifies charge/order linkage.
 const result=await db('rpc/reaviva_confirm_pix','',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_charge_id:charge.id,p_provider_id:providerId,p_amount_cents:charge.amount_cents})});
 return {accepted:result===true,reason:result===true?'paid':'reconciliation_rejected'};
}
module.exports={json,uuid,configured,db,provider,requireAdmin,hmacOK,reconcile,PROVIDER,amountCents};
