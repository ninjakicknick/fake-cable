import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createPlayerController} from '../player.js';

function harness(t){
 const noop=()=>{};
 const channels=['a','b'].map(id=>({channelId:id,shows:[[id,'source',id,60]],schedule:[{id,start:0,end:60,duration:60}]}));
 const state={row:0,col:0,current:null,ready:false,muted:false,skippingUnavailable:false};
 const loaded=[];
 let events;
 const globals={
  document:{querySelector:()=>null},
  location:{protocol:'https:',origin:'https://fakecable.com'},
  localStorage:{setItem:noop},
  YT:{PlayerState:{ENDED:0,PLAYING:1,PAUSED:2},Player:class{
   constructor(id,options){events=options.events}
   loadVideoById(video){loaded.push(video.videoId)}
   getPlayerState(){return 1}
   getVideoData(){return {video_id:loaded.at(-1)}}
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
  nowSec:()=>0,currentIndex:()=>0,activeCommercials:()=>[],scheduleChannels:noop,
  normalizeLineup:noop,saveCommercialConfig:noop,saveLineup:noop,render:noop,
  showGuide:noop,showBanner:noop,showInterstitial:noop,hideInterstitial:noop,
  showTuningStatic:noop,hideTuningStatic:noop,toast:noop
 });
 controller.createYouTubePlayer();
 events.onReady();
 controller.tune(0);
 return {state,channels,controller,events,loaded};
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
  state,CHANNELS:[{},{}],nowSec:()=>100,currentIndex:()=>0,
  document:{querySelector:()=>({})},render:()=>{},updateSelection:()=>{},
  updateGuideNowLine:()=>{},updateGuideProgramProgress:()=>{},
  tune:row=>tuned.push(row)
 });
 assert.deepEqual(tuned,[0]);
 assert.equal(state.upNextKey,'');
});
