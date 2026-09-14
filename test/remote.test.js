import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {createRemoteController} from '../remote.js';

class Emitter{
 events=new Map();open=false;metadata={};
 on(name,callback){const callbacks=this.events.get(name)||[];callbacks.push(callback);this.events.set(name,callbacks);return this}
 emit(name,data){for(const fn of this.events.get(name)||[])fn(data)}
 close(){this.open=false;this.emit('close')}
 send(){}
}
function harness(t,phone=false){
 const dom=new JSDOM(readFileSync(new URL('../index.html',import.meta.url),'utf8'),{url:'https://fakecable.test/',pretendToBeVisual:true});
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false};
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 const peers=[],connections=[];
 class Peer extends Emitter{
  constructor(){super();peers.push(this)}
  connect(){const c=new Emitter();connections.push(c);return c}
  destroy(){this.destroyed=true}
  reconnect(){this.disconnected=false;this.open=true;this.emit('open','peer-id')}
 }
 const originals={};
 const values={document:dom.window.document,window:dom.window,location:dom.window.location,navigator:dom.window.navigator,Peer,QRCode:class{static CorrectLevel={M:0}}};
 for(const [key,value] of Object.entries(values)){originals[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true,writable:true})}
 t.after(()=>{dom.window.close();for(const key of Object.keys(values)){if(originals[key])Object.defineProperty(globalThis,key,originals[key]);else delete globalThis[key]}});
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:100000});
 const state={row:0,col:0},actions=[];
 const controller=createRemoteController({state,getChannels:()=>[],remoteParams:new URLSearchParams('remote=tv&key=secret'),nowSec:()=>0,esc:String,isDirectYouTubeInput:()=>false,handleTvAction:action=>actions.push(action),handleAddChannel:()=>{}});
 if(phone)controller.initPhoneRemote();else {controller.openPairing();peers[0].emit('open','tv')}
 return {state,controller,peers,connections,actions,document:dom.window.document};
}

test('TV rejects an incorrect pairing key before accepting any commands',t=>{
 const {peers,state,actions}=harness(t);const c=new Emitter();c.metadata={key:'wrong'};peers[0].emit('connection',c);c.emit('data',{type:'action',action:'captions'});assert.deepEqual(actions,[]);assert.equal(state.remoteConnection,undefined);
});
test('late events from a replaced phone cannot disconnect or command the TV',t=>{
 const {peers,state,actions,document}=harness(t);
 const connect=()=>{const c=new Emitter();c.metadata={key:state.pairKey};peers[0].emit('connection',c);c.open=true;c.emit('open');return c};
 const old=connect(),fresh=connect();old.emit('close');old.emit('data',{type:'action',action:'mute'});
 assert.equal(state.remoteConnection,fresh);assert.ok(document.body.classList.contains('remote-paired'));assert.deepEqual(actions,[]);
 fresh.emit('data',{type:'action',action:'captions'});assert.deepEqual(actions,['captions']);
});
test('phone connection errors clear the in-flight latch and permit a new connection',t=>{
 const {peers,connections}=harness(t,true);peers[0].open=true;peers[0].emit('open');assert.equal(connections.length,1);
 connections[0].emit('error');t.mock.timers.tick(1000);assert.equal(connections.length,2);
});
test('late status from an abandoned connection cannot overwrite the phone',t=>{
 const {peers,connections,document}=harness(t,true);peers[0].open=true;peers[0].emit('open');const old=connections[0];old.emit('error');t.mock.timers.tick(1000);
 const fresh=connections[1];fresh.open=true;fresh.emit('open');
 fresh.emit('data',{type:'status',channels:[],title:'New program',guide:false});old.emit('data',{type:'status',channels:[],title:'Stale program',guide:true});
 assert.equal(document.querySelector('#phone-title').textContent,'New program');assert.equal(document.querySelector('[data-phone-action="nav-left"]').disabled,true);
});


test('phone gives a pending handshake time to finish, then replaces a stuck signalling peer',t=>{
 const {peers}=harness(t,true);t.mock.timers.tick(10000);assert.equal(peers.length,1);t.mock.timers.tick(5000);assert.equal(peers.length,2);assert.equal(peers[0].destroyed,true);
});
