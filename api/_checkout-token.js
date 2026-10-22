const crypto=require('crypto');
const {uuid}=require('./_pix-core');
function secret(){const s=process.env.PIX_CHECKOUT_SIGNING_KEY||'';if(s.length<32)throw Error('checkout_signing_key_missing');return s;}
function sign(orderId,chargeId){if(!uuid(orderId)||!uuid(chargeId))throw Error('invalid_checkout_link');const expiry=Math.floor(Date.now()/1000)+7*86400;const body=Buffer.from(JSON.stringify({o:orderId,c:chargeId,e:expiry})).toString('base64url');const mac=crypto.createHmac('sha256',secret()).update(body).digest('base64url');return body+'.'+mac;}
function verify(token){if(typeof token!=='string'||token.length>512||!token.includes('.'))return null;const [body,signature,...rest]=token.split('.');if(rest.length||!body||!signature)return null;try{const expected=crypto.createHmac('sha256',secret()).update(body).digest();const received=Buffer.from(signature,'base64url');if(received.length!==expected.length||!crypto.timingSafeEqual(expected,received))return null;const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));if(!uuid(p.o)||!uuid(p.c)||!Number.isSafeInteger(p.e)||p.e<Math.floor(Date.now()/1000))return null;return p;}catch{return null}}
module.exports={sign,verify};
