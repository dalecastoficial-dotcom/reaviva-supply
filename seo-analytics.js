/* REAVIVA SEO & GA4 — carrega Google Analytics somente após consentimento. */
(()=>{
 'use strict';
 const id=String(window.REAVIVA_CONFIG?.gaMeasurementId||'').trim();
 if(!/^G-[A-Z0-9]{5,20}$/.test(id))return;
 const storeKey='reaviva_analytics_consent_v1';
 function start(){
   if(window.__reavivaGaStarted)return;
   window.__reavivaGaStarted=true;
   window.dataLayer=window.dataLayer||[];
   window.gtag=function(){window.dataLayer.push(arguments)};
   window.gtag('js',new Date());
   window.gtag('config',id,{send_page_view:true,anonymize_ip:true});
   const script=document.createElement('script');script.async=true;
   script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);
   document.head.appendChild(script);
 }
 function banner(){
   if(document.getElementById('reaviva-cookie-banner'))return;
   const el=document.createElement('aside');el.id='reaviva-cookie-banner';
   el.setAttribute('aria-label','Preferências de privacidade');
   el.style.cssText='position:fixed;z-index:1000;left:16px;right:16px;bottom:16px;max-width:650px;margin:auto;background:#171717;color:#fff;padding:18px 20px;box-shadow:0 6px 35px #0008;border:1px solid #c8a878;border-radius:12px;font:14px/1.5 system-ui';
   el.innerHTML='<strong>Privacidade e análise de visitas</strong><p>Podemos utilizar o Google Analytics para compreender visitas e melhorar a experiência. Você escolhe se permite estatísticas.</p><div style="display:flex;flex-wrap:wrap;gap:10px"><button type="button" data-consent="yes" style="background:#d8c3a5;border:0;padding:10px 18px;border-radius:6px;cursor:pointer">Aceitar estatísticas</button><button type="button" data-consent="no" style="background:transparent;border:1px solid #aaa;color:#fff;padding:10px 18px;border-radius:6px;cursor:pointer">Recusar</button></div>';
   el.addEventListener('click',ev=>{const v=ev.target?.getAttribute('data-consent');if(!v)return;try{localStorage.setItem(storeKey,v)}catch{}el.remove();if(v==='yes')start()});
   document.body.appendChild(el);
 }
 let consent=null;try{consent=localStorage.getItem(storeKey)}catch{}
 if(consent==='yes')start();else if(consent!=='no'){
   if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',banner);else banner();
 }
 window.REAVIVA_TRACK_EVENT=(name,params={})=>{
   if(window.__reavivaGaStarted&&typeof window.gtag==='function'&&/^[a-zA-Z_][\w]{0,39}$/.test(name)) window.gtag('event',name,params);
 };
})();
