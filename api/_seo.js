const DEFAULT_SITE='https://reaviva-supply-beryl.vercel.app';
function origin(){try{const u=new URL(process.env.SEO_SITE_URL||DEFAULT_SITE);if(u.protocol!=='https:')throw 0;return u.origin}catch{return DEFAULT_SITE}}
function live(){return process.env.SEO_INDEXABLE==='true'}
function slug(name){return String(name||'produto').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,85)||'produto'}
function productPath(p){return '/produto/'+slug(p.name)+'-'+p.id}
function escapeHtml(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function safeImage(raw){try{const u=new URL(raw,origin());return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}}
async function products(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;
 if(!url||!key)return [];
 const api=new URL('/rest/v1/products',url);
 api.searchParams.set('select','id,name,category,type,price,image_url,colors,sizes,created_at,active');
 api.searchParams.set('active','eq.true');api.searchParams.set('order','created_at.desc');api.searchParams.set('limit','1000');
 const response=await fetch(api,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(8500)});
 if(!response.ok)throw Error('supabase_fetch_failed');
 const data=await response.json();return Array.isArray(data)?data:[];
}
function sendHtml(res,body,status=200){res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','public, s-maxage=600, stale-while-revalidate=900');return res.status(status).send(body)}
module.exports={origin,live,escapeHtml,safeImage,products,sendHtml,slug,productPath};
