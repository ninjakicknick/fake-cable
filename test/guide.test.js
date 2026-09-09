import test from 'node:test';
import assert from 'node:assert/strict';
import {guidePrograms} from '../guide.js';

test('guidePrograms returns only entries overlapping the visible window',()=>{
  const channel={schedule:[
    {id:'before',start:0,end:100,duration:100},
    {id:'visible',start:100,end:200,duration:100},
    {id:'after',start:200,end:300,duration:100}
  ]};
  assert.deepEqual(guidePrograms(channel,100,200,channel.schedule[1]).map(program=>program.id),['visible']);
  assert.equal(guidePrograms(channel,100,200,channel.schedule[1])[0]._current,true);
});

test('guidePrograms combines each commercial break into one guide entry',()=>{
  const schedule=[
    {id:'show',start:0,end:100,duration:100},
    {id:'ad1',title:'Ad one',start:100,end:130,duration:30,isCommercial:true,commercialBreakId:'break',commercialPosition:1},
    {id:'ad2',title:'Ad two',start:130,end:175,duration:45,isCommercial:true,commercialBreakId:'break',commercialPosition:2},
    {id:'next',start:175,end:300,duration:125}
  ];
  const entries=guidePrograms({schedule},0,300,schedule[2]);
  const commercial=entries.find(program=>program.isCommercial);
  assert.equal(commercial.title,'COMMERCIAL BREAK');
  assert.equal(commercial.source,'2 COMMERCIALS');
  assert.equal(commercial.start,100);
  assert.equal(commercial.end,175);
  assert.equal(commercial.duration,75);
  assert.equal(commercial._current,true);
  assert.equal(commercial._guideIndex,2);
});
