import test from 'node:test';
import assert from 'node:assert/strict';
import {reflowScheduleAround,shouldShowTuningStatic} from '../playback.js';

test('tuning static only appears when the channel changes',()=>{
  assert.equal(shouldShowTuningStatic(null,2),true);
  assert.equal(shouldShowTuningStatic({row:2},3),true);
  assert.equal(shouldShowTuningStatic({row:2},2),false);
});


test('duration correction reflows both sides without blank guide slots',()=>{
  const schedule=[
    {id:'before',duration:600,start:0,end:600},
    {id:'current',duration:1800,start:600,end:2400},
    {id:'after',duration:900,start:2400,end:3300}
  ];
  assert.equal(reflowScheduleAround(schedule,1,1200,300),true);
  assert.deepEqual(schedule,[
    {id:'before',duration:600,start:600,end:1200},
    {id:'current',duration:300,start:1200,end:1500},
    {id:'after',duration:900,start:1500,end:2400}
  ]);
  for(let i=1;i<schedule.length;i++)assert.equal(schedule[i].start,schedule[i-1].end);
});

test('duration correction safely rejects an invalid target',()=>{
  assert.equal(reflowScheduleAround([],0,100,300),false);
});
