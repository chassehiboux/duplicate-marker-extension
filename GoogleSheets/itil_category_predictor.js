(() => {
  'use strict';

  const model = globalThis.itilCategoryModel;
  if (!model) return;

  const featureCount = 32768;
  let weights;
  let previousText;
  let previousCategory = '';

  function tokenize(text) {
    const messages = text.toLowerCase().replace(/ё/g, 'е').replace(/\r\n?/g, '\n')
      .split(/^[ \t]*[^\n()]+?[ \t]+\([0-9]{2}\.[0-9]{2}\.[0-9]{4}[ \t]+[0-9]{2}:[0-9]{2}:[0-9]{2}\):[ \t]*$/m, 2);
    const body = messages[messages.length - 1].replace(/^[\s\S]*?детальное описание:/, '');
    const clean = body.split(/служебная информация|решение обращения\s*:|причина возникновения инцидента:|[-_]{4,}\s*original message/, 1)[0]
      .replace(/внимание!\s*это письмо получено от внешнего отправителя!|https?:\/\/\S+|[a-zа-я0-9_.+-]+@[a-zа-я0-9_.-]+/g, ' ');
    return (clean.slice(0, 12000).match(/[а-яa-z]+/g) || []).slice(0, 1000);
  }

  function featureCounts(tokens) {
    const counts = new Map();
    function add(key, amount) {
      let hash = 2166136261;
      for (let i = 0; i < key.length; i += 1) {
        hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
      }
      const index = (hash >>> 0) % featureCount;
      counts.set(index, (counts.get(index) || 0) + amount);
    }

    tokens.forEach((token, i) => {
      add('w:' + token, 1);
      if (i > 0) add('b:' + tokens[i - 1] + ' ' + token, 1);
      if (!model.useCharacters) return;
      const padded = '^' + token + '$';
      for (const size of [3, 4]) {
        for (let start = 0; start + size <= padded.length; start += 1) {
          add('c:' + padded.slice(start, start + size), 0.35);
        }
      }
    });
    return counts;
  }

  function predict(text) {
    if (/^[^\S\r\n]*[^\s:][^\r\n]*:[^\S\r\n]*Обновления заказа успешно собраны\./im.test(text)) {
      return 'ЕПГУ';
    }

    const tokens = tokenize(text);
    if (tokens.length < 3) return '';

    if (!weights) {
      const decoded = atob(model.weights);
      weights = new Int8Array(decoded.length);
      for (let i = 0; i < decoded.length; i += 1) weights[i] = decoded.charCodeAt(i);
    }
    const logits = new Float64Array(model.categories.length);
    let squaredNorm = 0;
    for (const [index, count] of featureCounts(tokens)) {
      const value = Math.log1p(count);
      squaredNorm += value * value;
      for (let category = 0; category < logits.length; category += 1) {
        logits[category] += value * weights[category * featureCount + index];
      }
    }

    const norm = Math.sqrt(squaredNorm);
    let best = 0;
    for (let category = 0; category < logits.length; category += 1) {
      logits[category] = logits[category] * model.scale[category] / norm + model.intercept[category];
      if (logits[category] > logits[best]) best = category;
    }
    const confidence = 1 / logits.reduce((sum, logit) => sum + Math.exp(logit - logits[best]), 0);
    return confidence >= model.threshold ? model.categories[best] : '';
  }

  globalThis.predictItilCategory = (text) => {
    if (text !== previousText) {
      previousCategory = predict(text);
      previousText = text;
    }
    return previousCategory;
  };
})();
