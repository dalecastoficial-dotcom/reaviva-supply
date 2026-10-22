'use strict';
/* EXEMPLOS FICTÍCIOS. Substitua apenas por produtos, preços, fotos e descrições autorizados. */
/* Fotos recortadas exclusivamente de capturas enviadas pelo usuário. Uso de demonstração; validar licença de uso antes da publicação comercial. */
let PRODUCTS=[
{id:'REF-001',name:'O Senhor é Meu Pastor',category:'feminino',type:'Oversized',image:'assets/referencia-5.webp',price:null,colors:['Consultar'],sizes:['P','M','G','GG'],source:'Referência visual recebida'},
{id:'REF-002',name:'O Fogo Arderá',category:'masculino',type:'Oversized',image:'assets/referencia-6.webp',price:null,colors:['Consultar'],sizes:['P','M','G','GG'],source:'Referência visual recebida'},
{id:'REF-003',name:'Devoção',category:'unissex',type:'Oversized',image:'assets/referencia-7.webp',price:null,colors:['Consultar'],sizes:['P','M','G','GG'],source:'Referência visual recebida'},
{id:'REF-004',name:'Salmos 23',category:'unissex',type:'Oversized',image:'assets/referencia-8.webp',price:null,colors:['Consultar'],sizes:['P','M','G','GG'],source:'Referência visual recebida'},
{id:'REF-005',name:'Ide e Pregai',category:'unissex',type:'Oversized',image:'assets/referencia-9.webp',price:90,colors:['Consultar'],sizes:['P','M','G','GG'],source:'Aviva Vest · preço de referência de modelo homônimo'}
];
window.REAVIVA_SET_PRODUCTS = function(rows){PRODUCTS=rows;render();renderFeatured();};
const grid=document.querySelector('#productGrid');const search=document.querySelector('#search');const productDialog=document.querySelector('#productDialog');let activeFilter='todos';let currentProduct=null;
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function productArt(p){return `<div class="product-photo"><span class="product-tag">REFERÊNCIA VISUAL</span><img src="${escapeHtml(p.image)}" alt="Referência de camiseta ${escapeHtml(p.name)}" loading="lazy"></div>`}
function render(){let q=search.value.toLocaleLowerCase('pt-BR').trim();let visible=PRODUCTS.filter(p=>(activeFilter==='todos'||p.category===activeFilter||activeFilter==='masculino'&&p.category==='unissex'||activeFilter==='feminino'&&p.category==='unissex')&&(`${p.name} ${p.type} ${p.category}`).toLocaleLowerCase('pt-BR').includes(q));grid.innerHTML=visible.length?visible.map(p=>`<article class="product-card">${productArt(p)}<div class="product-info"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.type)} · ${escapeHtml(p.category)}</p><div class="price"><strong>${p.price!==null ? `R$ ${Number(p.price).toFixed(2).replace(".",",")}` : "Preço sob consulta"}</strong><span>${p.id}</span></div>${/^[0-9a-f-]{36}$/i.test(p.id) ? `<a class="product-cta product-detail-link" href="/produto/${encodeURIComponent(p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,85))}-${p.id}">VER PRODUTO ↗</a>` : `<button type="button" class="product-cta" data-detail="${p.id}">VER DETALHES ↗</button>`}</div></article>`).join(''):'<p class="empty">Nenhum modelo encontrado. Tente outra busca ou categoria.</p>';document.querySelector('#productCount').textContent=`${visible.length} REFERÊNCIA(S) DE PRODUTO`;document.querySelectorAll('[data-detail]').forEach(b=>b.addEventListener('click',()=>openProduct(b.dataset.detail)))}
function setFilter(f){activeFilter=f;document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b.dataset.filter===f));render()}
document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.filter)));document.querySelectorAll('[data-filter-link]').forEach(a=>a.addEventListener('click',()=>{setFilter(a.dataset.filterLink);document.querySelector('#mobileNav').hidden=true;document.querySelector('#mobileToggle').setAttribute('aria-expanded','false')}));search.addEventListener('input',render);document.querySelector('#searchJump').addEventListener('click',()=>{document.querySelector('#colecao').scrollIntoView();search.focus()});
document.querySelector('#mobileToggle').addEventListener('click',()=>{const m=document.querySelector('#mobileNav');m.hidden=!m.hidden;document.querySelector('#mobileToggle').setAttribute('aria-expanded',String(!m.hidden))});
function openProduct(id){currentProduct=PRODUCTS.find(x=>x.id===id);if(!currentProduct)return;const p=currentProduct;document.querySelector('#dialogBody').innerHTML=`<button type="button" class="close" data-close aria-label="Fechar detalhes">×</button><div class="dialog-content"><div class="detail-art"><img src="${escapeHtml(p.image)}" alt="Referência de ${escapeHtml(p.name)}"></div><div class="detail-info"><p class="kicker">${p.id} • REFERÊNCIA DE FORNECEDOR</p><h2>${escapeHtml(p.name)}</h2><p>Modelo de referência ${escapeHtml(p.type.toLowerCase())}. Disponibilidade e preço de venda da REAVIVA ainda dependem de confirmação com o fornecedor.</p><div class="detail-note">${p.price!==null ? `Preço informado no catálogo: R$ ${Number(p.price).toFixed(2).replace(".",",")}. ` : ""}Disponibilidade e prazo de encomenda sujeitos à confirmação pela equipe.</div><label for="sizeChoice">TAMANHO DE INTERESSE</label><select id="sizeChoice"><option value="">Selecione um tamanho</option>${p.sizes.map(x=>`<option>${escapeHtml(x)}</option>`).join('')}</select><label for="colorChoice">COR DE INTERESSE</label><select id="colorChoice"><option value="">Selecione uma cor</option>${p.colors.map(x=>`<option>${escapeHtml(x)}</option>`).join('')}</select><button type="button" class="btn btn-dark" id="orderButton">CONSULTAR PELO WHATSAPP ↗</button></div></div>`;document.querySelector('[data-close]').addEventListener('click',()=>productDialog.close());document.querySelector('#orderButton').addEventListener('click',orderCurrent);productDialog.showModal()}
function cleanNumber(n){let digits=n.replace(/\D/g,'');if(digits.startsWith('55')&&digits.length>=12)return digits;if(digits.length===10||digits.length===11)return '55'+digits;return ''}
function storeConfig(){return window.REAVIVA_CONFIG || {whatsapp:'',instagram:''}}
function contact(message){
  const phone=cleanNumber(String(storeConfig().whatsapp||''));
  if(!phone){showToast('Atendimento pelo WhatsApp em preparação. Volte em breve!');return}
  window.REAVIVA_TRACK_EVENT?.('contact_whatsapp',{contact_method:'whatsapp'});
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');
}
function orderCurrent(){if(!currentProduct)return;const size=document.querySelector('#sizeChoice').value;const color=document.querySelector('#colorChoice').value;if(!size||!color){showToast('Escolha tamanho e cor antes de consultar.');return}const msg=`Olá! Vi no catálogo da REAVIVA SUPPLY a referência ${currentProduct.name} (${currentProduct.id}). Tenho interesse no tamanho ${size}, cor ${color}. Poderiam me informar se há um produto real correspondente, seu preço final e o prazo de encomenda?`;contact(msg)}
document.querySelector('#contactBtn').addEventListener('click',()=>contact('Olá! Vim pelo site REAVIVA SUPPLY e gostaria de informações sobre as encomendas.'));document.querySelector('#footerContact').addEventListener('click',()=>contact('Olá! Gostaria de falar com a REAVIVA SUPPLY.'));
function setInstagram(username){
  const name=String(username||'').replace(/^@/,'').replace(/[^a-zA-Z0-9._]/g,'');
  const link=document.querySelector('#footerInstagram');
  if(name){link.href='https://www.instagram.com/'+name+'/';link.hidden=false}
  else{link.removeAttribute('href');link.title='Instagram ainda não configurado';link.setAttribute('aria-disabled','true');}
}
setInstagram(storeConfig().instagram);
for(const dialog of [productDialog])dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});let toastHandle;function showToast(t){const el=document.querySelector('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.classList.remove('show'),4000)}document.querySelector('#year').textContent=new Date().getFullYear();render();

// Banner slider: automático, pausa em hover/foco e respeito à preferência de movimento reduzido.
const slides=[...document.querySelectorAll('.slide')];const dots=[...document.querySelectorAll('[data-slide-to]')];let slideIndex=0,slideTimer;
function showSlide(i){slideIndex=(i+slides.length)%slides.length;slides.forEach((el,n)=>el.classList.toggle('active',n===slideIndex));dots.forEach((el,n)=>{el.setAttribute('aria-current',String(n===slideIndex))});document.querySelector('#sliderCounter').textContent=`0${slideIndex+1} / 0${slides.length}`;}
function stopSlide(){clearInterval(slideTimer)}
function playSlide(){stopSlide();if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)slideTimer=setInterval(()=>showSlide(slideIndex+1),6000)}
document.querySelector('#slidePrev').addEventListener('click',()=>{showSlide(slideIndex-1);playSlide()});document.querySelector('#slideNext').addEventListener('click',()=>{showSlide(slideIndex+1);playSlide()});dots.forEach(b=>b.addEventListener('click',()=>{showSlide(Number(b.dataset.slideTo));playSlide()}));const heroSlider=document.querySelector('.hero-slider');heroSlider.addEventListener('mouseenter',stopSlide);heroSlider.addEventListener('mouseleave',playSlide);heroSlider.addEventListener('focusin',stopSlide);heroSlider.addEventListener('focusout',e=>{if(!heroSlider.contains(e.relatedTarget))playSlide()});document.addEventListener('visibilitychange',()=>document.hidden?stopSlide():playSlide());playSlide();

// V2.1 - novidades alimentadas pelo mesmo catálogo (inclusive CMS)
function renderFeatured(){
 const root=document.getElementById('featuredTrack');if(!root)return;
 const selected=PRODUCTS.filter(p=>p.featured);const featured=(selected.length?selected:PRODUCTS).slice(0,4);
 root.innerHTML=featured.length?featured.map(p=>`<article class="featured-item"><div class="featured-picture"><img loading="lazy" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}"></div><div class="featured-copy"><span class="featured-kind">${escapeHtml(p.type||'Camiseta')} · ${escapeHtml(p.category||'unissex')}</span><h3>${escapeHtml(p.name)}</h3><div class="featured-price">${p.price!=null?'R$ '+Number(p.price).toFixed(2).replace('.',','):'Preço sob consulta'}</div>${/^[0-9a-f-]{36}$/i.test(p.id)?`<a href="/produto/${encodeURIComponent(p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,85))}-${p.id}">VER PRODUTO ↗</a>`:`<button type="button" data-featured-id="${escapeHtml(p.id)}">VER DETALHES ↗</button>`}</div></article>`).join(''):'<p>Nenhuma peça em destaque no momento.</p>';
 root.querySelectorAll('[data-featured-id]').forEach(btn=>btn.addEventListener('click',()=>openProduct(btn.dataset.featuredId)));
}
renderFeatured();
// Depoimentos são exibidos somente quando autorizados. Nunca inserir nomes/avaliações fictícias.
window.REAVIVA_SET_REVIEWS=function(reviews){
 const root=document.getElementById('voicesGrid');if(!root||!Array.isArray(reviews)||!reviews.length)return;
 root.innerHTML=reviews.filter(x=>x.approved===true).slice(0,6).map(x=>`<article class="voice-card"><div class="voice-stars" aria-label="${Math.min(5,Math.max(1,Number(x.rating)||5))} de 5 estrelas">${'★'.repeat(Math.min(5,Math.max(1,Number(x.rating)||5)))}</div><blockquote>“${escapeHtml(x.body)}”</blockquote><strong>${escapeHtml(x.name)}</strong></article>`).join('')||root.innerHTML;
};
