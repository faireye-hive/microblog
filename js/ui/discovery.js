/*
 * Read-only discovery markup. All user-supplied Hive content and account metadata
 * are escaped before interpolating HTML or URL attributes.
 */
import { escapeHtml, escapeAttr, parseEmbeddedJson } from "../utils.js";
import { safeHiveUsername, safeTag } from "../security/safe-values.js";
import { parseChannelCustomId } from "../helpers/channel-id.js";
import { collectDiscoveryTags } from "../helpers/discovery.js";

const magnifier = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
  <circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>
</svg>`;

const arrow = '<span aria-hidden="true">↗</span>';
const pathForTag=tag=>`#/tag/${encodeURIComponent(tag)}`;
const pathForChannel=id=>`#/channel/${encodeURIComponent(id)}`;
const pathForPerson=name=>`#/user/${encodeURIComponent(safeHiveUsername(name))}`;
const resultPath=query=>`#/search?q=${encodeURIComponent(query)}`;

function communityCard(channel) {
  const id=parseChannelCustomId(channel?.id);
  if(!id)return "";
  const name=typeof channel.name==="string"&&channel.name?channel.name:id;
  const desc=typeof channel.description==="string" ? channel.description:"";
  return `
    <a class="discovery-community-card" href="${escapeAttr(pathForChannel(id))}">
      <span class="discovery-community-hash" aria-hidden="true">#</span>
      <span class="discovery-community-content">
        <strong>${escapeHtml(name)}</strong>
        <small>#${escapeHtml(id)}</small>
        ${desc?`<span class="discovery-community-description">${escapeHtml(desc)}</span>`:""}
      </span>
      <span class="discovery-community-arrow" aria-hidden="true">↗</span>
    </a>`;
}

function topicLink({tag,count}) {
  const clean=safeTag(tag);if(!clean)return "";
  return `<a class="discovery-topic-chip" href="${escapeAttr(pathForTag(clean))}">
    <span class="discovery-topic-hash" aria-hidden="true">#</span>${escapeHtml(clean)}
    <span class="discovery-topic-count" aria-label="${count} posts">${count}</span>
  </a>`;
}

export function buildExploreOverview({posts=[],channels=[],mode="latest"}={}) {
  const topics=collectDiscoveryTags(posts,9);
  const featured=channels.filter(channel=>parseChannelCustomId(channel?.id)).slice(0,3);
  const tabs=[
    {id:"latest",label:"Latest",href:"#/explore",description:"The newest posts from the loaded feed"},
    {id:"popular",label:"Popular",href:"#/trending",description:"Posts with the most votes in the past month"},
    {id:"discussed",label:"Discussed",href:"#/active",description:"Conversations with the most replies"}
  ];
  const active=tabs.find(tab=>tab.id===mode)||tabs[0];
  return `
  <section class="discovery-overview" aria-labelledby="exploreTitle">
    <header class="discovery-hero">
      <div class="discovery-hero-copy">
        <span class="discovery-eyebrow"><span class="discovery-pulse" aria-hidden="true"></span>
          DISCOVER ON HIVE</span>
        <h1 id="exploreTitle">Interesting things<br><em>start here.</em></h1>
        <p>Follow the conversations, communities and ideas emerging from the posts you've loaded.</p>
        <div class="discovery-hero-stats">
          <span><strong>${posts.length}</strong> posts loaded</span>
          <span class="discovery-stats-divider" aria-hidden="true"></span>
          <span><strong>${topics.length}</strong> topics shown</span>
        </div>
      </div>
      <span class="discovery-hero-decoration" aria-hidden="true">✳</span>
    </header>
    <div class="discovery-search-bar">
      ${magnifier}
      <input type="search" id="exploreSearchInput" aria-label="Search loaded posts and communities"
             placeholder="Search a topic, keyword or account…" maxlength="100" autocomplete="off">
      <button type="button" id="exploreSearchButton" class="discovery-search-submit">Search ${arrow}</button>
    </div>
    <div class="discovery-overview-section">
      <div class="discovery-section-top">
        <div><span class="discovery-section-label">01 / TOPICS</span><h2>What people are talking about</h2></div>
        <span class="discovery-section-caption">Based on loaded posts</span>
      </div>
      <div class="discovery-topics">
        ${topics.length?topics.map(topicLink).join(""):'<p class="discovery-no-data">Topics will appear as posts are loaded.</p>'}
      </div>
    </div>
    <div class="discovery-overview-section discovery-communities-section">
      <div class="discovery-section-top">
        <div><span class="discovery-section-label">02 / COMMUNITIES</span><h2>Find your corner of Hive</h2></div>
        <a class="discovery-section-link" href="#/channels">All communities →</a>
      </div>
      <div class="discovery-community-list">
        ${featured.length?featured.map(communityCard).join(""):'<p class="discovery-no-data">Communities will appear when discovered on Hive.</p>'}
      </div>
    </div>
    <section class="discovery-posts-section" aria-labelledby="explorePostsTitle">
      <div class="discovery-section-top">
        <div><span class="discovery-section-label">03 / CONVERSATIONS</span>
          <h2 id="explorePostsTitle">Worth a look</h2></div>
        <span class="discovery-section-caption">${escapeHtml(active.description)}</span>
      </div>
      <nav class="discovery-feed-tabs" aria-label="Explore post sorting">
        ${tabs.map(tab=>`<a href="${tab.href}" class="discovery-feed-tab ${mode===tab.id?"active":""}"
          ${mode===tab.id?'aria-current="page"':""}>${tab.label}</a>`).join("")}
      </nav>
    </section>
  </section>`;
}

export function buildSearchOverview({results}={}) {
  const r=results||{query:"",communities:[],people:[],topics:[],totalPosts:0};
  const total=r.communities.length+r.people.length+r.topics.length+r.totalPosts;
  const q=r.query||"";
  return `
    <section class="discovery-search-page" aria-labelledby="searchPageTitle">
      <div class="discovery-search-hero">
        <span class="discovery-eyebrow">SEARCH / LOADED HIVE CONTENT</span>
        <h1 id="searchPageTitle">Search the <em>conversation.</em></h1>
        <p>Results from posts and communities currently loaded in HiveLine — not a full Hive blockchain search.</p>
        <div class="discovery-search-bar">
          ${magnifier}
          <input type="search" id="searchPageInput" aria-label="Search posts, people and communities"
                 value="${escapeAttr(q)}" maxlength="100" placeholder="Try #hive, @account, or a keyword"
                 autocomplete="off">
          <button type="button" id="searchPageSubmit" class="discovery-search-submit">Search ${arrow}</button>
        </div>
        ${q?`<p class="discovery-results-summary">Showing matches for
          <strong>“${escapeHtml(q)}”</strong>
          <span class="discovery-summary-divider">·</span>
          ${total} matching items in loaded content</p>`:""}
      </div>
      ${r.topics.length?`<div class="discovery-search-section">
        <h2>Related topics <span>${r.topics.length}</span></h2>
        <div class="discovery-topics">${r.topics.slice(0,8).map(topicLink).join("")}</div>
      </div>`:""}
      ${r.communities.length?`<div class="discovery-search-section">
        <div class="discovery-section-top"><h2>Communities <span>${r.communities.length}</span></h2>
          <a class="discovery-section-link" href="#/channels">Browse all →</a></div>
        <div class="discovery-community-list">${r.communities.slice(0,4).map(communityCard).join("")}</div>
      </div>`:""}
      ${r.people.length?`<div class="discovery-search-section">
        <h2>People in the conversation <span>${r.people.length}</span></h2>
        <div class="discovery-people-list">
          ${r.people.slice(0,6).map(person=>`<a href="${escapeAttr(pathForPerson(person.user))}" class="discovery-person">
            <span class="discovery-person-avatar" aria-hidden="true">@</span>
            <strong>@${escapeHtml(person.user)}</strong>
            <span>${person.count} matching ${person.count===1?"post":"posts"}</span>
            ${arrow}
          </a>`).join("")}
        </div>
      </div>`:""}
      <div class="discovery-search-post-heading">
        <span class="discovery-section-label">POST RESULTS</span>
        <h2>${r.totalPosts} matching ${r.totalPosts===1?"post":"posts"}</h2>
        ${!q?'<p>Enter a keyword above to search your loaded content.</p>':
          !total?'<p>No matches in the content currently loaded. Try another keyword.</p>':
          !r.totalPosts?'<p>No matching posts. You can still explore the related topics and communities above.</p>':""}
      </div>
    </section>`;
}

export function buildSearchSuggestions(results) {
  const r=results||{query:"",posts:[],communities:[],people:[],topics:[]};
  const query=r.query||"";
  if(!query) return '<div class="search-suggestions-hint">Try a keyword, <strong>#topic</strong> or <strong>@account</strong>.</div>';
  const items=[];
  const push=(label,href,icon,subtitle)=>{
    const index=items.length;
    items.push(`<a id="search-option-${index}" class="search-suggestion-item" role="option"
      aria-selected="false" href="${escapeAttr(href)}">
      <span class="search-suggestion-icon" aria-hidden="true">${icon}</span>
      <span class="search-suggestion-main"><strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(subtitle)}</small></span><span aria-hidden="true">↗</span></a>`);
  };
  for(const entry of r.communities.slice(0,2)){
    const id=parseChannelCustomId(entry?.id);
    if(id)push(typeof entry.name==="string"&&entry.name?entry.name:id,pathForChannel(id),"#","Community · #"+id);
  }
  for(const entry of r.topics.slice(0,2)){
    const tag=safeTag(entry.tag);
    if(tag)push("#"+tag,pathForTag(tag),"#",`${entry.count} related posts`);
  }
  for(const entry of r.people.slice(0,2)){
    const user=safeHiveUsername(entry.user);
    if(user!=="unknown")push("@"+user,pathForPerson(user),"@","Posts by this account");
  }
  for(const post of r.posts.slice(0,3)){
    if(!/^\d+$/.test(String(post.id)))continue;
    const rawContent=parseEmbeddedJson(post.json)?.content;
    const content=(typeof rawContent==="string"?rawContent:"").replace(/\s+/g," ").trim();
    const author=safeHiveUsername(post.required_posting_auths?.[0]);
    push(content.slice(0,80)||"Post by @"+author,`#/thread/${encodeURIComponent(post.id)}`,"↗","Post by @"+author);
  }
  const count=items.length;
  const empty='<div class="search-suggestions-hint">No matches in the posts currently loaded.</div>';
  return `<div class="search-suggestions-inner">
    <div class="search-suggestions-kicker">IN LOADED CONTENT</div>
    ${count?items.join(""):empty}
    <a href="${escapeAttr(resultPath(query))}" class="search-suggestions-all">See all results for “${escapeHtml(query)}” <span aria-hidden="true">→</span></a>
  </div>`;
}
