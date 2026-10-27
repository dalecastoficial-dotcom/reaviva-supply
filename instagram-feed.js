/* Feed oficial Instagram: endpoint serverless sem expor token na página */
(()=>{'use strict';
const grid=document.getElementById('socialFeedGrid');
const follow=document.getElementById('instagramFeedLink');
if(!grid)return;
const config=window.REAVIVA_CONFIG||{};
const username=String(config.instagram||'').replace(/^@/,'').trim();
if(username && /^[a-zA-Z0-9._]{1,30}$/.test(username)){
 follow.href='https://www.instagram.com/'+username+'/';follow.hidden=false;
}
const fallback=(msg)=>{grid.replaceChildren();const box=document.createElement('div');box.className='social-feed-empty';const icon=document.createElement('span');icon.textContent='◎';const title=document.createElement('strong');title.textContent='ACOMPANHE A REAVIVA NO INSTAGRAM';const desc=document.createElement('p');desc.textContent=msg;box.append(icon,title,desc);grid.append(box)};
const showPosts=(posts)=>{grid.replaceChildren();for(const post of posts){
 if(!/^https:\/\//i.test(post.image||'') || !/^https:\/\//i.test(post.url||''))continue;
 const link=document.createElement('a');link.className='social-feed-card';link.href=post.url;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','Abrir publicação da REAVIVA no Instagram');
 const img=document.createElement('img');img.src=post.image;img.alt=(post.caption||'Publicação da REAVIVA SUPPLY').slice(0,110);img.loading='lazy';img.decoding='async';link.append(img);
 if(post.video){const flag=document.createElement('span');flag.className='social-feed-video';flag.textContent='VÍDEO';link.append(flag)}grid.append(link);
 }if(!grid.children.length)fallback('As publicações ainda não estão disponíveis. Siga nosso perfil para acompanhar as novidades.');};
fetch('/api/instagram',{headers:{Accept:'application/json'}}).then(async res=>{if(!res.ok)throw Error('feed indisponível');const data=await res.json();if(!Array.isArray(data.posts)||!data.posts.length){fallback('Estamos preparando o feed da nossa loja. Confira as novidades diretamente no nosso perfil.');return;}showPosts(data.posts);}).catch(()=>fallback('As publicações aparecerão aqui quando a integração oficial estiver ativada.'));
})();
