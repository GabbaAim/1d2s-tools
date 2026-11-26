const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');

test('valid title.json round-trips with fixed key order and string Type', () => {
  const source = `[
    {
      "id": "sample_001",
      "title": "初見プレイヤー",
      "plateId": "01",
      "description": "この曲を初めてプレイした",
      "condition": {
        "type": "play",
        "difficulty": -1,
        "optionConditions": []
      }
    },
    {
      "Id": "sample_002",
      "Title": "超絶スピードスター",
      "PlateId": "02",
      "Description": "スクロール速度2.0倍以上でフルコンボ",
      "Hidden": true,
      "Condition": {
        "Type": "FullCombo",
        "Difficulty": 3,
        "OptionConditions": ["ScrollSpeed>=2.0"]
      }
    }
  ]`;

  const result = C.parseTitleJson(source);
  assert.equal(result.ok, true);
  assert.equal(result.titles.length, 2);
  assert.equal(result.titles[0].type, 'Play');
  assert.equal(result.titles[0].id, 'sample_001');
  assert.equal(result.titles[0].hidden, false);
  assert.equal(result.titles[1].hidden, true);

  const output = C.serializeTitles(result.titles);
  assert.equal(output.includes('"Type": "Play"'), true);
  assert.equal(output.includes('"type"'), false);
  assert.equal(output.endsWith('\n'), true);
  assert.equal(output.includes('\t'), false);

  const reparsed = JSON.parse(output);
  assert.deepEqual(Object.keys(reparsed[0]), ['Id', 'Title', 'PlateId', 'Description', 'Condition']);
  assert.deepEqual(Object.keys(reparsed[1]), ['Id', 'Title', 'PlateId', 'Description', 'Hidden', 'Condition']);
  assert.equal(reparsed[1].Hidden, true);
  assert.deepEqual(Object.keys(reparsed[0].Condition), ['Type', 'Difficulty', 'OptionConditions']);
  assert.equal(reparsed[1].Condition.OptionConditions[0], 'ScrollSpeed>=2.0');
});

test('import fills null Condition and null OptionConditions', () => {
  const result = C.parseTitleJson('[{"Id":"a","Title":"A","Condition":null}]');
  assert.equal(result.ok, true);
  assert.equal(result.titles[0].type, 'Play');
  assert.equal(result.titles[0].difficulty, -1);
  assert.deepEqual(result.titles[0].conditions, []);
  assert.equal(result.notes.some((note) => note.code === 'V-105'), true);
});

test('import rejects non-array roots and non-object entries', () => {
  assert.equal(C.parseTitleJson('{"Id":"a"}').ok, false);
  assert.equal(C.parseTitleJson('[1]').ok, false);
  assert.equal(C.parseTitleJson('[{"Id":"a","Condition":{"OptionConditions":[1]}}]').ok, false);
  assert.equal(C.parseTitleJson('[{"Id":"a","Title":"A","Hidden":"true","Condition":{}}]').ok, false);
});

test('Hidden is omitted when false and written when true', () => {
  const normal = C.createTitle({ id: 'a', title: 'A' });
  const hidden = C.createTitle({ id: 'b', title: 'B', hidden: true });
  assert.equal('Hidden' in C.toJsonObject(normal), false);
  assert.equal(C.toJsonObject(hidden).Hidden, true);
});

test('Single-chart title can target a song path outside Requirements', () => {
  const source = `[
    {
      "Id": "pack_single_001",
      "Title": "個別称号",
      "PlateId": "01",
      "Description": "",
      "Condition": {
        "SongPath": "PackA/song1/song.tja",
        "Type": "Clear",
        "Difficulty": 3,
        "OptionConditions": []
      }
    }
  ]`;

  const result = C.parseTitleJson(source);
  assert.equal(result.ok, true);
  assert.equal(result.titles[0].mode, 'single');
  assert.equal(result.titles[0].songPath, 'PackA/song1/song.tja');

  const output = C.serializeTitles(result.titles);
  const reparsed = JSON.parse(output);
  assert.deepEqual(Object.keys(reparsed[0].Condition), ['SongPath', 'Type', 'Difficulty', 'OptionConditions']);
  assert.equal(reparsed[0].Condition.SongPath, 'PackA/song1/song.tja');

  const validation = C.validateAll(result.titles);
  assert.equal(validation.counts.errors, 0);
});

test('Multi conditions parse and round-trip all chart requirements', () => {
  const source = `[
    {
      "Id": "multi_001",
      "Title": "三曲制覇",
      "PlateId": "ex_gold",
      "Description": "対象3曲をすべてクリア",
      "Hidden": true,
      "Condition": {
        "Type": "Multi",
        "Requirements": [
          { "SongPath": "PackA/song1/song.tja", "Difficulty": 3, "Type": "Clear", "OptionConditions": [] },
          { "SongPath": "PackA/song2/song.tja", "Difficulty": 4, "Type": "FullCombo", "OptionConditions": ["ScrollSpeed>=2.0"] }
        ]
      }
    }
  ]`;

  const result = C.parseTitleJson(source);
  assert.equal(result.ok, true);
  assert.equal(result.titles[0].mode, 'multi');
  assert.equal(result.titles[0].requirements.length, 2);
  assert.equal(result.titles[0].requirements[0].songPath, 'PackA/song1/song.tja');
  assert.equal(result.titles[0].requirements[1].conditions[0], 'ScrollSpeed>=2.0');

  const output = C.serializeTitles(result.titles);
  const reparsed = JSON.parse(output);
  assert.equal(reparsed[0].Hidden, true);
  assert.equal(reparsed[0].Condition.Type, 'Multi');
  assert.deepEqual(Object.keys(reparsed[0].Condition), ['Type', 'Requirements']);
  assert.deepEqual(Object.keys(reparsed[0].Condition.Requirements[0]), ['SongPath', 'Difficulty', 'Type', 'OptionConditions']);
  assert.equal(reparsed[0].Condition.Requirements[1].Difficulty, 4);
});

test('Multi validation rejects missing chart paths and invalid difficulties', () => {
  const titles = [
    C.createTitle({
      id: 'multi_bad',
      title: 'BAD',
      mode: 'multi',
      requirements: [
        { songPath: '', difficulty: 3, type: 'Clear', conditions: [] },
        { songPath: '/absolute/song.tja', difficulty: 9, type: 'Unknown', conditions: ['Doron>=1'] },
      ],
    }),
    C.createTitle({
      id: 'multi_empty',
      title: 'EMPTY',
      mode: 'multi',
      requirements: [],
    }),
  ];
  const result = C.validateAll(titles);
  const codes = result.issues.map((issue) => issue.code);
  assert.ok(codes.includes('V-120'));
  assert.ok(codes.includes('V-121'));
  assert.ok(codes.includes('V-122'));
  assert.ok(codes.includes('V-125'));
  assert.ok(codes.includes('V-602'));
});

test('validation blocks empty and duplicate IDs and bad expressions', () => {
  const titles = [
    C.createTitle({ id: '', title: 'A', plateId: '01' }),
    C.createTitle({ id: 'same', title: 'B', plateId: '01', conditions: ['Doron>=1'] }),
    C.createTitle({ id: 'same', title: 'あ'.repeat(25), plateId: '01', conditions: ['ScrollSpeed=2.3'] }),
    C.createTitle({ id: 'conflict', title: 'D', plateId: '01', conditions: ['Swap=true', 'Swap=false'] }),
    C.createTitle({ id: 'dupname1', title: '同じ名前', plateId: '01' }),
    C.createTitle({ id: 'dupname2', title: '同じ名前', plateId: '01' }),
  ];
  const result = C.validateAll(titles);
  const codes = result.issues.map((issue) => issue.code);
  assert.ok(codes.includes('V-201'));
  assert.ok(codes.includes('V-202'));
  assert.ok(codes.includes('V-804'));
  assert.ok(codes.includes('V-809'));
  assert.ok(codes.includes('V-810'));
  assert.equal(codes.includes('V-303'), false);
  assert.equal(codes.includes('V-304'), false);
  assert.equal(codes.includes('V-305'), false);
  assert.equal(result.counts.errors > 0, true);
});

test('valid condition sets are satisfiable and evaluate correctly', () => {
  assert.equal(C.conditionsSatisfiable(['ScrollSpeed>=2.0', 'Swap=true']), true);
  assert.equal(C.conditionsSatisfiable(['Swap=true', 'Swap=false']), false);
  assert.equal(C.evaluateExpression('ScrollSpeed>=2.0', { scrollSpeed: 2.0 }), true);
  assert.equal(C.evaluateExpression('ScrollSpeed>=2.0', { scrollSpeed: 1.9 }), false);
  assert.equal(C.evaluateExpression('Doron!=0', { doron: 2 }), true);
  assert.equal(C.evaluateExpression('ScrollSpeed=2.3', { scrollSpeed: 2.3 }), true);
});

test('condition summaries follow the design examples', () => {
  assert.equal(
    C.summarizeCondition({ type: 'FullCombo', difficulty: 3, conditions: ['ScrollSpeed>=2.0'] }),
    'おにで、スクロール速度2.0以上の状態でフルコンボすると獲得'
  );
  assert.equal(
    C.summarizeCondition({ type: 'Play', difficulty: -1, conditions: [] }),
    '全難易度でプレイすると獲得'
  );
  assert.equal(
    C.summarizeCondition({ type: 'DonderfulCombo', difficulty: 4, conditions: ['Swap=true', 'Doron=2'] }),
    'おに（裏）で、あべこべON・ドロン（ステルス）の状態でドンダフルコンボすると獲得'
  );
});

test('builds the Description sentence from song, difficulty, options and type', () => {
  assert.equal(
    C.buildDescription({ type: 'FullCombo', difficulty: 3, conditions: ['ScrollSpeed>=2.0'] }, 'サンプル曲'),
    'サンプル曲を難易度おにで(オプション「スクロール速度2.0以上」で)フルコンボ'
  );
  assert.equal(
    C.buildDescription({ type: 'Play', difficulty: -1, conditions: [] }, ''),
    'この曲をいずれかの難易度でプレイ'
  );
  assert.equal(
    C.buildDescription({ type: 'DonderfulCombo', difficulty: 4, conditions: ['Swap=true', 'Doron=2'] }, 'テスト'),
    'テストを難易度おに（裏）で(オプション「あべこべON・ドロン（ステルス）」で)ドンダフルコンボ'
  );
  assert.equal(
    C.buildDescription({
      mode: 'multi',
      requirements: [
        { difficulty: 4, type: 'Clear', conditions: [] },
        { difficulty: 4, type: 'Clear', conditions: [] },
        { difficulty: 4, type: 'Clear', conditions: [] },
      ],
    }, '無視される曲名'),
    '対象3譜面をすべてクリア（おに裏）'
  );
  assert.equal(
    C.buildDescription({
      mode: 'multi',
      requirements: [
        { difficulty: 4, type: 'Play', conditions: [] },
        { difficulty: 4, type: 'Clear', conditions: [] },
        { difficulty: 4, type: 'Clear', conditions: [] },
      ],
    }, ''),
    '対象3譜面で、プレイ・クリア・クリアの条件をそれぞれ満たす（おに裏）'
  );
  assert.equal(
    C.buildDescription({
      mode: 'multi',
      requirements: [
        { difficulty: 3, type: 'Clear', conditions: ['ScrollSpeed>=2.0'] },
        { difficulty: 3, type: 'Clear', conditions: [] },
      ],
    }, ''),
    '対象2譜面をすべてクリア（おに、各譜面にオプション条件あり）'
  );
  assert.equal(
    C.buildDescription({
      mode: 'multi',
      requirements: [
        { difficulty: 3, type: 'Clear', conditions: ['ScrollSpeed>=2.0'] },
        { difficulty: 3, type: 'Clear', conditions: ['ScrollSpeed>=2.0'] },
      ],
    }, ''),
    '対象2譜面をすべてクリア（おに、オプション「スクロール速度2.0以上」で）'
  );
});

test('ID allocation avoids collisions and copy suffixes', () => {
  const existing = ['song_001', 'song_003', 'song_002_copy'];
  assert.equal(C.nextId(existing, 'song'), 'song_004');
  assert.equal(C.nextId([], 'title'), 'title_001');
  assert.equal(C.nextCopyId('song_001', existing), 'song_001_copy');
});

test('templates provide the requested single and grouped sets', () => {
  assert.equal(C.TEMPLATES.length, 6);
  assert.deepEqual(C.TEMPLATES.map((template) => template.items.length), [1, 1, 1, 1, 3, 6]);
  assert.equal(C.TEMPLATES[0].items[0].plateId, '02');
  assert.equal(C.TEMPLATES[1].items[0].plateId, '02');
  assert.equal(C.TEMPLATES[2].items[0].plateId, '03');
  assert.equal(C.TEMPLATES[3].items[0].type, 'DonderfulCombo');
  assert.equal(C.TEMPLATES[3].items[0].plateId, '03');
  assert.deepEqual(C.TEMPLATES[4].items.map((item) => item.plateId), ['ex_silver', 'ex_gold', 'ex_dfc']);
  assert.deepEqual(C.TEMPLATES[5].items.map((item) => item.plateId), [
    'ex_silver', 'ex_gold', 'ex_dfc', 'ura_silver', 'ura_gold', 'ura_dfc',
  ]);
  assert.equal(C.TEMPLATES[4].useSongTitle, true);
  assert.equal(C.TEMPLATES[5].useSongTitle, true);
  assert.deepEqual(C.PLATE_IDS, [
    '00', '01', '02', '03', '04',
    'ex_silver', 'ex_gold', 'ex_dfc',
    'ura_silver', 'ura_gold', 'ura_dfc',
  ]);
  assert.equal(C.TYPE_META.DonderfulCombo.label, 'ドンダフルコンボ');
  assert.equal(C.TYPE_META.DonderfulCombo.code, 'DONDERFUL COMBO');
});
