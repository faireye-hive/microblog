import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TopNavHTML, LoginModalHTML } from "../js/templates.js";
import { setAuthCallbacks, setupAuthListeners, updateLoginUI } from "../js/auth.js";

const css = readFileSync(new URL("../css/refined.css", import.meta.url), "utf8");
const securityHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("account button is an accessible native control with distinct login/profile states", () => {
  assert.match(TopNavHTML, /<button[^>]*id="btnMenu"/);
  assert.match(TopNavHTML, /aria-expanded="false"/);
  assert.match(TopNavHTML, /id="accountTriggerLabel"/);
  assert.match(TopNavHTML, /id="accountGuestIcon"/);
  assert.match(TopNavHTML, /id="navUserAvatar"/);
  assert.match(TopNavHTML, /id="accountMenuName"/);
  assert.match(TopNavHTML, /id="accountMenuStatus"/);
  for (const id of ["menuLogin","menuProfile","menuMyVotes","menuMyComments",
    "menuMyReplies","clearCacheButton","menuLogout"]) {
    assert.equal((TopNavHTML.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  }
  assert.doesNotMatch(TopNavHTML, /<div class="user-menu-trigger"/);
  assert.doesNotMatch(TopNavHTML, /<span>🔑|<span>🚪/);
});

test("Keychain login dialog has associated fields, status cues and no unsafe script", () => {
  for (const pattern of [
    /role="dialog"/, /aria-modal="true"/, /aria-labelledby="loginTitle"/,
    /aria-describedby="loginDescription"/, /id="loginForm"/,
    /<label[^>]*for="loginUsername"/, /id="loginUsername"/,
    /autocomplete="username"/, /aria-describedby="authUsernameHint"/,
    /id="confirmLogin" type="submit"/, /id="cancelLoginModal"/,
    /id="closeLoginModal"/, /Não solicitamos suas chaves/,
  ]) assert.match(LoginModalHTML, pattern);
  assert.doesNotMatch(LoginModalHTML, /\son(?:click|load|error)=/i);
  assert.match(securityHtml, /script-src 'self'/);
});

test("responsive neutral visual design supports dropdown, modal and focus", () => {
  for (const pattern of [
    /\.account-menu-shell\s*\{/, /\.account-trigger-label/,
    /\.account-menu-heading/, /\.account-menu-items/,
    /\.account-menu-logout/, /\.auth-dialog-symbol/,
    /\.auth-username-input/, /\.auth-submit/,
    /\.auth-security-note/, /\.auth-dismiss-btn/,
    /@media \(max-width: 430px\)/, /:focus-visible/,
  ]) assert.match(css, pattern);
});

function setupFakeDOM() {
  class FakeElement {
    constructor(id) {
      this.id=id;
      this.hidden=false;
      this.innerHTML="";
      this.textContent="";
      this.alt="";
      this.src="";
      this.dataset={};
      this.attrs={};
      this.listeners={};
      this.value="";
      this.disabled=false;
      this.classSet=new Set(["menuLogin","menuProfile","menuMyVotes","menuMyComments","menuMyReplies","menuLogout","userMenuDropdown","loginModal","logoutConfirmModal"].includes(id)?["hidden"]:[]);
      this.classList={
        contains: x=>this.classSet.has(x),
        add: x=>this.classSet.add(x),
        remove: x=>this.classSet.delete(x),
        toggle: (x,force)=> {
          if (force===undefined)force=!this.classSet.has(x);
          if(force)this.classSet.add(x);else this.classSet.delete(x);
          return force;
        }
      };
    }
    setAttribute(k,v){this.attrs[k]=String(v);}
    getAttribute(k){return this.attrs[k]??null;}
    addEventListener(event,fn){(this.listeners[event]??=[]).push(fn);}
    dispatch(event,e={}){for(const fn of this.listeners[event]||[])fn({preventDefault(){},stopPropagation(){},target:this,...e});}
    click(){this.dispatch("click");}
    focus(){globalThis.document.activeElement=this;}
    querySelector(){return elements.menuProfile;}
    querySelectorAll(){return [];}
    appendChild(child){this.lastChild=child;return child;}
    remove(){}
    closest(selector){return selector==="#btnMenu"&&this.id==="btnMenu"?this:null;}
  }
  const ids=["menuLogin","menuLogout","menuProfile","menuMyVotes","menuMyComments",
    "menuMyReplies","navFollowedLink","btnMenu","accountTriggerLabel",
    "accountGuestIcon","accountMenuName","accountMenuStatus","accountMenuSectionLabel",
    "menuUserLabel","navUserAvatar","composerAvatar","loginUsername",
    "loginForm","confirmLogin","loginSubmitLabel","loginModal","logoutConfirmModal",
    "userMenuDropdown","cancelLoginModal","closeLoginModal","cancelLogout",
    "confirmLogout","clearCacheButton"];
  const elements=Object.fromEntries(ids.map(id=>[id,new FakeElement(id)]));
  Object.defineProperty(elements.navUserAvatar,"innerHTML",{set(){throw new Error("Must not nest an img inside avatar img");},get(){return "";}});
  Object.defineProperty(elements.composerAvatar,"innerHTML",{set(){throw new Error("Must not nest an img inside composer img");},get(){return "";}});
  const stored=new Map();
  const doc={getElementById:id=>elements[id]||null,addEventListener(){},createElement:tag=>new FakeElement(tag),body:new FakeElement("body"),activeElement:null};
  const local={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
  return {elements,stored,doc,local};
}

test("logged-out header opens login directly; signed login updates img.src and controls", () => {
  const oldDoc=globalThis.document,oldStorage=globalThis.localStorage,oldWindow=globalThis.window,oldTimeout=globalThis.setTimeout;
  globalThis.setTimeout=()=>0;
  const {elements,stored,doc,local}=setupFakeDOM();
  globalThis.document=doc;
  globalThis.localStorage=local;
  let requests=0, loggedIn=null;
  globalThis.window={hive_keychain:{requestSignBuffer:(name,message,key,callback)=>{
    requests++;
    assert.equal(name,"faireye");
    assert.equal(key,"Posting");
    callback({success:true});
  }}};
  try{
    setAuthCallbacks(user=>{loggedIn=user;},()=>{});
    setupAuthListeners();
    assert.equal(elements.btnMenu.dataset.authenticated,"false");
    assert.equal(elements.accountTriggerLabel.textContent,"Entrar");
    assert.ok(elements.menuLogout.classList.contains("hidden"));
    assert.ok(elements.navUserAvatar.classList.contains("hidden"));
    elements.btnMenu.click();
    assert.equal(elements.loginModal.classList.contains("hidden"),false);
    assert.equal(doc.activeElement,elements.loginUsername);
    elements.loginUsername.value="faireye";
    elements.loginForm.dispatch("submit");
    assert.equal(requests,1);
    assert.equal(stored.get("hiveUser"),"faireye");
    assert.equal(loggedIn,"faireye");
    assert.ok(elements.loginModal.classList.contains("hidden"));
    assert.equal(elements.btnMenu.dataset.authenticated,"true");
    assert.equal(elements.accountTriggerLabel.textContent,"@faireye");
    assert.equal(elements.menuLogin.classList.contains("hidden"),true);
    assert.equal(elements.menuLogout.classList.contains("hidden"),false);
    assert.equal(elements.navUserAvatar.classList.contains("hidden"),false);
    assert.match(elements.navUserAvatar.src,/images\.hive\.blog\/u\/faireye\/avatar/);
    assert.equal(elements.navUserAvatar.alt,"Avatar de @faireye");
    assert.match(elements.composerAvatar.src,/faireye\/avatar/);
    elements.btnMenu.click();
    assert.equal(elements.btnMenu.getAttribute("aria-expanded"),"true");
    elements.menuProfile.dispatch("click");
    assert.equal(elements.btnMenu.getAttribute("aria-expanded"),"false");
  } finally {
    globalThis.document=oldDoc;globalThis.localStorage=oldStorage;globalThis.window=oldWindow;globalThis.setTimeout=oldTimeout;
  }
});

test("repeated authentication UI update leaves avatars as image elements",()=>{
  const oldDoc=globalThis.document,oldStorage=globalThis.localStorage,oldWindow=globalThis.window;
  const {elements,doc,local}=setupFakeDOM();
  globalThis.document=doc;globalThis.localStorage=local;globalThis.window={};
  try {
    local.setItem("hiveUser","sm-silva");
    updateLoginUI();
    updateLoginUI();
    assert.match(elements.navUserAvatar.src,/sm-silva\/avatar/);
    assert.match(elements.composerAvatar.src,/sm-silva\/avatar/);
    local.removeItem("hiveUser");
    updateLoginUI();
    assert.equal(elements.btnMenu.dataset.authenticated,"false");
    assert.ok(elements.navUserAvatar.classList.contains("hidden"));
    assert.match(elements.composerAvatar.src,/\/hive\/avatar/);
  } finally {
    globalThis.document=oldDoc;globalThis.localStorage=oldStorage;globalThis.window=oldWindow;
  }
});
