export const STORAGE_KEYS=Object.freeze({
  stations:'fake-cable-stations',
  channels:'elsewhere-channels',
  channelLinks:'elsewhere-channel-links',
  mixes:'fake-cable-mixes',
  commercials:'fake-cable-commercials',
  lineupVersion:'fake-cable-lineup-version',
  catalogVersion:'fake-cable-catalog-version',
  lastChannel:'elsewhere-last-channel'
});

export const LINEUP_VERSION='10';
export const CATALOG_VERSION='2';

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
  return readJson(storage,STORAGE_KEYS.channels,fallbackChannels)||clone(fallbackChannels);
}

export function loadMixes(storage){
  const value=readJson(storage,STORAGE_KEYS.mixes,[]);
  return Array.isArray(value)?value:[];
}

export function loadCommercialConfig(storage,defaults){
  const saved=readJson(storage,STORAGE_KEYS.commercials,null);
  return saved?{config:{...defaults,...saved},shouldLoadDefault:false}:{config:{...defaults},shouldLoadDefault:true};
}

export function saveLineupState(storage,{stationPicker,sourceChannels,mixes}){
  storage.setItem(STORAGE_KEYS.channelLinks,stationPicker.map(station=>station.value).join('\n'));
  storage.setItem(STORAGE_KEYS.stations,JSON.stringify(stationPicker));
  storage.setItem(STORAGE_KEYS.channels,JSON.stringify(sourceChannels.map(({schedule,...channel})=>channel)));
  storage.setItem(STORAGE_KEYS.mixes,JSON.stringify(mixes));
  storage.setItem(STORAGE_KEYS.lineupVersion,LINEUP_VERSION);
  storage.setItem(STORAGE_KEYS.catalogVersion,CATALOG_VERSION);
}

export function saveCommercialState(storage,config){
  storage.setItem(STORAGE_KEYS.commercials,JSON.stringify(config));
}
