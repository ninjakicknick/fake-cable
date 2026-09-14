import test from 'node:test';
import assert from 'node:assert/strict';
import {createLineupScheduler} from '../lineup-state.js';
import {currentIndexAt} from '../schedule.js';
const now=Date.parse('2026-09-14T12:00:00Z')/1000;
function fixture(){
 const channels=['a','b','c'].map(channelId=>({channelId,name:channelId,shows:Array.from({length:6},(_,i)=>[`${channelId}${i}`,channelId,`${channelId}${i}`,300+i*30])}));
 const state={row:0,col:0,current:null,previousRow:1};
 const reconcile=createLineupScheduler();reconcile(state,[],channels,[],now);
 const index=currentIndexAt(channels[0],now);state.current={row:0,index,ch:channels[0],p:channels[0].schedule[index]};state.previousRow=1;
 return {channels,state,reconcile};
}
test('reordering preserves playing program, selected channel, and last channel identities',()=>{
 const {channels,state,reconcile}=fixture(),program=state.current.p,schedule=channels[0].schedule;
 state.row=2;
 const next=[channels[1],channels[2],channels[0]];
 assert.equal(reconcile(state,channels,next,[],now),false);
 assert.equal(state.current.row,2);assert.equal(state.current.p,program);assert.equal(state.row,1);assert.equal(state.previousRow,0);assert.equal(next[2].schedule,schedule);
});
test('catalog refresh keeps the on-air object and updates future programming without gaps',()=>{
 const {channels,state,reconcile}=fixture(),program=state.current.p;
 const next=[{...channels[0],shows:[['New','A','new',90]]},...channels.slice(1)];
 assert.equal(reconcile(state,channels,next,[],now),false);assert.equal(state.current.p,program);assert.equal(state.current.ch,next[0]);
 const schedule=next[0].schedule;assert.equal(schedule[state.current.index+1].id,'new');
 schedule.slice(1).forEach((p,i)=>assert.equal(p.start,schedule[i].end));
});
test('removing or hiding the playing source selects a playable fallback',()=>{
 const {channels,state,reconcile}=fixture();
 assert.equal(reconcile(state,channels,channels.slice(1),[],now),true);assert.equal(state.current.ch.channelId,'b');assert.equal(state.current.row,0);
});
test('changing commercials does not interrupt the on-air program',()=>{
 const {channels,state,reconcile}=fixture(),program=state.current.p;
 assert.equal(reconcile(state,channels,channels,[['Ad','Ad','ad',30]],now),false);
 assert.equal(state.current.p,program);assert.ok(channels[0].schedule.some(p=>p.isCommercial));
});
test('a seven-day accelerated session continually renews its schedule',()=>{
 const {channels,state,reconcile}=fixture();
 for(let time=now;time<now+7*86400;time+=3600){
  reconcile(state,channels,channels,[],time);
  assert.ok(state.current.p.start<=time&&state.current.p.end>time);
  assert.ok(channels.every(ch=>ch.schedule.at(-1).end>time+5400));
 }
});
