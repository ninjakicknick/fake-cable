import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG_VERSION,LINEUP_VERSION,STORAGE_KEYS,createSafeStorage,loadStations,loadCommercialConfig,loadLineupOrder,loadMixes,loadSourceChannels,readJson,saveLineupState} from '../storage.js';

function memoryStorage(initial={}){
  const values=new Map(Object.entries(initial));
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
    values
  };
}

test('readJson returns independent defaults for missing and corrupt data',()=>{
  const storage=memoryStorage({broken:'{'});
  const fallback=[{name:'Starter'}];
  assert.deepEqual(readJson(storage,'missing',fallback),fallback);
  assert.deepEqual(readJson(storage,'broken',fallback),fallback);
  assert.notEqual(readJson(storage,'missing',fallback),fallback);
});

test('source channels use the starter fallback until a saved station list exists',()=>{
  const fallback=[{channelId:'starter'}];
  assert.deepEqual(loadSourceChannels(memoryStorage(),fallback),fallback);
  const storage=memoryStorage({
    [STORAGE_KEYS.stations]:'[{"value":"saved"}]',
    [STORAGE_KEYS.channels]:'[{"channelId":"saved","name":"Saved","shows":[]}]'
  });
  assert.deepEqual(loadSourceChannels(storage,fallback),[{channelId:'saved',name:'Saved',shows:[]}]);
});

test('mixes recover safely from malformed or non-array storage',()=>{
  assert.deepEqual(loadMixes(memoryStorage({[STORAGE_KEYS.mixes]:'{'})),[]);
  assert.deepEqual(loadMixes(memoryStorage({[STORAGE_KEYS.mixes]:'{}'})),[]);
});

test('commercial configuration distinguishes a fresh install from a saved one',()=>{
  const defaults={enabled:true,value:'default',shows:[]};
  assert.deepEqual(loadCommercialConfig(memoryStorage(),defaults),{config:defaults,shouldLoadDefault:true});
  const saved=memoryStorage({[STORAGE_KEYS.commercials]:'{"enabled":false,"value":"custom"}'});
  assert.deepEqual(loadCommercialConfig(saved,defaults),{config:{enabled:false,value:'custom',shows:[]},shouldLoadDefault:false});
});

test('saving a lineup strips generated schedules and records schema versions',()=>{
  const storage=memoryStorage();
  saveLineupState(storage,{
    stationPicker:[{value:'channel:a',label:'A'}],
    sourceChannels:[{channelId:'a',shows:[],schedule:[{id:'generated'}]}],
    mixes:[{id:'mix:a'}]
  });
  assert.equal(storage.getItem(STORAGE_KEYS.lineupVersion),LINEUP_VERSION);
  assert.equal(storage.getItem(STORAGE_KEYS.catalogVersion),CATALOG_VERSION);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEYS.channels))[0].schedule,undefined);
  assert.equal(storage.getItem(STORAGE_KEYS.channelLinks),'channel:a');
});


test('lineup order defaults safely and filters invalid values',()=>{
  const storage=memoryStorage();
  assert.deepEqual(loadLineupOrder(storage),[]);
  storage.setItem(STORAGE_KEYS.lineupOrder,JSON.stringify(['a',4,'mix:b']));
  assert.deepEqual(loadLineupOrder(storage),['a','mix:b']);
});

test('wrong-shaped saved channels and mixes recover safely',()=>{
 for(const value of ['{}','[null]','[{}]','false']){
  const storage=memoryStorage({[STORAGE_KEYS.stations]:'[]',[STORAGE_KEYS.channels]:value,[STORAGE_KEYS.mixes]:value});
  assert.deepEqual(loadSourceChannels(storage,[{channelId:'fallback'}]),[{channelId:'fallback'}]);assert.deepEqual(loadMixes(storage),[]);
 }
});
test('malformed commercial arrays cannot crash startup',()=>{
 const config=loadCommercialConfig(memoryStorage({[STORAGE_KEYS.commercials]:'{"shows":{},"unavailableIds":null}'}),{shows:[],unavailableIds:[]}).config;
 assert.deepEqual(config.shows,[]);assert.deepEqual(config.unavailableIds,[]);
});


test('denied storage keeps session changes usable and warns only once',()=>{
 let warnings=0;const storage=createSafeStorage(()=>{throw Error('denied')},()=>warnings++);
 assert.equal(storage.getItem('a'),null);storage.setItem('a','value');assert.equal(storage.getItem('a'),'value');storage.removeItem('a');assert.equal(storage.getItem('a'),null);assert.equal(warnings,1);
});
test('corrupt station objects fall back to valid defaults',()=>{
 for(const value of ['{','{}','[null]','[{"value":2}]'])assert.deepEqual(loadStations(memoryStorage({[STORAGE_KEYS.stations]:value}),[{value:'default'}]),[{value:'default'}]);
});
