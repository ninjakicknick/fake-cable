export const STORAGE_KEYS=Object.freeze({
  stations:'fake-cable-stations',
  channels:'elsewhere-channels',
  channelLinks:'elsewhere-channel-links',
  mixes:'fake-cable-mixes',
  lineupOrder:'fake-cable-lineup-order',
  commercials:'fake-cable-commercials',
  lineupVersion:'fake-cable-lineup-version',
  catalogVersion:'fake-cable-catalog-version',
  lastChannel:'elsewhere-last-channel',
  lastChannelId:'fake-cable-last-channel-id'
});

export const LINEUP_VERSION='12';
export const CATALOG_VERSION='3';

function clone(value){
  return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
}

export function readJson(storage,key,fallback){
  try{
    const raw=storage.getItem(key);
    return raw===null?clone(fallback):JSON.parse(raw);
  }catch{
    return clone(fallback);
  }
}

export function loadSourceChannels(storage,fallbackChannels){
  if(!storage.getItem(STORAGE_KEYS.stations))return clone(fallbackChannels);
  const value=readJson(storage,STORAGE_KEYS.channels,null);
  return Array.isArray(value)&&value.length&&value.every(channel=>channel&&typeof channel.channelId==='string'&&typeof channel.name==='string'&&Array.isArray(channel.shows)&&channel.shows.every(validShow))?value:clone(fallbackChannels);
}

export function loadMixes(storage){
  const value=readJson(storage,STORAGE_KEYS.mixes,[]);
  return Array.isArray(value)?value.filter(mix=>mix&&typeof mix.id==='string'&&typeof mix.name==='string'&&Array.isArray(mix.sourceIds)):[];
}

export function loadLineupOrder(storage){
  const value=readJson(storage,STORAGE_KEYS.lineupOrder,[]);
  return Array.isArray(value)?value.filter(id=>typeof id==='string'):[];
}

export function loadCommercialConfig(storage,defaults){
  const saved=readJson(storage,STORAGE_KEYS.commercials,null);
  if(!saved||typeof saved!=='object'||Array.isArray(saved))return {config:{...defaults},shouldLoadDefault:true};
  const config={...defaults,...saved};
  config.shows=Array.isArray(config.shows)?config.shows.filter(validShow):[];
  if('unavailableIds' in config)config.unavailableIds=Array.isArray(config.unavailableIds)?config.unavailableIds.filter(id=>typeof id==='string'):[];
  return {config,shouldLoadDefault:false};
}

export function saveLineupState(storage,{stationPicker,sourceChannels,mixes,lineupOrder=[]}){
  storage.setItem(STORAGE_KEYS.channelLinks,stationPicker.map(station=>station.value).join('\n'));
  storage.setItem(STORAGE_KEYS.stations,JSON.stringify(stationPicker));
  storage.setItem(STORAGE_KEYS.channels,JSON.stringify(sourceChannels.map(({schedule,...channel})=>channel)));
  storage.setItem(STORAGE_KEYS.mixes,JSON.stringify(mixes));
  storage.setItem(STORAGE_KEYS.lineupOrder,JSON.stringify(lineupOrder));
  storage.setItem(STORAGE_KEYS.lineupVersion,LINEUP_VERSION);
  storage.setItem(STORAGE_KEYS.catalogVersion,CATALOG_VERSION);
}

export function saveCommercialState(storage,config){
  storage.setItem(STORAGE_KEYS.commercials,JSON.stringify(config));
}

function validShow(show){return Array.isArray(show)&&typeof show[2]==='string'&&Number.isFinite(Number(show[3]))&&Number(show[3])>0}

export function loadStations(storage,defaults){
 const saved=readJson(storage,STORAGE_KEYS.stations,null);
 if(Array.isArray(saved)&&saved.length&&saved.every(station=>station&&typeof station.value==='string'&&station.value.trim()))return saved;
 const legacy=storage.getItem(STORAGE_KEYS.channelLinks);
 return legacy?legacy.split(/\r?\n/).filter(Boolean).map(value=>({value,label:value,tags:[]})):clone(defaults);
}

// Storage failure must not turn an otherwise working TV into a blank screen.
export function createSafeStorage(getStorage,onFailure=()=>{}){
 let warned=false;
 const memory=new Map();
 const failed=()=>{if(!warned){warned=true;onFailure()}};
 return {
  getItem(key){if(memory.has(key))return memory.get(key);try{return getStorage().getItem(key)}catch{failed();return null}},
  setItem(key,value){memory.set(key,String(value));try{getStorage().setItem(key,value)}catch{failed()}},
  removeItem(key){memory.set(key,null);try{getStorage().removeItem(key)}catch{failed()}}
 };
}
