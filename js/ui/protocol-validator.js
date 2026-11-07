/**
 * Read-only validation workbench and a conservative preflight gate for the
 * advanced Custom JSON modal. No signing/network operations happen here.
 */
import {HIVE_ACTION_REGISTRY} from "../hive/registry.js";
import {getExampleForAction} from "../hive/examples.js";
import {
  validateCustomJsonOperation,mayBroadcastValidatedOperation
} from "../hive/validator.js";
import {proposeHiveV2Namespaces} from "../hive/v2-plan.js";
import {escapeHtml,escapeAttr} from "../utils.js";

const sampleChoices=HIVE_ACTION_REGISTRY.map(action=>
  '<option value="'+escapeAttr(action.key)+'">'+escapeHtml(action.label)+'</option>').join("");

export function buildProtocolValidatorSection() {
  return `
  <section class="protocol-validator-section" aria-labelledby="protocolValidatorTitle">
    <div class="protocol-workbench-heading">
      <div>
        <span class="protocol-eyebrow">INFRASTRUCTURE TOOLS · LOCAL ONLY</span>
        <h2 id="protocolValidatorTitle">Custom JSON Validator</h2>
        <p>Check IDs and payload shapes before asking Hive Keychain to sign.
           This tool does not verify blockchain signatures or send anything.</p>
      </div>
      <span class="protocol-no-broadcast">No transactions sent</span>
    </div>
    <div class="protocol-validator-grid">
      <label>Custom JSON ID
        <input id="protocolValidatorId" type="text" maxlength="64" spellcheck="false"
               autocomplete="off" placeholder="hiveline.votes">
      </label>
      <label>Signing Hive account
        <input id="protocolValidatorSigner" type="text" maxlength="24" spellcheck="false"
               autocomplete="off" placeholder="alice">
      </label>
      <label class="protocol-validator-wide">JSON payload
        <textarea id="protocolValidatorJson" spellcheck="false" rows="7"
                  placeholder='{"app":"hiveline","v":2,"type":"upvote","content_id":12345}'></textarea>
      </label>
    </div>
    <div class="protocol-validator-actions">
      <label class="protocol-sample-select">Load a registered example
        <select id="protocolValidatorExample">${sampleChoices}</select>
      </label>
      <button id="protocolValidatorLoadExample" type="button" class="protocol-copy-btn">Load example</button>
      <button id="protocolValidatorCheck" type="button" class="protocol-validator-primary">Validate</button>
    </div>
    <div id="protocolValidatorResults" class="protocol-validator-results"
         role="status" aria-live="polite">Enter an ID and JSON payload, or load an example.</div>
  </section>

  <details class="protocol-v2-workbench">
    <summary>HiveLine v2 identity &amp; future namespace experiments <span class="protocol-draft-badge">PROPOSAL ONLY</span></summary>
    <div class="protocol-v2-body">
      <p>Enter a possible new application ID to preview clearer namespaces.
         HiveLine v2 IDs are now active. Other names are proposals; no further blockchain
         migration is enabled.</p>
      <label>Proposed app ID
        <input id="protocolV2BrandInput" type="text" maxlength="24"
               autocapitalize="off" autocomplete="off" spellcheck="false"
               placeholder="e.g. hiveline" value="hiveline">
      </label>
      <button type="button" id="protocolV2Preview" class="protocol-copy-btn">Preview v2 namespaces</button>
      <pre id="protocolV2Results" class="protocol-v2-output" role="status" aria-live="polite">
Choose a name to preview.</pre>
      <p class="protocol-v2-warning"><strong>Important:</strong> historical
         <code>micro.fair</code> content remains under its original IDs.
         A rename alone does not migrate posts, votes, follows or communities.</p>
    </div>
  </details>`;
}

function formatValidation(report) {
  const title=report.valid
    ? report.recognized?"✓ Registered HiveLine v1 operation":"⚠ Unregistered custom_json operation"
    : "✕ Operation requires corrections";
  const lines=[title];
  if(report.actionKey)lines.push("Action: "+report.actionKey);
  for(const issue of report.errors)lines.push("Error · "+issue.field+": "+issue.message);
  for(const issue of report.warnings)lines.push("Note · "+issue.field+": "+issue.message);
  if(report.requiresAcknowledgement)lines.push(
    "Unregistered operations require explicit acknowledgment in the Advanced Custom JSON dialog.");
  return lines.join("\n");
}

export function setupProtocolValidatorWorkbench(root=document) {
  const $=id=>root.getElementById(id);
  const id=$("protocolValidatorId"),payload=$("protocolValidatorJson");
  const signer=$("protocolValidatorSigner"),result=$("protocolValidatorResults");
  if(!id||!payload||!result)return;
  const validate=()=>{
    const report=validateCustomJsonOperation({id:id.value,json:payload.value,signer:signer?.value||""});
    result.textContent=formatValidation(report);
    result.dataset.status=report.valid?(report.recognized?"valid":"unregistered"):"invalid";
    return report;
  };
  $("protocolValidatorCheck")?.addEventListener("click",validate);
  $("protocolValidatorLoadExample")?.addEventListener("click",()=>{
    const example=getExampleForAction($("protocolValidatorExample")?.value);
    if(!example)return;
    id.value=example.id;
    payload.value=JSON.stringify(example.payload,null,2);
    if(signer)signer.value=example.hiveOperation.required_posting_auths[0];
    validate();
  });
  const brand=$("protocolV2BrandInput"),output=$("protocolV2Results");
  $("protocolV2Preview")?.addEventListener("click",()=>{
    if(!brand||!output)return;
    const draft=proposeHiveV2Namespaces(brand.value);
    output.textContent=draft.errors.length
      ? draft.errors.join("\n")
      : JSON.stringify({
          status:draft.status,enabled:draft.enabled,version:draft.version,
          proposedName:draft.proposedBrandId,
          proposedIds:draft.ids,decisionsRequired:draft.decisionsRequired
        },null,2);
  });
}

export function setupCustomJsonModalValidator({getSigner=()=>"",root=document}={}) {
  const $=id=>root.getElementById(id);
  const id=$("customJsonId"),payload=$("customJsonPayload");
  const button=$("submitCustomJson"),ack=$("customJsonUnregisteredAck");
  const reportEl=$("customJsonValidationResults");
  const ackWrap=$("customJsonUnregisteredWrap");
  if(!id||!payload||!button||!reportEl)return null;
  let previousKey="";
  const validate=()=>{
    const signer=getSigner()||"";
    const report=validateCustomJsonOperation({
      id:id.value.trim(),json:payload.value,signer
    });
    const key=id.value+"\0"+payload.value+"\0"+signer;
    if(previousKey!==key && ack) ack.checked=false;
    previousKey=key;
    if(ackWrap)ackWrap.classList.toggle("hidden",!report.requiresAcknowledgement);
    reportEl.textContent=formatValidation(report);
    reportEl.dataset.status=report.valid?(report.recognized?"valid":"unregistered"):"invalid";
    button.disabled=!mayBroadcastValidatedOperation(report,Boolean(ack?.checked));
    return report;
  };
  id.addEventListener("input",validate);
  payload.addEventListener("input",validate);
  ack?.addEventListener("change",validate);
  validate();
  return {validate,canBroadcast:()=>{
    const report=validate();
    return mayBroadcastValidatedOperation(report,Boolean(ack?.checked));
  }};
}
