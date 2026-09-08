import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMixChannel,composeMixLineup} from '../mixes.js';

const sources=[
  {channelId:'a',name:'A',shows:[['A1','A','1',600]]},
  {channelId:'b',name:'B',shows:[['B1','B','2',700]]},
  {channelId:'c',name:'C',shows:[['C1','C','3',800]]}
];

test('mix channels retain each program source id',()=>{
  const mix=buildMixChannel({id:'mix:late',name:'Late Night',sourceIds:['a','b']},sources);
  assert.equal(mix.name,'LATE NIGHT');
  assert.deepEqual(mix.shows.map(show=>show[4]),['a','b']);
});

test('a consolidating mix replaces its sources in the visible lineup',()=>{
  const result=composeMixLineup(sources,[{id:'mix:late',name:'Late Night',sourceIds:['a','b'],hideSources:true}]);
  assert.deepEqual(result.sources.map(channel=>channel.channelId),['a','b','c']);
  assert.deepEqual(result.channels.map(channel=>channel.channelId),['c','mix:late']);
});

test('a non-consolidating mix keeps its sources visible',()=>{
  const result=composeMixLineup(sources,[{id:'mix:late',name:'Late Night',sourceIds:['a','b'],hideSources:false}]);
  assert.deepEqual(result.channels.map(channel=>channel.channelId),['a','b','c','mix:late']);
});

test('mixes with missing sources are discarded safely',()=>{
  const result=composeMixLineup(sources,[{id:'mix:old',name:'Old Mix',sourceIds:['a','missing'],hideSources:true}]);
  assert.equal(result.mixes.length,0);
  assert.equal(result.channels.length,3);
});
