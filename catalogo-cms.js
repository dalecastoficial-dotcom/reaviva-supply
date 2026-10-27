// Carrega produtos públicos do CMS; mantém catálogo de exemplo quando Supabase não está configurado.
const cfg=window.REAVIVA_CONFIG||{};
if(cfg.supabaseUrl&&cfg.supabaseAnonKey){
  try{
    const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');
    const db=createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
    const {data,error}=await db.from('products').select('id,name,category,type,price,colors,sizes,image_url,active,featured').eq('active',true).order('created_at',{ascending:false});
    if(error) throw error;
    const rows=(data||[]).map(x=>({id:x.id,name:x.name,category:x.category,type:x.type||'Camiseta',price:x.price,colors:x.colors?.length?x.colors:['Consultar'],sizes:x.sizes?.length?x.sizes:['Consultar'],image:x.image_url||'assets/logo.png',featured:!!x.featured}));
    if(window.REAVIVA_SET_PRODUCTS)window.REAVIVA_SET_PRODUCTS(rows);
    const note=document.querySelector('.supplier-note');if(note)note.hidden=true;
    const foot=document.querySelector('.catalog-foot span:last-child');if(foot)foot.textContent='DISPONIBILIDADE SOB CONSULTA';
    const n=document.querySelector('.footer-base span:first-child');if(n)n.textContent=`© ${new Date().getFullYear()} REAVIVA SUPPLY`;
    const {data:banners}=await db.from('banners').select('title,subtitle,image_url,eyebrow,active,position').eq('active',true).order('position');
    if(banners?.length){
      const container=document.querySelector('.hero-slider');
      const slides=container?.querySelectorAll('.slide');
      // Banner dinâmico via atualização dos slides existentes: preserva os controles estáveis.
      banners.slice(0,3).forEach((b,i)=>{let target=slides?.[i];if(!target)return;target.style.setProperty('--slide-image',`url("${String(b.image_url||'').replace(/[^a-zA-Z0-9_:/?=&.%+\-]/g,'')}")`);target.querySelector('h1,h2').textContent=b.title||'REAVIVA SUPPLY';target.querySelector('p').textContent=b.subtitle||'';target.querySelector('.eyebrow').textContent=b.eyebrow||'REAVIVA SUPPLY'});
      // Para manter contagem/controles consistentes, exigir 3 banners até evolução posterior.
    }

    const {data:reviews,error:re}=await db.from('reviews').select('name,body,rating,approved,consent_confirmed').eq('approved',true).eq('consent_confirmed',true).order('created_at',{ascending:false});
    if(!re&&window.REAVIVA_SET_REVIEWS)window.REAVIVA_SET_REVIEWS(reviews||[]);
    const {data:about,error:ae}=await db.from('site_content').select('*').eq('key','about').eq('active',true).maybeSingle();
    if(!ae&&about){const section=document.querySelector('.about-feature');if(section){
      const put=(selector,value)=>{const el=section.querySelector(selector);if(el)el.textContent=value||''};
      put('.kicker',about.eyebrow);put('#aboutTitle',about.title);const paras=section.querySelectorAll('.about-feature-inner > p:not(.kicker)');if(paras[0])paras[0].textContent=about.paragraph1||'';if(paras[1])paras[1].textContent=about.paragraph2||'';
      const img=section.querySelector('.about-feature-photo img');if(img&&about.image_url)img.src=about.image_url;
      const link=section.querySelector('.about-feature-button');if(link)link.textContent=(about.button_text||'CONHEÇA NOSSO PROPÓSITO')+' ↗';
    }}
  }catch(err){console.warn('CMS indisponível: exibindo catálogo demonstrativo.',err);}
}
