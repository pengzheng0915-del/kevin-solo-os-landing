(function(root,factory){
  var api=factory(root);
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.KevinPaidAssessmentFlow=api;
}(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  var TOKEN=/^[A-Za-z0-9_-]{43}$/, SID=/^[A-Za-z0-9_-]{6,128}$/;
  var MEASUREMENT_CODE=/^(?=[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$)(?=.*[2-9])[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
  var purchases=['unpaid','payment_pending','paid','report_generating','report_ready','recoverable_error','refunded_or_revoked'];
  var statuses=['paid','report_generating','report_ready','recoverable_error'];
  var reportScoreKeys=['content','consulting','knowledge','template','service','coaching'];
  var eligibilityStatuses=['collecting','checking','invalid','needs_evidence','ready','provider_error'];
  var COPY_BY_ELIGIBILITY=Object.freeze({
    collecting:{title:'材料已保存，可以继续填写',action:'继续填写'},
    checking:{title:'材料已保存，正在完成内容检查',action:'请稍候'},
    invalid:{title:'这几处回答还无法用于判断',action:'修改这几处回答'},
    needs_evidence:{title:'已经读到真实线索，还差 1—2 项关键事实',action:'补充关键事实'},
    ready:{title:'材料已具备初步判断条件',action:'支付 19.9 元并生成完整报告'},
    provider_error:{title:'材料已保存，暂时未能完成内容检查',action:'重新检查内容'}
  });
  var feedbackFields=['decision','caseOneProblem','caseOneAction','caseOneResult','caseBoundaryTransfer','nearestIncident'];
  var errorCodes=['NOT_FOUND','INVALID_PAYLOAD','INPUT_CHANGED','LOGIN_REQUIRED','PAID_ASSESSMENT_NEW_ORDERS_DISABLED','PAID_ASSESSMENT_INPUT_LOCKED','SCHEMA_NOT_READY','INTERNAL_ERROR','PAYLOAD_TOO_LARGE'];
  class PaidFlowError extends Error {constructor(code,details){super(code);this.name='PaidFlowError';this.code=code;if(details)this.details=details;}}
  function invalid(){throw new PaidFlowError('INVALID_PAID_RESPONSE');}
  function object(v){return v&&typeof v==='object'&&!Array.isArray(v);}
  function keys(v,allowed,required){if(!object(v)||Object.keys(v).some(k=>allowed.indexOf(k)<0)||(required||allowed).some(k=>!Object.prototype.hasOwnProperty.call(v,k)))invalid();}
  function session(id){if(typeof id!=='string'||!SID.test(id))throw new PaidFlowError('INVALID_SESSION');return id;}
  function detectPaidFlow(location){try{var p=new URL(location.href).searchParams;return p.get('from')==='miniprogram'&&p.get('flow')==='miniapp_paid_report_v1'&&p.get('assessment_version')==='assessment-v3-adaptive-v1';}catch(e){return false;}}
  function stable(v){if(Array.isArray(v))return v.map(stable);if(!object(v))return v;var out={};Object.keys(v).sort().forEach(k=>out[k]=stable(v[k]));return out;}
  function deploymentBasePath(){var pathname=String(root&&root.location&&root.location.pathname||'');var marker=pathname.indexOf('/report');return marker>0?pathname.slice(0,marker).replace(/\/+$/,''):'';}
  function snapshot(value,id){
    var mapper=root.KevinAssessmentV3Integration||(typeof require==='function'?require('./integration.js'):null);
    if(!mapper||!object(value)||value.session_id!==id)invalid();
    var canonical=mapper.buildAnonymousPayload(value);
    if(JSON.stringify(stable(value))!==JSON.stringify(stable(canonical)))invalid();
    return canonical;
  }
  function metadata(body,id,withAnswers){
    var fields=['session_id','input_version','eligibility_status','feedback','missing_fact_categories','purchase_state','next_action','can_create_order'];
    if(withAnswers)fields.push('answer_snapshot');keys(body,fields);
    if(body.session_id!==id||!Number.isSafeInteger(body.input_version)||body.input_version<0||!eligibilityStatuses.includes(body.eligibility_status)||!purchases.includes(body.purchase_state)||!['complete_input','retry_check','wait','checkout','finalize','recover_report'].includes(body.next_action)||typeof body.can_create_order!=='boolean'||!Array.isArray(body.feedback)||body.feedback.length>2||body.feedback.some(x=>{try{keys(x,['field','message']);return !feedbackFields.includes(x.field)||typeof x.message!=='string'||!x.message.trim()||x.message.length>180;}catch(e){return true;}})||!Array.isArray(body.missing_fact_categories)||body.missing_fact_categories.some(x=>!['background','case_evidence'].includes(x)))invalid();
    if(body.can_create_order&&(body.purchase_state!=='unpaid'||body.eligibility_status!=='ready'||body.input_version<1||body.next_action!=='checkout'))invalid();
    if(withAnswers)body.answer_snapshot=snapshot(body.answer_snapshot,id);
    return body;
  }
  function reportState(body,id){keys(body,['session_id','input_version','status','generated_at','next_action']);if(body.session_id!==id||!Number.isSafeInteger(body.input_version)||body.input_version<1||!statuses.includes(body.status)||typeof body.generated_at!=='string'||!['open_report','retry_or_wait'].includes(body.next_action))invalid();return body;}
  function eligibilityPresentation(status){if(!eligibilityStatuses.includes(status))invalid();return Object.assign({},COPY_BY_ELIGIBILITY[status]);}
  async function request(path,init,validate){
    var controller=typeof root.AbortController==='function'?new root.AbortController():null;
    var timer=root.setTimeout(()=>{if(controller)controller.abort();},310000);
    try{
      var scopedPath=path.indexOf('/api/')===0?deploymentBasePath()+path:path;
      var response=await root.fetch(scopedPath,Object.assign({},init,{credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},signal:controller?controller.signal:undefined}));
      var body;try{body=await response.json();}catch(e){invalid();}
      if(!response.ok){
        if(body&&body.status==='recoverable_error'){var detail=validate(body);throw new PaidFlowError('REPORT_GENERATION_RETRYABLE',detail);}
        var code=errorCodes.includes(body&&body.code)?body.code:'PAID_FLOW_REQUEST_FAILED';
        var safe=code==='PAID_ASSESSMENT_INPUT_LOCKED'&&purchases.includes(body.purchase_state)?{purchase_state:body.purchase_state}:undefined;
        throw new PaidFlowError(code,safe);
      }
      return validate(body);
    }catch(e){if(e instanceof PaidFlowError)throw e;throw new PaidFlowError('PAID_FLOW_REQUEST_FAILED');}
    finally{root.clearTimeout(timer);}
  }
  function loadPaidDraft(id){session(id);return request('/api/paid-assessment/input?sid='+encodeURIComponent(id),{},b=>metadata(b,id,true));}
  function savePaidDraft(value){var id=session(value.sessionId);if(typeof value.finalize!=='boolean')throw new PaidFlowError('INVALID_PAYLOAD');var payload=snapshot(value.answerSnapshot,id);return request('/api/paid-assessment/input',{method:'PUT',body:JSON.stringify({session_id:id,answer_snapshot:payload,finalize:value.finalize})},b=>metadata(b,id,false));}
  function createCheckout(value){var id=session(value.sessionId);if(!Number.isSafeInteger(value.inputVersion)||value.inputVersion<1)throw new PaidFlowError('INVALID_PAYLOAD');return request('/api/paid-assessment/checkout',{method:'POST',body:JSON.stringify({session_id:id,input_version:value.inputVersion})},b=>{keys(b,['checkout_token','expires_at']);if(!TOKEN.test(b.checkout_token)||!Number.isFinite(Date.parse(b.expires_at)))invalid();return b;});}
  function loadPaidReportStatus(id){session(id);return request('/api/paid-assessment/report?sid='+encodeURIComponent(id),{},b=>reportState(b,id));}
  function generateOrResumePaidReport(id){session(id);return request('/api/paid-assessment/report?sid='+encodeURIComponent(id),{method:'POST'},b=>reportState(b,id));}
  function loadPaidReport(id){session(id);return request('/api/getReport?sid='+encodeURIComponent(id),{},b=>{
    var required=['session_id','access_granted','access_source','paid','measurement_code','assessment_v3_report_status','assessment_v3_report_document','assessment_v3_input_summary','created_at'];
    keys(b,required.concat('result_scores'),required);
    var documentValue=b.assessment_v3_report_document,memo=documentValue&&documentValue.decisionMemo;
    if(b.session_id!==id||b.access_granted!==true||b.access_source!=='payment'||b.paid!==1||(b.measurement_code!==null&&!MEASUREMENT_CODE.test(b.measurement_code))||b.assessment_v3_report_status!=='ready'||!object(documentValue)||documentValue.schemaVersion!=='assessment-report-v1'||!object(documentValue.modules)||(memo!==undefined&&(!object(memo)||!['assessment-decision-memo-v1','assessment-decision-memo-v2'].includes(memo.schemaVersion))))invalid();
    if(Object.prototype.hasOwnProperty.call(b,'result_scores')){keys(b.result_scores,reportScoreKeys);if(reportScoreKeys.some(k=>!Number.isFinite(Number(b.result_scores[k]))))invalid();}
    keys(documentValue,['schemaVersion','inputFingerprint','decisionMemo','modules'],['schemaVersion','modules']);
    if(memo){
      keys(memo,memo.schemaVersion==='assessment-decision-memo-v2'?['schemaVersion','verdict','decisionBasis','known','unknown','action','boundary']:['schemaVersion','verdict','known','unknown','action','boundary']);
      if(memo.schemaVersion==='assessment-decision-memo-v2'){
        if(!Array.isArray(memo.decisionBasis)||memo.decisionBasis.length<1||memo.decisionBasis.length>4)invalid();
        memo.decisionBasis.forEach(item=>{
          keys(item,['label','fact','effect','sourceFields','evidenceRefs']);
          if(!['label','fact','effect'].every(field=>typeof item[field]==='string'&&item[field].trim())||!Array.isArray(item.sourceFields)||item.sourceFields.length<1||item.sourceFields.some(field=>typeof field!=='string'||!field.trim())||!Array.isArray(item.evidenceRefs)||item.evidenceRefs.some(id=>typeof id!=='string'||!id.trim()))invalid();
        });
      }
    }
    keys(documentValue.modules,['executiveSummary','understoodFacts','assetAssessment','stageDiagnosis','priorityPath','deferredPaths','validationTask','actionChecklist','boundaries']);
    return b;
  });}
  function paymentPath(value){if(typeof value.checkoutToken!=='string'||!TOKEN.test(value.checkoutToken))throw new PaidFlowError('INVALID_CHECKOUT_TOKEN');return '/pages/payment/payment?checkout_token='+encodeURIComponent(value.checkoutToken);}
  function navigateToMiniProgramPayment(token){var path=paymentPath({checkoutToken:token});return new Promise((resolve,reject)=>{
    var bridge=root.wx&&root.wx.miniProgram;if(!bridge||typeof bridge.navigateTo!=='function'){reject(new PaidFlowError('MINIPROGRAM_BRIDGE_UNAVAILABLE'));return;}
    var timer=root.setTimeout(()=>reject(new PaidFlowError('MINIPROGRAM_BRIDGE_UNAVAILABLE')),10000);
    function failed(){root.clearTimeout(timer);reject(new PaidFlowError('MINIPROGRAM_BRIDGE_UNAVAILABLE'));}
    try{bridge.navigateTo({url:path,success:()=>{root.clearTimeout(timer);resolve(path);},fail:failed});}catch(e){failed();}
  });}
  return {PaidFlowError,detectPaidFlow,eligibilityPresentation,loadPaidDraft,savePaidDraft,createCheckout,loadPaidReportStatus,generateOrResumePaidReport,loadPaidReport,paymentPath,navigateToMiniProgramPayment};
}));
