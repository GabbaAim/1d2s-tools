/*
 * 1D2S title.json editor — domain rules
 *
 * ゲーム実装（TitleData.cs / TitleManager.cs / EnsoOptions.cs）を正として、
 * 読み込み・正規化・検証・獲得判定・出力整形を UI から独立した純粋関数で提供する。
 * ブラウザでは window.TitleCore、Node では module.exports で利用できる。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TitleCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TYPES = ['Play', 'Clear', 'FullCombo', 'DonderfulCombo'];

  const TYPE_META = {
    Play: {
      label: 'プレイ',
      code: 'PLAY',
      description: '条件に合う状態で演奏を終えれば獲得。クリアは不要。',
    },
    Clear: {
      label: 'クリア',
      code: 'CLEAR',
      description: 'ノルマクリアして演奏を終えると獲得。',
    },
    FullCombo: {
      label: 'フルコンボ',
      code: 'FULL COMBO',
      description: '不可と Miss が 0 なら獲得。可（OK）は許容。',
    },
    DonderfulCombo: {
      label: 'ドンダフルコンボ',
      code: 'DONDERFUL COMBO',
      description: '不可・Miss・可がすべて 0 のとき獲得。',
    },
  };

  const DIFFICULTIES = [
    { value: -1, label: '全難易度', short: 'ALL' },
    { value: 0, label: 'かんたん', short: 'EASY' },
    { value: 1, label: 'ふつう', short: 'NORMAL' },
    { value: 2, label: 'むずかしい', short: 'HARD' },
    { value: 3, label: 'おに', short: 'ONI' },
    { value: 4, label: 'おに（裏）', short: 'URA' },
  ];

  const PLATE_IDS = [
    '00', '01', '02', '03', '04',
    'ex_silver', 'ex_gold', 'ex_dfc',
    'ura_silver', 'ura_gold', 'ura_dfc',
  ];

  const PROPERTY_META = {
    ScrollSpeed: {
      label: 'スクロール速度',
      type: 'number',
      operators: ['>=', '<=', '!=', '=', '>', '<'],
      defaultValue: '2.0',
    },
    Swap: {
      label: 'あべこべ',
      type: 'boolean',
      operators: ['=', '!='],
      defaultValue: 'true',
    },
    Doron: {
      label: 'ドロン',
      type: 'enum',
      operators: ['=', '!='],
      values: [0, 1, 2],
      valueLabels: ['なし', 'ドロン', 'ステルス'],
      defaultValue: '1',
    },
    Random: {
      label: 'ランダム',
      type: 'enum',
      operators: ['=', '!='],
      values: [0, 1, 2],
      valueLabels: ['なし', 'きまぐれ', 'でたらめ'],
      defaultValue: '1',
    },
  };

  const PROPERTY_NAMES = Object.keys(PROPERTY_META);

  // OptionPopup.cs で実際に選択できるスクロール速度。
  const SCROLL_SPEEDS = (function () {
    const values = [];
    for (let i = 5; i <= 20; i++) values.push(i / 10);
    values.push(2.5, 3.0, 3.5, 4.0);
    return values;
  })();

  const TEMPLATES = [
    {
      name: 'プレイ',
      items: [{ title: 'プレイ', type: 'Play', difficulty: -1, plateId: '02', conditions: [] }],
    },
    {
      name: 'クリア',
      items: [{ title: 'クリア', type: 'Clear', difficulty: -1, plateId: '02', conditions: [] }],
    },
    {
      name: 'フルコンボ',
      items: [{ title: 'フルコンボ', type: 'FullCombo', difficulty: -1, plateId: '03', conditions: [] }],
    },
    {
      name: 'ドンダフルコンボ',
      items: [{ title: 'ドンダフルコンボ', type: 'DonderfulCombo', difficulty: -1, plateId: '03', conditions: [] }],
    },
    {
      name: 'おに・クリア～ドンダフルコンボ称号',
      useSongTitle: true,
      items: [
        { title: 'おに・クリア', type: 'Clear', difficulty: 3, plateId: 'ex_silver', conditions: [] },
        { title: 'おに・フルコンボ', type: 'FullCombo', difficulty: 3, plateId: 'ex_gold', conditions: [] },
        { title: 'おに・ドンダフルコンボ', type: 'DonderfulCombo', difficulty: 3, plateId: 'ex_dfc', conditions: [] },
      ],
    },
    {
      name: 'おに＆おに（裏）・クリア～ドンダフルコンボ称号',
      useSongTitle: true,
      items: [
        { title: 'おに・クリア', type: 'Clear', difficulty: 3, plateId: 'ex_silver', conditions: [] },
        { title: 'おに・フルコンボ', type: 'FullCombo', difficulty: 3, plateId: 'ex_gold', conditions: [] },
        { title: 'おに・ドンダフルコンボ', type: 'DonderfulCombo', difficulty: 3, plateId: 'ex_dfc', conditions: [] },
        { title: 'おに（裏）・クリア', type: 'Clear', difficulty: 4, plateId: 'ura_silver', conditions: [] },
        { title: 'おに（裏）・フルコンボ', type: 'FullCombo', difficulty: 4, plateId: 'ura_gold', conditions: [] },
        { title: 'おに（裏）・ドンダフルコンボ', type: 'DonderfulCombo', difficulty: 4, plateId: 'ura_dfc', conditions: [] },
      ],
    },
  ];

  const OPERATORS = ['>=', '<=', '!=', '=', '>', '<'];

  let uidCounter = 0;
  function uid() {
    uidCounter += 1;
    return 't' + uidCounter + '_' + Math.random().toString(36).slice(2, 9);
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function normalizeTypeName(value) {
    if (typeof value === 'number' && TYPES[value]) return TYPES[value];
    if (typeof value === 'string') {
      const caseMatch = TYPES.find((candidate) => candidate.toLowerCase() === value.toLowerCase());
      if (caseMatch) return caseMatch;
      return value;
    }
    return value == null ? 'Play' : String(value);
  }

  function sanitizePrefix(name) {
    const normalized = String(name || '')
      .normalize('NFKC')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^[_\-.]+|[_\-.]+$/g, '');
    return normalized.slice(0, 32);
  }

  function formatSpeed(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    if (Math.abs(number * 10 - Math.round(number * 10)) < 1e-9) {
      return number.toFixed(1);
    }
    return String(number);
  }

  function speedExists(value) {
    return SCROLL_SPEEDS.some((speed) => Math.abs(speed - Number(value)) < 1e-4);
  }

  function createTitle(overrides) {
    const base = {
      _uid: uid(),
      id: '',
      title: '',
      plateId: '',
      description: '',
      hidden: false,
      mode: 'single',
      type: 'Play',
      difficulty: -1,
      conditions: [],
      requirements: [],
    };
    return Object.assign(base, overrides || {});
  }

  function inferIdPrefix(titles) {
    const first = (titles || []).find((title) => title && typeof title.id === 'string' && title.id.trim());
    if (!first) return 'title';
    const match = /^(.*?)(?:[-_.]?)(\d+)$/.exec(first.id.trim());
    if (match) {
      const prefix = sanitizePrefix(match[1]);
      if (prefix) return prefix;
    }
    return sanitizePrefix(first.id) || 'title';
  }

  function nextId(existingIds, prefix) {
    const used = new Set(existingIds || []);
    const base = sanitizePrefix(prefix) || 'title';
    const pattern = new RegExp('^' + escapeRegExp(base) + '(?:[-_.]?)(\\d+)$', 'i');
    let max = 0;
    for (const id of used) {
      const match = pattern.exec(String(id));
      if (match) max = Math.max(max, Number(match[1]));
    }
    let number = Math.max(max + 1, 1);
    let candidate = '';
    do {
      candidate = base + '_' + String(number).padStart(3, '0');
      number += 1;
    } while (used.has(candidate));
    return candidate;
  }

  function nextCopyId(baseId, existingIds) {
    const used = new Set(existingIds || []);
    const base = sanitizePrefix(baseId) || 'title';
    let candidate = base + '_copy';
    let number = 2;
    while (used.has(candidate)) {
      candidate = base + '_copy' + number;
      number += 1;
    }
    return candidate;
  }

  function findOperator(expression) {
    for (const operator of OPERATORS) {
      const index = expression.indexOf(operator);
      if (index >= 0) return { operator, index };
    }
    return null;
  }

  function parseExpression(expression) {
    const raw = String(expression == null ? '' : expression);
    const trimmed = raw.trim();

    if (!trimmed) {
      return {
        ok: false,
        code: 'V-801',
        message: '条件式が空です。例: ScrollSpeed>=2.0',
        raw,
      };
    }

    if (/[０-９Ａ-Ｚａ-ｚ＞＜＝！＋－．]/.test(raw)) {
      return {
        ok: false,
        code: 'V-812',
        message: '演算子・数値・プロパティ名は半角で入力してください。',
        raw,
      };
    }

    const found = findOperator(trimmed);
    if (!found) {
      return {
        ok: false,
        code: 'V-801',
        message: '条件式を解釈できません。例: ScrollSpeed>=2.0',
        raw,
      };
    }

    const name = trimmed.slice(0, found.index).trim();
    const valueText = trimmed.slice(found.index + found.operator.length).trim();

    if (!name) {
      return {
        ok: false,
        code: 'V-802',
        message: 'プロパティ名が空です。使用可能: ' + PROPERTY_NAMES.join(' / '),
        raw,
      };
    }

    const meta = PROPERTY_META[name];
    if (!meta) {
      const caseMatch = PROPERTY_NAMES.find((key) => key.toLowerCase() === name.toLowerCase());
      return {
        ok: false,
        code: caseMatch ? 'V-803' : 'V-802',
        message: caseMatch
          ? 'プロパティ名は大文字小文字を区別します。「' + caseMatch + '」を使用してください。'
          : '「' + name + '」は使用できません。使用可能: ' + PROPERTY_NAMES.join(' / '),
        raw,
      };
    }

    if (!meta.operators.includes(found.operator)) {
      return {
        ok: false,
        code: 'V-804',
        message: name + ' は ' + found.operator + ' を使用できません（= と != のみ）。',
        raw,
      };
    }

    if (!valueText) {
      return {
        ok: false,
        code: 'V-801',
        message: '比較する値が空です。',
        raw,
      };
    }

    let value;
    let valueTextCanonical = valueText;

    if (meta.type === 'boolean') {
      const lower = valueText.toLowerCase();
      if (lower !== 'true' && lower !== 'false') {
        return {
          ok: false,
          code: 'V-805',
          message: 'true または false を指定してください。',
          raw,
        };
      }
      value = lower === 'true';
      valueTextCanonical = lower;
    } else if (meta.type === 'enum') {
      if (!/^-?\d+$/.test(valueText)) {
        return {
          ok: false,
          code: 'V-807',
          message: '0〜2 の整数で指定してください。',
          raw,
        };
      }
      value = Number(valueText);
      if (!meta.values.includes(value)) {
        return {
          ok: false,
          code: 'V-807',
          message: '0〜2 の整数で指定してください。',
          raw,
        };
      }
      valueTextCanonical = String(value);
    } else {
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(valueText)) {
        return {
          ok: false,
          code: 'V-806',
          message: '数値で指定してください。',
          raw,
        };
      }
      value = Number(valueText);
      if (!Number.isFinite(value)) {
        return {
          ok: false,
          code: 'V-806',
          message: '数値で指定してください。',
          raw,
        };
      }
    }

    return {
      ok: true,
      code: null,
      message: '',
      raw,
      property: name,
      propertyMeta: meta,
      operator: found.operator,
      valueText: valueTextCanonical,
      value,
      type: meta.type,
    };
  }

  function formatExpression(property, operator, valueText) {
    return String(property || '') + String(operator || '') + String(valueText == null ? '' : valueText);
  }

  function getOptionValue(property, options) {
    const opts = options || {};
    switch (property) {
      case 'ScrollSpeed':
        return Number(opts.scrollSpeed == null ? 1.0 : opts.scrollSpeed);
      case 'Swap':
        return Boolean(opts.swap);
      case 'Doron':
        return Number(opts.doron == null ? 0 : opts.doron);
      case 'Random':
        return Number(opts.random == null ? 0 : opts.random);
      default:
        return undefined;
    }
  }

  function evaluateParsed(parsed, options) {
    if (!parsed || !parsed.ok) return false;
    const actual = getOptionValue(parsed.property, options);
    if (actual === undefined) return false;

    if (parsed.type === 'number') {
      const expected = Number(parsed.value);
      const epsilon = 1e-4;
      switch (parsed.operator) {
        case '=': return Math.abs(actual - expected) < epsilon;
        case '!=': return Math.abs(actual - expected) >= epsilon;
        case '>': return actual > expected;
        case '<': return actual < expected;
        case '>=': return actual >= expected || Math.abs(actual - expected) < epsilon;
        case '<=': return actual <= expected || Math.abs(actual - expected) < epsilon;
        default: return false;
      }
    }

    if (parsed.type === 'boolean') {
      if (parsed.operator === '=') return actual === parsed.value;
      if (parsed.operator === '!=') return actual !== parsed.value;
      return false;
    }

    if (parsed.type === 'enum') {
      if (parsed.operator === '=') return actual === parsed.value;
      if (parsed.operator === '!=') return actual !== parsed.value;
      return false;
    }

    return false;
  }

  function evaluateExpression(expression, options) {
    return evaluateParsed(parseExpression(expression), options);
  }

  function expressionSatisfiable(parsed) {
    if (!parsed || !parsed.ok) return null;
    if (parsed.type !== 'number') return true;
    return SCROLL_SPEEDS.some((speed) => evaluateParsed(parsed, { scrollSpeed: speed }));
  }

  function conditionsSatisfiable(conditions) {
    const parsedList = (conditions || []).map(parseExpression);
    if (parsedList.some((parsed) => !parsed.ok)) return null;

    for (const scrollSpeed of SCROLL_SPEEDS) {
      for (const swap of [false, true]) {
        for (const doron of [0, 1, 2]) {
          for (const random of [0, 1, 2]) {
            const options = { scrollSpeed, swap, doron, random };
            if (parsedList.every((parsed) => evaluateParsed(parsed, options))) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  function difficultyLabel(value) {
    const found = DIFFICULTIES.find((difficulty) => difficulty.value === value);
    return found ? found.label : '不明な難易度';
  }

  function describeExpression(expression) {
    const parsed = parseExpression(expression);
    if (!parsed.ok) {
      return expression ? '式「' + expression + '」' : '空の条件';
    }

    if (parsed.type === 'number') {
      const value = formatSpeed(parsed.value);
      switch (parsed.operator) {
        case '>=': return 'スクロール速度' + value + '以上';
        case '<=': return 'スクロール速度' + value + '以下';
        case '>': return 'スクロール速度' + value + 'より速い';
        case '<': return 'スクロール速度' + value + 'より遅い';
        case '=': return 'スクロール速度' + value + 'ちょうど';
        case '!=': return 'スクロール速度' + value + '以外';
        default: return expression;
      }
    }

    if (parsed.type === 'boolean') {
      const on = parsed.value === true;
      if (parsed.operator === '=') return on ? 'あべこべON' : 'あべこべOFF';
      return on ? 'あべこべOFF' : 'あべこべON';
    }

    if (parsed.type === 'enum') {
      const meta = parsed.propertyMeta;
      const value = parsed.value;
      if (parsed.operator === '=') {
        const label = meta.valueLabels[value] || String(value);
        if (parsed.property === 'Doron') {
          return value === 0 ? 'ドロンなし' : 'ドロン' + (value === 2 ? '（ステルス）' : '');
        }
        return parsed.property === 'Random'
          ? (value === 0 ? 'ランダムなし' : 'ランダム' + (value === 1 ? '（きまぐれ）' : '（でたらめ）'))
          : label;
      }
      if (parsed.property === 'Doron' && value === 0) return 'ドロンまたはステルス';
      if (parsed.property === 'Random' && value === 0) return 'ランダムあり';
      const label = meta.valueLabels[value] || String(value);
      return label + '以外';
    }

    return expression;
  }

  function summarizeCondition(title) {
    const condition = normalizeCondition(title);
    const difficulty = difficultyLabel(condition.difficulty);
    const descriptions = condition.optionConditions.map(describeExpression).filter(Boolean);
    const action = TYPE_META[condition.type] && condition.type === 'Play'
      ? 'プレイする'
      : condition.type === 'Clear'
        ? 'クリアする'
        : condition.type === 'FullCombo'
          ? 'フルコンボする'
          : condition.type === 'DonderfulCombo'
            ? 'ドンダフルコンボする'
            : '演奏する';

    if (descriptions.length > 0) {
      return difficulty + 'で、' + descriptions.join('・') + 'の状態で' + action + 'と獲得';
    }
    return difficulty + 'で' + action + 'と獲得';
  }

  /**
   * Description 用の文章。
   * 例: サンプル曲を難易度おにで(オプション「スクロール速度2.0以上」で)フルコンボ
   */
  function buildDescription(title, songTitle) {
    if (title && title.mode === 'multi') {
      const song = String(songTitle || '').trim() || 'この曲';
      const count = Array.isArray(title.requirements) ? title.requirements.length : 0;
      return song + 'の指定した' + count + '譜面の条件をすべて満たす';
    }

    const condition = normalizeCondition(title);
    const song = String(songTitle || '').trim() || 'この曲';
    const difficultyPart = condition.difficulty === -1
      ? 'いずれかの難易度で'
      : '難易度' + difficultyLabel(condition.difficulty) + 'で';
    const descriptions = condition.optionConditions.map(describeExpression).filter(Boolean);
    const option = descriptions.length
      ? '(オプション「' + descriptions.join('・') + '」で)'
      : '';
    const type = TYPE_META[condition.type] ? TYPE_META[condition.type].label : 'プレイ';
    return song + 'を' + difficultyPart + option + type;
  }

  function normalizeCondition(title) {
    const type = title && TYPES.includes(title.type) ? title.type : 'Play';
    const difficulty = title && title.difficulty != null ? title.difficulty : -1;
    const optionConditions = title && Array.isArray(title.conditions) ? title.conditions.slice() : [];
    return { type, difficulty, optionConditions };
  }

  function toJsonObject(title) {
    const isMulti = title && title.mode === 'multi';
    const result = {
      Id: title && title.id != null ? String(title.id) : '',
      Title: title && title.title != null ? String(title.title) : '',
      PlateId: title && title.plateId != null ? String(title.plateId) : '',
      Description: title && title.description != null ? String(title.description) : '',
    };
    if (title && title.hidden === true) {
      result.Hidden = true;
    }

    if (isMulti) {
      result.Condition = {
        Type: 'Multi',
        Requirements: (title.requirements || []).map((requirement) => ({
          SongPath: String(requirement.songPath || ''),
          Difficulty: requirement.difficulty,
          Type: requirement.type,
          OptionConditions: (requirement.conditions || []).map((value) => String(value)),
        })),
      };
      return result;
    }

    const condition = normalizeCondition(title);
    result.Condition = {
      Type: condition.type,
      Difficulty: condition.difficulty,
      OptionConditions: condition.optionConditions.map((value) => String(value)),
    };
    return result;
  }

  function serializeTitles(titles) {
    const list = (titles || []).map(toJsonObject);
    return JSON.stringify(list, null, 2) + '\n';
  }

  function validateAll(titles) {
    const list = Array.isArray(titles) ? titles : [];
    const issues = [];

    function add(severity, code, titleIndex, field, message, conditionIndex, requirementIndex, optionIndex) {
      issues.push({
        severity,
        code,
        titleIndex,
        field,
        message,
        conditionIndex: conditionIndex == null ? null : conditionIndex,
        requirementIndex: requirementIndex == null ? null : requirementIndex,
        optionIndex: optionIndex == null ? null : optionIndex,
      });
    }

    function validateOptionExpressions(expressions, titleIndex, field, requirementIndex) {
      const seenExpressions = new Set();
      let errors = 0;
      let parseable = true;
      let individualUnsatisfiable = false;

      expressions.forEach((expression, optionIndex) => {
        const text = String(expression == null ? '' : expression);
        const conditionIndex = field === 'conditions' ? optionIndex : null;
        if (text.length > 200) {
          add('error', 'V-801', titleIndex, field, '条件式が長すぎます（1 本 200 文字以内）。', conditionIndex, requirementIndex, optionIndex);
          errors += 1;
          parseable = false;
          return;
        }

        const parsed = parseExpression(text);
        if (!parsed.ok) {
          add('error', parsed.code, titleIndex, field, parsed.message, conditionIndex, requirementIndex, optionIndex);
          errors += 1;
          parseable = false;
          return;
        }

        if (parsed.type === 'number') {
          if (parsed.operator === '=' && !speedExists(parsed.value)) {
            add('error', 'V-809', titleIndex, field, 'ScrollSpeed の = は設定可能値（0.5〜2.0 の 0.1 刻み、2.5、3.0、3.5、4.0）で指定してください。', conditionIndex, requirementIndex, optionIndex);
            errors += 1;
            individualUnsatisfiable = true;
          } else if (parsed.operator !== '=' && expressionSatisfiable(parsed) === false) {
            add('error', 'V-808', titleIndex, field, 'この条件を満たす設定値がありません（設定可能値: 0.5〜2.0 の 0.1 刻み、2.5、3.0、3.5、4.0）。', conditionIndex, requirementIndex, optionIndex);
            errors += 1;
            individualUnsatisfiable = true;
          }
        }

        const key = text.trim();
        if (seenExpressions.has(key)) {
          add('info', 'V-811', titleIndex, field, '同じ条件が重複しています。', conditionIndex, requirementIndex, optionIndex);
        } else {
          seenExpressions.add(key);
        }
      });

      if (parseable && errors === 0 && !individualUnsatisfiable && expressions.length > 1) {
        if (conditionsSatisfiable(expressions) === false) {
          add('error', 'V-810', titleIndex, field, 'この条件の組み合わせを満たす設定がありません（例: Swap=true と Swap=false）。', null, requirementIndex, null);
        }
      }

      return { errors, parseable };
    }

    const ids = new Map();
    list.forEach((title, index) => {
      const id = title && title.id != null ? String(title.id) : '';
      if (id.trim()) {
        if (!ids.has(id)) ids.set(id, []);
        ids.get(id).push(index);
      }
    });

    if (list.length === 0) {
      add('warning', 'V-901', null, 'global', '称号がありません。このまま出力できますが、通常は 1 件以上を定義します。');
    } else if (list.length > 30) {
      add('info', 'V-902', null, 'global', '1 曲あたり 5〜10 件を推奨します（現在 ' + list.length + ' 件）。');
    }

    list.forEach((title, index) => {
      const id = title && title.id != null ? String(title.id) : '';
      const displayName = title && title.title != null ? String(title.title) : '';
      const plateId = title && title.plateId != null ? String(title.plateId) : '';
      const description = title && title.description != null ? String(title.description) : '';

      if (!id.trim()) {
        add('error', 'V-201', index, 'id', '称号ID は必須です。称号を識別するため入力してください。');
      } else {
        if (id.length > 64) add('warning', 'V-205', index, 'id', '称号ID が長すぎます（64 文字以内を推奨）。');
        if (/[\u0000-\u001f\u007f]/.test(id)) {
          add('error', 'V-204', index, 'id', '称号ID に改行・制御文字は使用できません。');
        }
        if (!/^[A-Za-z0-9._-]+$/.test(id)) {
          add('warning', 'V-203', index, 'id', '称号ID は半角英数字と _ - . を推奨します。');
        }
        const sameIds = ids.get(id) || [];
        if (sameIds.length > 1) {
          add('error', 'V-202', index, 'id', '称号ID「' + id + '」が ' + sameIds.length + ' 件あります。全曲で一意にしてください。');
        }
      }

      if (!displayName.trim()) {
        add('error', 'V-301', index, 'title', '称号名は必須です。ゲーム内に表示する名前を入力してください。');
      } else {
        if (/[\u0000-\u001f\u007f]/.test(displayName)) {
          add('error', 'V-302', index, 'title', '称号名に改行・制御文字は使用できません。');
        }
      }

      if (!plateId) {
        add('info', 'V-401', index, 'plateId', 'プレートID が空です。既定プレート 00 が使われます。');
      } else {
        if (/[\\/:*?"<>|]/.test(plateId) || /[\u0000-\u001f\u007f]/.test(plateId)) {
          add('error', 'V-402', index, 'plateId', 'プレートID にフォルダ名として使えない文字が含まれています。');
        }
        if (plateId !== plateId.trim() || plateId.includes('..')) {
          add('warning', 'V-404', index, 'plateId', 'プレートID の前後空白・連続ドットはフォルダ名と一致しません。');
        }
        if (!PLATE_IDS.includes(plateId)) {
          add('warning', 'V-403', index, 'plateId', '既定スキンにプレートID「' + plateId + '」がありません。スキンのフォルダ名と一致するか確認してください。');
        }
      }

      if (!description) {
        add('info', 'V-501', index, 'description', '説明文は任意です。');
      } else if (description.length > 200) {
        add('warning', 'V-502', index, 'description', '説明文が長すぎます（200 文字以内を推奨）。');
      }

      const isMulti = title && title.mode === 'multi';

      if (!isMulti) {
        const type = title && title.type;
        if (typeof type !== 'string' || !TYPES.includes(type)) {
          add('error', 'V-602', index, 'type', 'プレイ条件は Play / Clear / FullCombo / DonderfulCombo のいずれかです。');
        }

        const difficulty = title && title.difficulty;
        if (typeof difficulty !== 'number' || !Number.isFinite(difficulty) || !Number.isInteger(difficulty)) {
          add('error', 'V-702', index, 'difficulty', '難易度は整数で指定してください。');
        } else if (difficulty < -1 || difficulty > 4) {
          add('error', 'V-703', index, 'difficulty', '-1〜4 を指定してください。この値では条件が成立しません。');
        }

        const conditions = title && Array.isArray(title.conditions) ? title.conditions : [];
        if (conditions.length > 20) {
          add('error', 'V-808', index, 'conditions', 'オプション条件は 20 件以内にしてください。');
        }
        validateOptionExpressions(conditions, index, 'conditions', null);
      } else {
        const requirements = title && Array.isArray(title.requirements) ? title.requirements : [];
        if (requirements.length === 0) {
          add('error', 'V-120', index, 'requirements', '複数譜面条件には 1 件以上の譜面を指定してください。');
        }

        const seenRequirements = new Set();
        requirements.forEach((requirement, requirementIndex) => {
          const rawPath = requirement && requirement.songPath != null ? String(requirement.songPath) : '';
          const songPath = rawPath.trim().replace(/\\/g, '/');

          if (!songPath) {
            add('error', 'V-121', index, 'requirements', '譜面パスを入力してください。', null, requirementIndex);
          } else {
            if (rawPath.includes('\\')) {
              add('warning', 'V-126', index, 'requirements', '譜面パスの区切りは / を推奨します。', null, requirementIndex);
            }
            if (/^[A-Za-z]:\//.test(songPath) || songPath.startsWith('/')) {
              add('error', 'V-122', index, 'requirements', '譜面パスは songs フォルダからの相対パスで指定してください。', null, requirementIndex);
            }
            if (songPath.split('/').includes('..')) {
              add('error', 'V-123', index, 'requirements', '譜面パスに .. は使用できません。', null, requirementIndex);
            }
            if (!songPath.toLowerCase().endsWith('.tja')) {
              add('error', 'V-124', index, 'requirements', '譜面パスは .tja ファイルを指定してください。', null, requirementIndex);
            }
          }

          const difficulty = requirement && requirement.difficulty;
          if (typeof difficulty !== 'number' || !Number.isFinite(difficulty) ||
              !Number.isInteger(difficulty) || difficulty < 0 || difficulty > 4) {
            add('error', 'V-125', index, 'requirements', '難易度は 0〜4 で指定してください。', null, requirementIndex);
          }

          const type = requirement && requirement.type;
          if (typeof type !== 'string' || !TYPES.includes(type)) {
            add('error', 'V-602', index, 'requirements', 'プレイ条件は Play / Clear / FullCombo / DonderfulCombo のいずれかです。', null, requirementIndex);
          }

          const options = requirement && Array.isArray(requirement.conditions) ? requirement.conditions : [];
          if (options.length > 20) {
            add('error', 'V-808', index, 'requirements', 'オプション条件は 20 件以内にしてください。', null, requirementIndex);
          }
          validateOptionExpressions(options, index, 'requirements', requirementIndex);

          const key = songPath.toLowerCase() + '|' + String(difficulty) + '|' + String(type) + '|' +
            options.map((value) => String(value)).sort().join('\u001f');
          if (seenRequirements.has(key)) {
            add('info', 'V-127', index, 'requirements', '同じ譜面・条件の Requirement が重複しています。', null, requirementIndex);
          } else {
            seenRequirements.add(key);
          }
        });
      }
    });

    const errors = issues.filter((issue) => issue.severity === 'error');
    const warnings = issues.filter((issue) => issue.severity === 'warning');
    const infos = issues.filter((issue) => issue.severity === 'info');
    const byTitle = list.map((_, index) => issues.filter((issue) => issue.titleIndex === index));
    const globalIssues = issues.filter((issue) => issue.titleIndex == null);

    return {
      issues,
      errors,
      warnings,
      infos,
      byTitle,
      globalIssues,
      counts: {
        total: issues.length,
        errors: errors.length,
        warnings: warnings.length,
        infos: infos.length,
      },
    };
  }

  function getJsonErrorLocation(text, error) {
    const message = String(error && error.message ? error.message : error);
    const lineColumn = /line\s+(\d+)\s+column\s+(\d+)/i.exec(message);
    if (lineColumn) {
      return { line: Number(lineColumn[1]), column: Number(lineColumn[2]) };
    }
    const positionMatch = /position\s+(\d+)/i.exec(message);
    if (!positionMatch) return null;
    const position = Number(positionMatch[1]);
    const before = text.slice(0, position);
    const line = before.split('\n').length;
    const lastBreak = before.lastIndexOf('\n');
    return { line, column: position - lastBreak };
  }

  function parseTitleJson(text) {
    const raw = String(text == null ? '' : text).replace(/^\uFEFF/, '');
    if (!raw.trim()) {
      return { ok: false, error: { code: 'V-101', message: 'JSON が空です。' } };
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      const location = getJsonErrorLocation(raw, error);
      const suffix = location ? '（' + location.line + ' 行 ' + location.column + ' 列）' : '';
      return {
        ok: false,
        error: { code: 'V-101', message: 'JSON の形式が正しくありません' + suffix + '。' },
      };
    }

    if (!Array.isArray(parsed)) {
      return {
        ok: false,
        error: { code: 'V-102', message: 'title.json は称号の配列（[ ... ]）である必要があります。' },
      };
    }

    if (parsed.length > 500) {
      return {
        ok: false,
        error: { code: 'V-901', message: '称号が多すぎます（500 件以内にしてください）。' },
      };
    }

    const notes = [];
    function note(severity, code, message) {
      if (!notes.some((item) => item.code === code && item.message === message)) {
        notes.push({ severity, code, message });
      }
    }

    function readKey(object, name) {
      const keys = Object.keys(object);
      const foundKey = keys.find((key) => key.toLowerCase() === name.toLowerCase());
      return { found: foundKey !== undefined, key: foundKey, value: foundKey !== undefined ? object[foundKey] : undefined };
    }

    function checkUnknownKeys(object, knownNames, label) {
      for (const key of Object.keys(object)) {
        if (!knownNames.some((name) => name.toLowerCase() === key.toLowerCase())) {
          note('warning', 'V-104', label + 'の未知の項目「' + key + '」は無視されます。');
        }
      }
    }

    const titles = [];

    for (let index = 0; index < parsed.length; index++) {
      const element = parsed[index];
      if (!isPlainObject(element)) {
        return {
          ok: false,
          error: { code: 'V-103', message: (index + 1) + ' 件目がオブジェクトではありません。' },
        };
      }

      checkUnknownKeys(element, ['Id', 'Title', 'PlateId', 'Description', 'Hidden', 'Condition'], (index + 1) + ' 件目');

      const idField = readKey(element, 'Id');
      const titleField = readKey(element, 'Title');
      const plateField = readKey(element, 'PlateId');
      const descriptionField = readKey(element, 'Description');
      const hiddenField = readKey(element, 'Hidden');

      function readString(field, name) {
        if (!field.found || field.value === undefined) return '';
        if (field.value === null) {
          note('warning', 'V-207', name + ' に null は指定できません。空文字で補完しました。');
          return '';
        }
        if (typeof field.value !== 'string') {
          throw new Error(name + ' は文字列で指定してください。');
        }
        return field.value;
      }

      let id;
      let title;
      let plateId;
      let description;
      let hidden = false;
      try {
        id = readString(idField, '称号ID');
        title = readString(titleField, '称号名');
        plateId = readString(plateField, 'プレートID');
        description = readString(descriptionField, '説明');
      } catch (error) {
        return { ok: false, error: { code: 'V-207', message: (index + 1) + ' 件目: ' + error.message } };
      }

      if (hiddenField.found && hiddenField.value !== undefined) {
        if (typeof hiddenField.value !== 'boolean') {
          return {
            ok: false,
            error: { code: 'V-210', message: (index + 1) + ' 件目: Hidden は true または false で指定してください。' },
          };
        }
        hidden = hiddenField.value;
      }

      const conditionField = readKey(element, 'Condition');
      let type = 'Play';
      let difficulty = -1;
      let optionConditions = [];
      let mode = 'single';
      let requirements = [];

      if (!conditionField.found || conditionField.value === undefined) {
        note('warning', 'V-105', 'Condition がありません。既定値（Play／全難易度）で補完しました。');
      } else if (conditionField.value === null) {
        note('warning', 'V-105', 'Condition が null です。既定値（Play／全難易度）で補完しました。');
      } else if (!isPlainObject(conditionField.value)) {
        return {
          ok: false,
          error: { code: 'V-110', message: (index + 1) + ' 件目: Condition はオブジェクトで指定してください。' },
        };
      } else {
        const condition = conditionField.value;
        checkUnknownKeys(
          condition,
          ['Type', 'Difficulty', 'OptionConditions', 'Match', 'Requirements'],
          (index + 1) + ' 件目の Condition');

        const typeField = readKey(condition, 'Type');
        if (!typeField.found || typeField.value === undefined) {
          note('info', 'V-601', 'プレイ条件が未指定のため Play として扱います。');
        } else if (typeof typeField.value === 'number') {
          const converted = TYPES[typeField.value];
          if (converted) {
            type = converted;
            note('info', 'V-107', 'プレイ条件の数値を文字列「' + converted + '」に変換しました。');
          } else {
            type = String(typeField.value);
          }
        } else if (typeof typeField.value === 'string') {
          const caseMatch = TYPES.find((candidate) => candidate.toLowerCase() === typeField.value.toLowerCase());
          if (caseMatch) {
            type = caseMatch;
          } else {
            type = typeField.value;
          }
        } else {
          type = String(typeField.value);
        }

        const difficultyField = readKey(condition, 'Difficulty');
        if (!difficultyField.found || difficultyField.value === undefined) {
          note('info', 'V-701', 'Difficulty が未指定のため -1（全難易度）として扱います。');
        } else {
          difficulty = difficultyField.value;
        }

        const optionsField = readKey(condition, 'OptionConditions');
        if (!optionsField.found || optionsField.value === undefined) {
          optionConditions = [];
        } else if (optionsField.value === null) {
          note('warning', 'V-106', 'OptionConditions が null です。空配列で補完しました。');
        } else if (!Array.isArray(optionsField.value)) {
          return {
            ok: false,
            error: { code: 'V-111', message: (index + 1) + ' 件目: OptionConditions は配列で指定してください。' },
          };
        } else {
          for (let optionIndex = 0; optionIndex < optionsField.value.length; optionIndex++) {
            if (typeof optionsField.value[optionIndex] !== 'string') {
              return {
                ok: false,
                error: { code: 'V-112', message: (index + 1) + ' 件目の OptionConditions[' + optionIndex + '] は文字列で指定してください。' },
              };
            }
            optionConditions.push(optionsField.value[optionIndex]);
          }
        }

        const requirementsField = readKey(condition, 'Requirements');
        const isMultiType = typeof type === 'string' && type.toLowerCase() === 'multi';
        if (requirementsField.found && requirementsField.value !== undefined) {
          if (!Array.isArray(requirementsField.value)) {
            return {
              ok: false,
              error: { code: 'V-113', message: (index + 1) + ' 件目: Requirements は配列で指定してください。' },
            };
          }

          for (let requirementIndex = 0; requirementIndex < requirementsField.value.length; requirementIndex++) {
            const rawRequirement = requirementsField.value[requirementIndex];
            if (!isPlainObject(rawRequirement)) {
              return {
                ok: false,
                error: {
                  code: 'V-114',
                  message: (index + 1) + ' 件目の Requirements[' + requirementIndex + '] はオブジェクトで指定してください。',
                },
              };
            }

            checkUnknownKeys(
              rawRequirement,
              ['SongPath', 'Difficulty', 'Type', 'OptionConditions'],
              (index + 1) + ' 件目の Requirements[' + requirementIndex + ']');

            let songPath = '';
            const songPathField = readKey(rawRequirement, 'SongPath');
            if (songPathField.found && songPathField.value !== undefined) {
              if (songPathField.value === null) {
                note('warning', 'V-207', 'SongPath に null は指定できません。空文字で補完しました。');
              } else if (typeof songPathField.value !== 'string') {
                return {
                  ok: false,
                  error: {
                    code: 'V-115',
                    message: (index + 1) + ' 件目の Requirements[' + requirementIndex + '].SongPath は文字列で指定してください。',
                  },
                };
              } else {
                songPath = songPathField.value;
              }
            }

            let requirementDifficulty = -1;
            const requirementDifficultyField = readKey(rawRequirement, 'Difficulty');
            if (requirementDifficultyField.found && requirementDifficultyField.value !== undefined) {
              requirementDifficulty = requirementDifficultyField.value;
            }

            let requirementType = 'Play';
            const requirementTypeField = readKey(rawRequirement, 'Type');
            if (requirementTypeField.found && requirementTypeField.value !== undefined) {
              requirementType = normalizeTypeName(requirementTypeField.value);
            }

            let requirementOptions = [];
            const requirementOptionsField = readKey(rawRequirement, 'OptionConditions');
            if (requirementOptionsField.found && requirementOptionsField.value !== undefined) {
              if (requirementOptionsField.value === null) {
                note('warning', 'V-106', 'OptionConditions が null です。空配列で補完しました。');
              } else if (!Array.isArray(requirementOptionsField.value)) {
                return {
                  ok: false,
                  error: {
                    code: 'V-116',
                    message: (index + 1) + ' 件目の Requirements[' + requirementIndex + '].OptionConditions は配列で指定してください。',
                  },
                };
              } else {
                for (let optionIndex = 0; optionIndex < requirementOptionsField.value.length; optionIndex++) {
                  if (typeof requirementOptionsField.value[optionIndex] !== 'string') {
                    return {
                      ok: false,
                      error: {
                        code: 'V-117',
                        message: (index + 1) + ' 件目の Requirements[' + requirementIndex + '].OptionConditions[' + optionIndex + '] は文字列で指定してください。',
                      },
                    };
                  }
                  requirementOptions.push(requirementOptionsField.value[optionIndex]);
                }
              }
            }

            requirements.push({
              songPath,
              difficulty: requirementDifficulty,
              type: requirementType,
              conditions: requirementOptions,
            });
          }

          if (requirements.length > 0 || isMultiType) {
            mode = 'multi';
          }
        } else if (isMultiType) {
          mode = 'multi';
        }
      }

      titles.push(createTitle({
        id,
        title,
        plateId,
        description,
        hidden,
        mode,
        type,
        difficulty,
        conditions: optionConditions,
        requirements,
      }));
    }

    return { ok: true, titles, notes };
  }

  return {
    TYPES,
    TYPE_META,
    DIFFICULTIES,
    PLATE_IDS,
    PROPERTY_META,
    PROPERTY_NAMES,
    SCROLL_SPEEDS,
    TEMPLATES,
    OPERATORS,
    uid,
    sanitizePrefix,
    formatSpeed,
    speedExists,
    createTitle,
    inferIdPrefix,
    nextId,
    nextCopyId,
    parseExpression,
    formatExpression,
    evaluateParsed,
    evaluateExpression,
    expressionSatisfiable,
    conditionsSatisfiable,
    describeExpression,
    summarizeCondition,
    buildDescription,
    normalizeCondition,
    toJsonObject,
    serializeTitles,
    validateAll,
    parseTitleJson,
    difficultyLabel,
  };
});
