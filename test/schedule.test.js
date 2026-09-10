import test from 'node:test';
import assert from 'node:assert/strict';
import {currentIndexAt,dayStart,makeSchedule,programmedOrder,seriesKey} from '../schedule.js';

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

test('dayStart uses shared midnight Eastern across standard and daylight time',()=>{
  assert.equal(dayStart(new Date('2026-01-15T18:00:00Z')),Date.parse('2026-01-15T05:00:00Z')/1000);
  assert.equal(dayStart(new Date('2026-07-15T18:00:00Z')),Date.parse('2026-07-15T04:00:00Z')/1000);
});

test('the Eastern broadcast day changes at the same instant worldwide',()=>{
  assert.equal(dayStart(new Date('2026-07-15T03:59:59Z')),Date.parse('2026-07-14T04:00:00Z')/1000);
  assert.equal(dayStart(new Date('2026-07-15T04:00:00Z')),Date.parse('2026-07-15T04:00:00Z')/1000);
});

test('makeSchedule is deterministic, contiguous, and covers the broadcast window',()=>{
  const date=new Date('2026-09-03T12:00:00Z');
  const first=makeSchedule(channel,{date});
  const second=makeSchedule(channel,{date});
  assert.deepEqual(first,second);
  assert.ok(first.length>20);
  for(let i=1;i<first.length;i++)assert.equal(first[i].start,first[i-1].end);
  assert.ok(first.every(program=>program.duration>=60));
  const midnight=dayStart(date);
  assert.equal(first[0].start,midnight-21600);
  assert.ok(first.at(-1).end>=midnight+151200);
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

test('videos do not repeat across cycle boundaries until the rest of the lineup has aired',()=>{
  const shortChannel={n:2,name:'SHORT FEED',channelId:'UCshort',shows:[['One','Feed','one',3600],['Two','Feed','two',3600],['Three','Feed','three',3600],['Four','Feed','four',3600],['Five','Feed','five',3600]]};
  const programs=makeSchedule(shortChannel,{date:new Date('2026-09-03T12:00:00Z')}).filter(program=>!program.isCommercial);
  for(let i=1;i<programs.length;i++){
    const previous=programs.slice(Math.max(0,i-4),i).map(program=>program.id);
    assert.equal(previous.includes(programs[i].id),false,`${programs[i].id} repeated before the other videos aired`);
  }
});

test('duplicate feed entries are only scheduled once per cycle',()=>{
  const duplicate={...channel,shows:[...channel.shows,channel.shows[0]]};
  assert.equal(programmedOrder(duplicate,42).filter(show=>show[2]==='a').length,1);
});

test('mixed schedules avoid consecutive creators when alternatives exist',()=>{const mixed={n:20,name:'MIX',channelId:'theme:test',shows:[['A1','A','a1',600],['A2','A','a2',600],['B1','B','b1',600],['B2','B','b2',600]]};const order=programmedOrder(mixed,7);for(let i=1;i<order.length;i++)assert.notEqual(order[i][1],order[i-1][1])});

test('schedules retain a mixed program source channel id',()=>{
  const mixed={n:20,name:'MIX',channelId:'mix:test',shows:[['A1','A','a1',600,'source:a'],['B1','B','b1',600,'source:b']]};
  const schedule=makeSchedule(mixed,{date:new Date('2026-09-03T12:00:00Z')});
  assert.ok(schedule.every(program=>program.sourceChannelId==='source:a'||program.sourceChannelId==='source:b'));
});

test('commercials are optional, deterministic, and only appear between programs',()=>{
  const date=new Date('2026-09-03T12:00:00Z');
  const commercials=[['Toy Commercial','Ad Archive','ad1',30],['Cereal Commercial','Ad Archive','ad2',45]];
  const without=makeSchedule(channel,{date});
  const first=makeSchedule(channel,{date,commercials});
  const second=makeSchedule(channel,{date,commercials});
  assert.equal(without.some(program=>program.isCommercial),false);
  assert.deepEqual(first,second);
  assert.ok(first.some(program=>program.isCommercial));
  const breaks=first.filter(program=>program.isCommercial).reduce((groups,program)=>groups.set(program.commercialBreakId,[...(groups.get(program.commercialBreakId)||[]),program]),new Map());
  for(const spots of breaks.values()){
    assert.equal(spots.length,2);
    assert.equal(new Set(spots.map(spot=>spot.id)).size,spots.length);
    assert.deepEqual(spots.map(spot=>spot.commercialPosition),[1,2]);
    const firstIndex=first.indexOf(spots[0]),lastIndex=first.indexOf(spots.at(-1));
    assert.ok(firstIndex>0&&lastIndex<first.length-1);
    assert.equal(first[firstIndex-1].isCommercial,undefined);
    assert.equal(first[lastIndex+1].isCommercial,undefined);
  }
});

test('commercial breaks contain two or three distinct spots when available',()=>{
  const commercials=[['Ad 1','Archive','ad1',30],['Ad 2','Archive','ad2',30],['Ad 3','Archive','ad3',30],['Ad 4','Archive','ad4',30]];
  const schedule=makeSchedule(channel,{date:new Date('2026-09-03T12:00:00Z'),commercials});
  const breaks=schedule.filter(program=>program.isCommercial).reduce((groups,program)=>groups.set(program.commercialBreakId,[...(groups.get(program.commercialBreakId)||[]),program]),new Map());
  assert.ok([...breaks.values()].some(spots=>spots.length===3));
  for(const spots of breaks.values()){
    assert.ok(spots.length===2||spots.length===3);
    assert.equal(new Set(spots.map(spot=>spot.id)).size,spots.length);
  }
});


test('a scheduling cycle airs the full catalog before any video repeats',()=>{
  const shows=Array.from({length:20},(_,index)=>[`Program ${index}`,'Mixed source',`video-${index}`,600]);
  for(let seed=0;seed<20;seed++){
    const mixed={n:12,name:`MIX ${seed}`,channelId:`mix:${seed}`,shows};
    const programs=makeSchedule(mixed,{date:new Date('2026-09-09T12:00:00Z')}).filter(program=>!program.isCommercial);
    const firstCycle=programs.slice(0,shows.length).map(program=>program.id);
    assert.equal(new Set(firstCycle).size,shows.length,`mix:${seed} repeated before its catalog completed`);
  }
});


test('channel order does not change a station schedule phase',()=>{
  const date=new Date('2026-09-10T16:00:00Z');
  const base={name:'TEST',channelId:'UC-stable',shows:[['One','Test','one',1200],['Two','Test','two',1500]]};
  const first=makeSchedule({...base,n:2},{date});
  const moved=makeSchedule({...base,n:9},{date});
  assert.deepEqual(moved,first);
});
