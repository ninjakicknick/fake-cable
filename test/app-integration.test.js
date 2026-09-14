import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {LINEUP_VERSION,CATALOG_VERSION} from '../storage.js';

async function harness(t,{corrupt=false,fetchImpl=null}={}){
 const errors=[],console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error));t.after(()=>assert.deepEqual(errors,[]));
 const dom=new JSDOM(readFileSync(new URL('../index.html',import.meta.url),'utf8'),{url:'https://fakecable.test/',pretendToBeVisual:true,virtualConsole:console});
 const {window}=dom;
 window.HTMLElement.prototype.scrollIntoView=function(){};
 window.HTMLCanvasElement.prototype.getContext=()=>null;
 const storage=window.localStorage;
 const sources=['A','B','C'].map((name,i)=>({name,channelId:`channel-${i}`,color:'#123456',shows:[[name,name,`video-${i}`,1800]],updatedAt:Date.now()}));
 storage.setItem('fake-cable-stations',JSON.stringify(sources.map(ch=>({value:ch.channelId,label:ch.name}))));
 storage.setItem('elsewhere-channels',JSON.stringify(sources));
 storage.setItem('fake-cable-lineup-version',LINEUP_VERSION);storage.setItem('fake-cable-catalog-version',CATALOG_VERSION);
 storage.setItem('fake-cable-commercials',JSON.stringify({enabled:false,shows:[],unavailableIds:[]}));
 if(corrupt){storage.setItem('fake-cable-stations','{');storage.setItem('elsewhere-channels','{}');storage.setItem('fake-cable-mixes','[null]');storage.setItem('elsewhere-last-channel','oops');}
 const loaded=[],players=[];
 class Player{
  constructor(id,{events}){this.events=events;this.video='';players.push(this)}
  loadVideoById({videoId}){this.video=videoId;loaded.push(videoId)}
  getPlayerState(){return 1}
  getVideoData(){return {video_id:this.video}}
  getDuration(){return 1800}
  getCurrentTime(){return 10}
  mute(){} unMute(){} stopVideo(){}
 }
 const replacements={window,document:window.document,location:window.location,history:window.history,navigator:window.navigator,localStorage:storage,YT:{Player,PlayerState:{ENDED:0,PLAYING:1,PAUSED:2}},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},fetch:fetchImpl||async function(){throw Error('Test offline')}};
 for(const [key,value] of Object.entries(replacements)){
  const previous=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else delete globalThis[key]});
 }
 t.mock.timers.enable({apis:['setTimeout','setInterval']});t.after(()=>dom.window.close());
 await import(`../app.js?test=${Math.random()}`);
 window.onYouTubeIframeAPIReady();players[0].events.onReady({target:players[0]});
 const click=selector=>{const el=window.document.querySelector(selector);assert.ok(el,selector);el.click()};
 const text=selector=>window.document.querySelector(selector).textContent;
 click('#start');return {window,storage,loaded,players,click,text};
}

test('full app: reorder and mix edits keep playback, guide, and transitions wired together',async t=>{
 const {window,click,loaded,players,text}=await harness(t);
 assert.deepEqual(loaded,['video-0']);click('[data-action="settings"]');
 click('[data-guide-move="0:1"]');assert.deepEqual(loaded,['video-0']);
 click('#close-setup');click('[data-action="guide"]');assert.match(text('#selected-meta'),/CH 03 · A/);
 click('#back-to-tv');click('[data-action="settings"]');click('#create-mix');
 window.document.querySelector('#mix-name').value='Test mix';
 window.document.querySelectorAll('#mix-source-list input').forEach((input,i)=>input.checked=i<2);
 click('#save-mix');assert.equal(window.document.querySelectorAll('.guide-lineup-item').length,2);
 assert.equal(loaded.length,2);assert.ok(['video-0','video-1','video-2'].includes(loaded.at(-1)));
 click('#close-setup');click('[data-action="guide"]');
 players[0].events.onStateChange({data:0,target:players[0]});
 assert.equal(window.document.querySelector('#guide').classList.contains('hidden'),false);
 assert.equal(loaded.length,2);
});

test('full app: malformed saved data still reaches a playable starter lineup',async t=>{
 const {loaded,window}=await harness(t,{corrupt:true});
 assert.ok(loaded.length);assert.equal(window.document.querySelector('#welcome').style.display,'none');
});


test('full app: refresh adopts the deterministic refreshed broadcast and excludes concurrent mix edits',async t=>{
 let resolve;
 const response=new Promise(done=>resolve=done);
 const {click,window,loaded,storage}=await harness(t,{fetchImpl:()=>response});
 click('[data-action="settings"]');click('#create-mix');
 window.document.querySelector('#mix-name').value='Busy mix';window.document.querySelectorAll('#mix-source-list input').forEach((input,i)=>input.checked=i<2);
 click('[data-refresh="0"]');click('#save-mix');assert.equal(window.document.querySelectorAll('.mix-item').length,0);
 resolve({ok:true,json:async()=>({channels:[{channelId:'channel-0',name:'A refreshed',shows:[{title:'Replacement',source:'A',id:'replacement',duration:120}]}]})});
 await new Promise(setImmediate);
 assert.deepEqual(loaded,['video-0','replacement']);assert.equal(JSON.parse(storage.getItem('elsewhere-channels'))[0].shows[0][2],'replacement');
 assert.equal(window.document.querySelector('[data-refresh="0"]').disabled,false);
 assert.equal(storage.getItem('fake-cable-last-channel-id'),'channel-0');
});
