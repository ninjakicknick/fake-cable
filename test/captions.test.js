import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaptionController} from '../captions.js';

test('captions use the current player and persist their state for reload',()=>{
 const saved=new Map(),calls=[];const storage={getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)};
 const state={ready:true,player:{loadModule:()=>calls.push('load'),setOption:(...args)=>calls.push(args),unloadModule:()=>calls.push('unload')}};
 let broadcasts=0;
 const controller=createCaptionController({state,storage,language:()=> 'en-US',broadcast:()=>broadcasts++});
 controller.toggle();assert.equal(state.captionsEnabled,true);assert.equal(broadcasts,1);assert.equal(saved.get('fake-cable-captions-enabled'),'1');assert.ok(calls.includes('load'));
 let unloaded=false;state.player={unloadModule:()=>unloaded=true};controller.toggle();assert.equal(unloaded,true);assert.equal(state.captionsEnabled,false);
 const restored={};createCaptionController({state:restored,storage});assert.equal(restored.captionsEnabled,false);
});
