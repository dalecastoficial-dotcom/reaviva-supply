// Public intake endpoint. Never accepts payment confirmation from the browser.
const {randomUUID}=require('crypto');
const MAX_BODY=5500;
function clean(v,n=120){return String(v??'').trim().slice(0,n)}
function validUUID(s){return /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(s)}
function supa(path){return new URL(path,process.env.SUPABASE_URL)}
function headers(extra={}){const key=process.env.SUPABASE_SERVICE_ROLE_KEY;return {apikey:key,Authorization:'Bearer '+key,...extra}}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Método não permitido'});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({error:'Serviço de pedidos não configurado'});
 try{
  if(Number(req.headers['content-length']||0)>MAX_BODY)return res.status(413).json({error:'Formulário muito grande'});
  let d=req.body;if(typeof d==='string')d=JSON.parse(d);if(!d||typeof d!=='object')throw Error('Dados inválidos');
  if(d.website)return res.status(200).json({protocol:'RECEBIDO'}); // anti-bot honeypot
  const productId=clean(d.product_id,40),name=clean(d.customer_name),phone=clean(d.customer_phone,25).replace(/\D/g,''),email=clean(d.customer_email,150),cep=clean(d.cep,12).replace(/\D/g,''),size=clean(d.size,30),color=clean(d.color,50),quantity=Number(d.quantity);
  const street=clean(d.street,140),number=clean(d.number,15),complement=clean(d.complement,100),neighborhood=clean(d.neighborhood,100),city=clean(d.city,100),state=clean(d.state,2).toUpperCase(),notes=clean(d.customer_notes,500);
  if(!validUUID(productId)||name.length<2||!/^(?:55)?\d{10,11}$/.test(phone)||!/^\d{8}$/.test(cep)||!Number.isInteger(quantity)||quantity<1||quantity>10||!street||!number||!neighborhood||!city||!/^[A-Z]{2}$/.test(state)||d.privacy_agreed!==true||email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return res.status(400).json({error:'Confira os campos e aceite o tratamento de dados.'});
  const url=supa('/rest/v1/products');url.searchParams.set('select','id,name,price,sizes,colors,active');url.searchParams.set('id','eq.'+productId);url.searchParams.set('active','eq.true');
  const pr=await fetch(url,{headers:headers(),signal:AbortSignal.timeout(9000)});if(!pr.ok)throw Error('Não foi possível validar o produto');const products=await pr.json();const product=products[0];if(!product)return res.status(404).json({error:'Produto indisponível'});
  if(!product.sizes?.includes(size)||!product.colors?.includes(color))return res.status(400).json({error:'Tamanho ou cor não disponível para seleção'});
  const protocol='RV-'+randomUUID().split('-')[0].toUpperCase();
  const order={customer_name:name,customer_phone:phone,product_name:product.name,size,color,quantity,total:product.price===null?null:Math.round(Number(product.price)*quantity*100)/100,status:'solicitado',customer_agreed:false,customer_email:email||null,cep,street,number,complement,neighborhood,city,state,customer_notes:notes,product_id:product.id,payment_method:'pix',payment_status:'aguardando_integracao',protocol,notes:'Solicitação pelo site. NÃO CONFIRMAR até confirmação segura do pagamento e disponibilidade do fornecedor.'};
  const save=await fetch(supa('/rest/v1/orders'),{method:'POST',headers:headers({'Content-Type':'application/json',Prefer:'return=minimal'}),body:JSON.stringify(order),signal:AbortSignal.timeout(9000)});
  if(!save.ok){console.error('order_insert_failed',save.status);throw Error('Não foi possível registrar a solicitação')}
  return res.status(201).json({protocol,status:'solicitado',payment_status:'aguardando_integracao'});
 }catch(err){console.error('public_order_error',err.message);return res.status(500).json({error:'Não foi possível enviar o pedido. Tente novamente ou fale com a loja.'})}
};
