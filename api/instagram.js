/* Vercel Serverless Function — Instagram API with Instagram Login. */
module.exports=async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=1800');
 if(req.method!=='GET')return res.status(405).json({posts:[]});
 const token=process.env.INSTAGRAM_ACCESS_TOKEN;
 if(!token)return res.status(200).json({posts:[],connected:false});
 try{
  const url=new URL('https://graph.instagram.com/me/media');
  url.searchParams.set('fields','id,caption,media_type,media_url,thumbnail_url,permalink,timestamp');url.searchParams.set('limit','8');
  const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});
  if(!response.ok){return res.status(502).json({posts:[],connected:false});}
  const json=await response.json();
  const posts=(Array.isArray(json.data)?json.data:[]).filter(p=>p.permalink&&(p.media_url||p.thumbnail_url)).slice(0,8).map(p=>({image:p.media_type==='VIDEO'?(p.thumbnail_url||p.media_url):p.media_url,url:p.permalink,caption:p.caption||'',video:p.media_type==='VIDEO'}));
  return res.status(200).json({posts,connected:true});
 }catch{return res.status(502).json({posts:[],connected:false});}
};
