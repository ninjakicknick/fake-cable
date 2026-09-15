import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createPlayerController} from '../player.js';

function harness(t,{nowSec=()=>0,currentIndex=()=>0}={}){
 const noop=()=>{};
 const channels=['a','b'].map(id=>({channelId:id,shows:[[id,'source',id,60]],schedule:[{id,start:0,end:60,duration:60}]}));
 const state={row:0,col:0,current:null,ready:false,muted:false,skippingUnavailable:false};
 const loaded=[],seeks=[];
 let events;
 const globals={
  document:{querySelector:()=>null},
  window:{},
  location:{protocol:'https:',origin:'https://fakecable.com'},
  localStorage:{setItem:noop},
  YT:{PlayerState:{ENDED:0,PLAYING:1,PAUSED:2},Player:class{
   constructor(id,options){events=options.events;this.currentTime=0;this.playerState=1}
   loadVideoById(video){loaded.push(video.videoId);this.currentTime=video.startSeconds||0}
   getPlayerState(){return this.playerState}
   getVideoData(){return {video_id:loaded.at(-1)}}
   getCurrentTime(){return this.currentTime}
   seekTo(seconds){seeks.push(seconds);this.currentTime=seconds}
   playVideo(){this.playerState=1}
  }}
 };
 for(const [key,value] of Object.entries(globals)){
  const original=Object.getOwnPropertyDescriptor(globalThis,key);
  Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  t.after(()=>{if(original)Object.defineProperty(globalThis,key,original);else delete globalThis[key]});
 }
 t.mock.timers.enable({apis:['setTimeout']});
 const controller=createPlayerController({
  state,getChannels:()=>channels,getSourceChannels:()=>channels,getCommercialConfig:()=>({}),
  nowSec,currentIndex,activeCommercials:()=>[],scheduleChannels:noop,
  normalizeLineup:noop,saveCommercialConfig:noop,saveLineup:noop,render:noop,
  showGuide:noop,showBanner:noop,showInterstitial:noop,hideInterstitial:noop,
  showTuningStatic:noop,hideTuningStatic:noop,toast:noop
 });
 controller.createYouTubePlayer();
 events.onReady();
 controller.tune(0);
 return {state,channels,controller,events,loaded,seeks};
}

test('switching channels during the error delay never blacklists the new video',t=>{
 const {controller,events,channels,state,loaded}=harness(t);
 events.onError({data:100});
 t.mock.timers.tick(300);
 controller.tune(1);
 t.mock.timers.tick(700);
 assert.deepEqual(channels.map(ch=>ch.shows.map(show=>show[2])),[['a'],['b']]);
 assert.equal(state.current.p.id,'b');
 assert.equal(state.skippingUnavailable,false);
 assert.deepEqual(loaded,['a','b']);
});

test('a newly tuned video can report its own error while the old delay is pending',t=>{
 const {controller,events,channels,state}=harness(t);
 events.onError({data:100});
 t.mock.timers.tick(300);
 controller.tune(1);
 events.onError({data:100});
 t.mock.timers.tick(400);
 assert.equal(channels[1].shows.length,1);
 assert.equal(state.skippingUnavailable,true);
 t.mock.timers.tick(300);
 assert.deepEqual(channels[0].shows.map(show=>show[2]),['a']);
 assert.deepEqual(channels[1].unavailableIds,['b']);
 assert.equal(channels[1].shows.length,0);
 assert.equal(state.skippingUnavailable,false);
});

test('an unchanged failed program is still removed after the delay',t=>{
 const {events,channels,state}=harness(t);
 events.onError({data:100});
 t.mock.timers.tick(699);
 assert.equal(channels[0].shows.length,1);
 t.mock.timers.tick(1);
 assert.deepEqual(channels[0].unavailableIds,['a']);
 assert.equal(channels[0].shows.length,0);
 assert.equal(state.skippingUnavailable,false);
});

test('replacing current state without loading cannot redirect a pending skip',t=>{
 const {events,channels,state}=harness(t);
 events.onError({data:100});
 state.current={row:1,ch:channels[1],p:channels[1].schedule[0]};
 t.mock.timers.tick(700);
 assert.deepEqual(channels.map(ch=>ch.shows.map(show=>show[2])),[['a'],['b']]);
 assert.equal(state.skippingUnavailable,false);
});

test('successful playback cancels a transient error skip',t=>{
 const {events,channels,state}=harness(t);
 events.onError({data:100});
 events.onStateChange({data:1});
 t.mock.timers.tick(700);
 assert.equal(channels[0].shows.length,1);
 assert.equal(state.skippingUnavailable,false);
});

// Execute the actual app tick with browser collaborators stubbed. This covers
// its wiring to tune(), rather than duplicating the transition in a test helper.
const appSource=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const tickSource=appSource.slice(appSource.indexOf('function tick(){'),appSource.indexOf('\nconst setupStatus='));

test('the clock advances the playing channel even while another guide row is selected',()=>{
 const tuned=[];
 const state={guide:true,row:1,col:0,guideStart:0,guideCurrentSignature:'0|0',guideFollowingLive:true,current:{row:0,p:{end:100}},upNextKey:'old'};
 vm.runInNewContext(`${tickSource};tick();`,{
  state,CHANNELS:[{shows:[],schedule:[{end:10000}]},{shows:[],schedule:[{end:10000}]}],nowSec:()=>100,currentIndex:()=>0,
  document:{querySelector:()=>({})},render:()=>{},updateSelection:()=>{},
  updateGuideNowLine:()=>{},updateGuideProgramProgress:()=>{},
  tune:row=>tuned.push(row)
 });
 assert.deepEqual(tuned,[0]);
 assert.equal(state.upNextKey,'');
});

test('LAST remembers the tuned channel, not the guide selection',t=>{
 const {controller,state}=harness(t);state.row=1;controller.tune(1);assert.equal(state.previousRow,0);
});
test('clock transition keeps the guide open and its unrelated selection',t=>{
 const {controller,state}=harness(t);state.guide=true;state.row=1;state.col=0;state.guideFollowingLive=true;
 controller.tune(0,{preserveGuide:true});assert.equal(state.guide,true);assert.equal(state.row,1);assert.equal(state.current.row,0);
});
test('a repeated video in a different schedule slot is loaded again',t=>{
 const {controller,state,channels,loaded}=harness(t);channels[0].schedule[0]={...state.current.p,start:60,end:120};controller.tune(0);assert.deepEqual(loaded,['a','a']);
});
test('stale player callbacks cannot skip or blacklist current playback',t=>{
 const {events,state,channels}=harness(t);events.onError({data:100,target:{}});events.onStateChange({data:0,target:{}});t.mock.timers.tick(1000);assert.equal(state.current.p.id,'a');assert.equal(channels[0].shows.length,1);
});

test('playing event corrects a tuned video that starts from zero instead of the live offset',t=>{
 let now=24;
 const {events,state,seeks}=harness(t,{nowSec:()=>now});
 state.player.currentTime=0;
 events.onStateChange({data:1});
 assert.deepEqual(seeks,[24]);
 assert.equal(state.player.currentTime,24);
});

test('resume seeks the current program forward to its live broadcast offset',t=>{
 let now=0;
 const {controller,state,seeks}=harness(t,{nowSec:()=>now});
 now=24;
 state.player.currentTime=3;
 controller.resyncToBroadcast();
 assert.deepEqual(seeks,[24]);
 assert.equal(state.player.currentTime,24);
});

test('resume loads the program that is currently scheduled if the old slot ended while hidden',t=>{
 let now=0;
 const currentIndex=ch=>ch.schedule.findIndex(program=>now>=program.start&&now<program.end);
 const {controller,state,channels,loaded}=harness(t,{nowSec:()=>now,currentIndex});
 channels[0].shows.push(['second','source','second',60]);
 channels[0].schedule.push({id:'second',start:60,end:120,duration:60});
 now=75;
 controller.resyncToBroadcast();
 assert.equal(state.current.p.id,'second');
 assert.deepEqual(loaded,['a','second']);
});

test('an early YouTube end does not pull later broadcast slots forward',t=>{
 let now=20;
 const currentIndex=ch=>ch.schedule.findIndex(program=>now>=program.start&&now<program.end);
 const {events,state,channels,loaded}=harness(t,{nowSec:()=>now,currentIndex});
 channels[0].shows.push(['second','source','second',60]);
 channels[0].schedule.push({id:'second',start:60,end:120,duration:60});
 const before=structuredClone(channels[0].schedule);
 events.onStateChange({data:0});
 assert.deepEqual(channels[0].schedule,before);
 assert.equal(state.current.p.id,'a');
 assert.deepEqual(loaded,['a']);
});
