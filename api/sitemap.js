const {origin,live,products,escapeHtml,safeImage,productPath}=require('./_seo');
module.exports=async(req,res)=>{
 if(req.method!=='GET')return res.status(405).end();
 res.setHeader('Content-Type','application/xml; charset=utf-8');
 res.setHeader('Cache-Control','public, s-maxage=1200, stale-while-revalidate=1200');
 const base=origin();let urls=[];
 if(live()){
  urls.push(base+'/');
  try{const list=await products();for(const p of list){if(p.price==null||!safeImage(p.image_url))continue;urls.push(base+productPath(p))}}catch{ /* sem dados: não anunciar páginas desconhecidas */ }
 }
 const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(x=>'<url><loc>'+escapeHtml(x)+'</loc></url>').join('')+'</urlset>';
 return res.status(200).send(xml);
};
