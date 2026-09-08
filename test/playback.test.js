import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldShowTuningStatic} from '../playback.js';

test('tuning static only appears when the channel changes',()=>{
  assert.equal(shouldShowTuningStatic(null,2),true);
  assert.equal(shouldShowTuningStatic({row:2},3),true);
  assert.equal(shouldShowTuningStatic({row:2},2),false);
});
