import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createDictation } from '../src/comments/voice.js';

it('dictates final results only after opt-in and ignores results after stop/close', () => {
  const instances = [];
  class Recognition {
    constructor() {
      instances.push(this);
    }
    start() {
      this.started = true;
    }
    abort() {
      this.aborted = true;
    }
  }
  const texts = [];
  const statuses = [];
  const active = [];
  const voice = createDictation({
    window: {
      SpeechRecognition: Recognition,
      document: { documentElement: { lang: 'ru' } },
    },
    onText: (text) => texts.push(text),
    onStatus: (text) => statuses.push(text),
    onActive: (value) => active.push(value),
  });
  assert.equal(instances.length, 0);
  voice.start();
  const recognition = instances[0];
  assert.equal(recognition.lang, 'ru');
  const result = [{ transcript: 'Сделай ярче' }];
  result.isFinal = true;
  recognition.onresult({ resultIndex: 0, results: [result] });
  assert.deepEqual(texts, ['Сделай ярче']);
  voice.stop();
  assert.equal(recognition.aborted, true);
  recognition.onresult({ resultIndex: 0, results: [result] });
  assert.equal(texts.length, 1);
  voice.start();
  instances[1].onerror({ error: 'not-allowed' });
  assert.match(statuses[0], /not-allowed/);
  assert.equal(active.at(-1), false);
  voice.destroy();
  voice.start();
  assert.equal(instances.length, 2);
});

it('falls back to text without recognition support and reports service start failure', () => {
  const statuses = [];
  const callbacks = {
    onText() {},
    onStatus: (text) => statuses.push(text),
    onActive() {},
  };
  const unsupported = createDictation({ window: {}, ...callbacks });
  assert.equal(unsupported.supported, false);
  unsupported.start();
  unsupported.destroy();
  class Refused {
    start() {
      throw new Error('denied');
    }
    abort() {}
  }
  const refused = createDictation({
    window: {
      webkitSpeechRecognition: Refused,
      document: { documentElement: {} },
    },
    ...callbacks,
  });
  refused.start();
  assert.match(statuses[0], /denied/);
  refused.destroy();
});
