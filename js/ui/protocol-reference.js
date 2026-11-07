/**
 * Public, read-only protocol explorer. Examples come from executable builders
 * rather than manually maintained snippets, so docs cannot drift from writes.
 * This page never signs, broadcasts, or fetches blockchain data.
 */
import { escapeHtml, escapeAttr } from "../utils.js";
import {
  HIVE_APP_ID, HIVE_PROTOCOL_VERSION, HIVE_NAMESPACE_REGISTRY,
  HIVE_FIELD_DESCRIPTIONS, getHiveAction
} from "../hive/registry.js";
import { getExampleForAction, PROTOCOL_EXAMPLE_CONTENT_ID } from "../hive/examples.js";
import { buildProtocolValidatorSection, setupProtocolValidatorWorkbench } from "./protocol-validator.js";

function jsonCode(value) {
  return escapeHtml(JSON.stringify(value, null, 2));
}

function fieldType(key, value) {
  if (key === "reply_to") return "number | null";
  if (key === "content_id") return "number";
  if (Array.isArray(value)) return "string[]";
  if (value === null) return "null";
  return typeof value;
}

function operationCard(actionKey) {
  const action=getHiveAction(actionKey);
  const example=getExampleForAction(actionKey);
  if(!action || !example)return "";
  const fields=Object.entries(example.payload).map(([key,value])=>`
    <tr><th scope="row"><code>${escapeHtml(key)}</code></th>
      <td class="protocol-field-type">${escapeHtml(fieldType(key,value))}</td>
      <td>${escapeHtml(HIVE_FIELD_DESCRIPTIONS[key]||"Serialized payload field.")}</td></tr>`).join("");
  return `<details class="protocol-action-entry" id="protocol-action-${escapeAttr(actionKey)}"
    data-search="${escapeAttr([action.label,action.summary,action.type,example.id,...Object.keys(example.payload)].join(" ").toLowerCase())}">
    <summary class="protocol-action-summary">
      <span class="protocol-action-type">${escapeHtml(action.type)}</span>
      <span class="protocol-action-title">${escapeHtml(action.label)}
        <small>${escapeHtml(action.summary)}</small>
      </span>
      <span class="protocol-action-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div class="protocol-action-details">
      <div class="protocol-label-row">
        <span class="protocol-mini-label">CUSTOM_JSON ID</span>
        <span class="protocol-mini-label">Posting authority</span>
      </div>
      <div class="protocol-copy-row">
        <code id="protocol-id-${escapeAttr(actionKey)}" tabindex="0">${escapeHtml(example.id)}</code>
        <button type="button" class="protocol-copy-btn"
          data-copy-target="protocol-id-${escapeAttr(actionKey)}"
          aria-label="Copy custom_json ID for ${escapeAttr(action.label)}">Copy ID</button>
      </div>
      <div class="protocol-fields-header"><h4>Payload fields</h4>
        <span>Fields shown are serialized by the live builder</span></div>
      <div class="protocol-table-scroll"><table class="protocol-field-table">
        <thead><tr><th scope="col">Field</th><th scope="col">Type</th><th scope="col">Meaning</th></tr></thead>
        <tbody>${fields}</tbody>
      </table></div>
      <div class="protocol-example-heading">
        <div><h4>JSON payload</h4><span>The object passed to JSON.stringify before Keychain signing</span></div>
        <button type="button" class="protocol-copy-btn"
          data-copy-target="protocol-payload-${escapeAttr(actionKey)}">Copy JSON</button>
      </div>
      <pre class="protocol-code"><code id="protocol-payload-${escapeAttr(actionKey)}"
        tabindex="0">${jsonCode(example.payload)}</code></pre>
      <details class="protocol-envelope-details">
        <summary>View complete Hive custom_json operation</summary>
        <div class="protocol-envelope-content">
          <p>The <code>json</code> field below is a serialized <strong>string</strong>,
            not an embedded object. Signing authority: <strong>Posting</strong>.</p>
          <div class="protocol-example-heading">
            <span class="protocol-mini-label">Hive operation body</span>
            <button type="button" class="protocol-copy-btn"
              data-copy-target="protocol-envelope-${escapeAttr(actionKey)}">Copy operation</button>
          </div>
          <pre class="protocol-code"><code id="protocol-envelope-${escapeAttr(actionKey)}"
            tabindex="0">${jsonCode(example.hiveOperation)}</code></pre>
        </div>
      </details>
    </div>
  </details>`;
}

function namespaceGroup(group, index) {
  const actions=group.operations.map(operationCard).filter(Boolean);
  return `<section class="protocol-namespace-group" id="protocol-${escapeAttr(group.key)}"
    data-search="${escapeAttr([group.label,group.id,group.summary].join(" ").toLowerCase())}">
    <header class="protocol-group-heading">
      <div class="protocol-group-heading-main">
        <span class="protocol-section-number">${String(index+1).padStart(2,"0")} / 07</span>
        <h3>${escapeHtml(group.label)}</h3>
        <p>${escapeHtml(group.summary)}</p>
      </div>
      <span class="protocol-group-scope">${escapeHtml(group.scope==="app"?"Shared namespace":
        group.scope==="community"?"Per community":
        group.scope==="user"?"Per signer":"Admin only")}</span>
    </header>
    <div class="protocol-namespace-code">
      <span>ID / ${escapeHtml(group.scope)}</span>
      <code>${escapeHtml(group.id)}</code>
    </div>
    <div class="protocol-operation-list">${actions.join("")}</div>
  </section>`;
}

export function buildProtocolReferencePage() {
  const groups=HIVE_NAMESPACE_REGISTRY;
  return `
    <main class="protocol-reference" aria-labelledby="protocolPageTitle">
      <header class="protocol-hero">
        <div class="protocol-hero-text">
          <span class="protocol-eyebrow"><span aria-hidden="true">◈</span> DEVELOPER REFERENCE · HIVE</span>
          <h1 id="protocolPageTitle">One protocol.<br><em>Every operation.</em></h1>
          <p>The actual custom_json IDs and payloads used by HiveLine.
            Generated directly from the app's v${HIVE_PROTOCOL_VERSION} registry
            and production payload builders.</p>
          <div class="protocol-hero-pills">
            <span>${groups.length} operation families</span>
            <span>${groups.reduce((total,group)=>total+group.operations.length,0)} actions</span>
            <span>Posting authority</span>
          </div>
        </div>
        <div class="protocol-hero-aside" aria-label="Protocol identity">
          <span>APP IDENTITY</span><code>${escapeHtml(HIVE_APP_ID)}</code>
          <small>Protocol v${HIVE_PROTOCOL_VERSION} · Read-only reference</small>
        </div>
      </header>
      <aside class="protocol-note" role="note">
        <span class="protocol-note-symbol" aria-hidden="true">!</span>
        <div><strong>Historical Micro.fair data is preserved but hidden from HiveLine.</strong>
          <p><code>micro.fair.interation</code> (votes) and
             <code>micro.fair.adpmuted</code> (moderation) retain their original spelling.
             HiveLine instead uses hiveline.votes and hiveline.moderation; old records remain on-chain.</p></div>
      </aside>
      ${buildProtocolValidatorSection()}
      <div class="protocol-toolbar">
        <div class="protocol-toolbar-heading">
          <span class="protocol-eyebrow">BROWSE NAMESPACES</span>
          <h2>Operation directory</h2>
        </div>
        <label class="protocol-search-wrap">
          <span class="visually-hidden">Filter protocol IDs, actions and fields</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>
          </svg>
          <input id="protocolSearch" type="search" autocomplete="off"
                 placeholder="Filter IDs, actions, fields…" aria-label="Filter protocol operations">
        </label>
      </div>
      <nav class="protocol-quick-nav" aria-label="Jump to protocol namespace">
        ${groups.map(group=>`<a href="#/protocol?section=${encodeURIComponent(group.key)}"
           data-protocol-jump="${escapeAttr(group.key)}">${escapeHtml(group.label)}</a>`).join("")}
      </nav>
      <p class="protocol-results-message" id="protocolFilterStatus" role="status" aria-live="polite"></p>
      <div class="protocol-groups">${groups.map(namespaceGroup).join("")}</div>
      <div class="protocol-empty hidden" id="protocolFilterEmpty">
        <strong>No matching operations</strong><p>Try another action, field or custom_json ID.</p>
      </div>
      <footer class="protocol-footer">
        <div><span class="protocol-eyebrow">IMPLEMENTATION NOTES</span>
          <h2>How these messages work</h2></div>
        <div class="protocol-footer-grid">
          <p><strong>Replies:</strong> they use the same custom_json ID as the original
            post. The <code>type</code> is <code>reply</code> and <code>reply_to</code>
            points to the numeric HAFSQL operation ID.</p>
          <p><strong>Communities:</strong> creation is sent to
            <code>hiveline.communities</code>; posts use fresh per-community
            IDs like <code>hiveline.c.dev</code>.</p>
          <p><strong>Relationships:</strong> follow and block share
            <code>hiveline.relationships</code>; their signer is identified by
            <code>required_posting_auths</code>.</p>
          <p><strong>Transport:</strong> Keychain uses <code>Posting</code> authority;
            <code>json</code> is a serialized string. This reference never
            broadcasts transactions or requests keys.</p>
          <p><strong>Example IDs:</strong> <code>${PROTOCOL_EXAMPLE_CONTENT_ID}</code>
            is a placeholder HAFSQL operation ID, not a real post.
            Production IDs are assigned to recorded custom_json operations.</p>
          <p><strong>Manual Custom JSON:</strong> the advanced tool can broadcast
            arbitrary IDs. It is not a HiveLine protocol operation unless it
            follows one of the registered formats above.</p>
        </div>
      </footer>
    </main>`;
}

export function setupProtocolReferenceEvents(root = document) {
  setupProtocolValidatorWorkbench(root);
  const input=root.getElementById("protocolSearch");
  if (!input) return;
  const groups=[...root.querySelectorAll(".protocol-namespace-group")];
  const status=root.getElementById("protocolFilterStatus");
  const empty=root.getElementById("protocolFilterEmpty");

  const filter=()=>{
    const query=input.value.trim().toLowerCase();
    let visible=0;
    for(const group of groups) {
      const wholeGroup=(group.dataset.search||"").includes(query);
      let count=0;
      for(const action of group.querySelectorAll(".protocol-action-entry")) {
        const matched=wholeGroup||(action.dataset.search||"").includes(query);
        action.hidden=!matched;
        if(matched)count++;
      }
      group.hidden=count===0;
      visible+=count;
    }
    if(empty)empty.classList.toggle("hidden",visible!==0);
    if(status)status.textContent=query ? `Showing ${visible} matching operations.` : "";
  };
  input.addEventListener("input",filter);

  root.querySelectorAll(".protocol-copy-btn").forEach(button=>{
    button.addEventListener("click",async()=>{
      const target=root.getElementById(button.dataset.copyTarget);
      if(!target)return;
      const value=target.textContent||"";
      if(!navigator.clipboard?.writeText) {
        button.textContent="Select text to copy";
        target.focus();
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        button.textContent="Copied";
        setTimeout(()=>{if(button.isConnected) button.textContent=button.dataset.copyTarget.startsWith("protocol-id")?
          "Copy ID":button.dataset.copyTarget.startsWith("protocol-payload")?"Copy JSON":"Copy operation";},1300);
      } catch {
        button.textContent="Select text to copy";
        target.focus();
      }
    });
  });

  // Quick links use real #/protocol?section=... URLs for shareable deep links.
  // The router renders the target and scrolls to it after navigation.
}
