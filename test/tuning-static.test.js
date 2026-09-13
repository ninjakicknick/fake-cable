import test from 'node:test';
import assert from 'node:assert/strict';
import {createTuningStatic} from '../tuning-static.js';

function harness(t){
 const classes=new Set();
 const canvas={getContext:()=>null,classList:{
  add:name=>classes.add(name),remove:name=>classes.delete(name)
 }};
 for(const [key,value] of Object.entries({
  document:{querySelector:()=>canvas},window:{},cancelAnimationFrame:()=>{}
 })){
  const original=Object.getOwnPropertyDescriptor(globalThis,key);
  Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  t.after(()=>{if(original)Object.defineProperty(globalThis,key,original);else delete globalThis[key]});
 }
 t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
 const state={staticMinUntil:0,ready:true,current:{p:{id:'new'}},player:{
  getPlayerState:()=>1,getVideoData:()=>({video_id:'new'})
 }};
 const controller=createTuningStatic({state});
 const advance=ms=>{for(let i=0;i<ms;i+=50)t.mock.timers.tick(Math.min(50,ms-i))};
 return {state,...controller,advance,visible:()=>classes.has('show')};
}

test('missed PLAYING event clears static while preserving the minimum duration',t=>{
 const h=harness(t);
 h.showTuningStatic(800);
 h.advance(750);
 assert.equal(h.visible(),true);
 h.advance(100);
 assert.equal(h.visible(),false);
});

test('old channel playback cannot clear static for the newly requested video',t=>{
 const h=harness(t);
 h.state.player.getVideoData=()=>({video_id:'old'});
 h.showTuningStatic();
 h.advance(1000);
 assert.equal(h.visible(),true);
 h.state.player.getVideoData=()=>({video_id:'new'});
 h.advance(300);
 assert.equal(h.visible(),false);
});

test('static expires even if the player API throws',t=>{
 const h=harness(t);
 h.state.player.getPlayerState=()=>{throw new Error('not ready')};
 h.showTuningStatic();
 h.advance(9900);
 assert.equal(h.visible(),true);
 h.advance(200);
 assert.equal(h.visible(),false);
});

test('a new tune cancels the old pending hide and resets recovery',t=>{
 const h=harness(t);
 h.showTuningStatic(800);
 h.advance(300);
 h.state.player.getPlayerState=()=>3;
 h.showTuningStatic();
 h.advance(800);
 assert.equal(h.visible(),true);
 h.state.player.getPlayerState=()=>1;
 h.advance(300);
 assert.equal(h.visible(),false);
});

test('normal hide stops the static audio and cancels recovery',t=>{
 const h=harness(t);
 let stopped=0;
 h.showTuningStatic();
 h.state.staticAudio={context:{currentTime:0},gain:{gain:{setTargetAtTime:()=>{}}},source:{stop:()=>stopped++}};
 h.hideTuningStatic();
 h.advance(600);
 assert.equal(h.visible(),false);
 assert.equal(h.state.staticAudio,null);
 assert.equal(stopped,1);
 h.advance(11000);
 assert.equal(stopped,1);
});
