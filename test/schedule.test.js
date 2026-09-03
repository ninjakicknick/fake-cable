import test from 'node:test';
import assert from 'node:assert/strict';
import {currentIndexAt,makeSchedule,programmedOrder,seriesKey} from '../schedule.js';

const channel={
  n:2,
  name:'TEST CHANNEL',
  channelId:'UCtest',
  shows:[
    ['Series Episode 1','Test','a',600],
    ['Series Episode 2','Test','b',700],
    ['Feature Alpha','Test','c',1200],
    ['Feature Beta','Test','d',1500],
    ['Station Break','Test','e',120]
  ]
};

test('makeSchedule is deterministic, contiguous, and covers the broadcast window',()=>{
  const date=new Date('2026-09-03T12:00:00Z');
  const first=makeSchedule(channel,{date});
  const second=makeSchedule(channel,{date});
  assert.deepEqual(first,second);
  assert.ok(first.length>20);
  for(let i=1;i<first.length;i++)assert.equal(first[i].start,first[i-1].end);
  assert.ok(first.every(program=>program.duration>=60));
  const midnight=new Date(date);midnight.setHours(0,0,0,0);
  assert.equal(first[0].start,midnight.getTime()/1000-21600);
  assert.ok(first.at(-1).end>=midnight.getTime()/1000+151200);
});

test('currentIndexAt selects the live program and safely falls back',()=>{
  const schedule=[
    {start:100,end:200},
    {start:200,end:300}
  ];
  assert.equal(currentIndexAt({schedule},150),0);
  assert.equal(currentIndexAt({schedule},250),1);
  assert.equal(currentIndexAt({schedule},999),0);
});

test('series keys normalize episode numbering',()=>{
  assert.equal(seriesKey(['Mystery Show Episode 12']),seriesKey(['Mystery Show Part 3']));
});

test('programmed order is stable for a channel and cycle',()=>{
  assert.deepEqual(programmedOrder(channel,42),programmedOrder(channel,42));
});
