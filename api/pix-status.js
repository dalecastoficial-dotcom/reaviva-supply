const {json,uuid,configured,db,provider,requireAdmin,reconcile}=require('./_pix-core');
module.exports=async(req,res)=>{
 if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
 if(!configured())return json(res,503,{error:'pix_disabled'});
 try{
  if(!await requireAdmin(req))return json(res,403,{error:'admin_required'});
  if(!uuid(req.query.order_id))return json(res,400,{error:'invalid_order_id'});
  const a=await db('pix_charges','?select=*&order_id=eq.'+req.query.order_id+'&order=created_at.desc&limit=1');
  if(!a.length)return json(res,404,{error:'charge_not_found'});
  const charge=a[0];if(charge.status==='paid')return json(res,200,{status:'paid'});
  const tx=await provider('/transactions/'+encodeURIComponent(charge.provider_charge_id));
  const result=await reconcile(charge,tx);
  return json(res,200,{status:result.accepted?'paid':'pending',provider_status:tx.status||null,verification:result.reason});
 }catch(e){console.error('pix_status_error',e.message);return json(res,502,{error:'status_check_failed'})}
};
