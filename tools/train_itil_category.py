"""Train and validate the browser model from a local CSV export of the Заявки sheet."""

import argparse
import base64
import csv
from datetime import datetime
import json
from pathlib import Path
import re

import numpy as np
from scipy.sparse import csr_matrix
from scipy.special import softmax
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import ComplementNB
from sklearn.preprocessing import normalize
from threadpoolctl import threadpool_limits


FEATURES = 32768


def words(text):
    text = text.lower().replace("ё", "е").replace("\r\n", "\n").replace("\r", "\n")
    messages = re.split(r"^[ \t]*[^\n()]+?[ \t]+\([0-9]{2}\.[0-9]{2}\.[0-9]{4}[ \t]+[0-9]{2}:[0-9]{2}:[0-9]{2}\):[ \t]*$", text, maxsplit=2, flags=re.M)
    if len(messages) > 1:
        text = messages[1]
    text = text.split("детальное описание:", 1)[-1]
    text = re.split(r"служебная информация|решение обращения\s*:|причина возникновения инцидента:|[-_]{4,}\s*original message", text, maxsplit=1)[0]
    text = re.sub(r"внимание!\s*это письмо получено от внешнего отправителя!|https?://\S+|[a-zа-я0-9_.+-]+@[a-zа-я0-9_.-]+", " ", text)
    return re.findall(r"[а-яa-z]+", text[:12000])[:1000]


def feature_keys(tokens, use_characters):
    yield from ("w:" + token for token in tokens)
    yield from ("b:" + a + " " + b for a, b in zip(tokens, tokens[1:]))
    if use_characters:
        for token in tokens:
            padded = "^" + token + "$"
            for size in (3, 4):
                yield from ("c:" + padded[i:i + size] for i in range(len(padded) - size + 1))


def bucket(key):
    value = 2166136261
    for char in key:
        value = ((value ^ ord(char)) * 16777619) & 0xffffffff
    return value % FEATURES


def matrix(texts, use_characters):
    pointers, indices, values = [0], [], []
    for tokens in texts:
        counts = {}
        for key in feature_keys(tokens, use_characters):
            index = bucket(key)
            counts[index] = counts.get(index, 0) + (0.35 if key.startswith("c:") else 1)
        indices.extend(counts)
        values.extend(np.log1p(list(counts.values())))
        pointers.append(len(indices))
    return normalize(csr_matrix((values, indices, pointers), shape=(len(texts), FEATURES)))


def duplicate_groups(texts):
    """Join exact and near matches before allocating any records to splits."""
    fingerprints = [" ".join(tokens) for tokens in texts]
    char_vectors = TfidfVectorizer(analyzer="char", ngram_range=(4, 4), dtype=np.float32).fit_transform(fingerprints)
    parents = list(range(len(texts)))

    def find(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    first = {}
    for i, fingerprint in enumerate(fingerprints):
        parents[i] = first.setdefault(fingerprint, i)
    for start in range(0, len(texts), 128):
        similarities = (char_vectors[start:start + 128] @ char_vectors.T).tocoo()
        for i, j in zip(similarities.row[similarities.data >= .94], similarities.col[similarities.data >= .94]):
            if j < start + i:
                parents[find(start + i)] = find(j)
    return np.array([find(i) for i in range(len(texts))])


def results(probabilities, labels, minimum=0):
    selected = probabilities.max(axis=1) >= minimum
    correct = probabilities.argmax(axis=1) == labels
    return int(correct[selected].sum()), int(selected.sum()), len(labels)


def threshold_for(probabilities, labels):
    """Pick the highest coverage with at least 95% precision and 35 observations."""
    for threshold in np.arange(0.55, 1.0, .01):
        correct, selected, _ = results(probabilities, labels, threshold)
        if selected >= 35 and correct / selected >= .95:
            return round(float(threshold), 2)
    return 1.01


def scores(model, matrix_part):
    return softmax(matrix_part @ model.coef_.T + model.intercept_, axis=1)


def quantize(model):
    scale = np.max(np.abs(model.coef_), axis=1) / 127
    weights = np.rint(model.coef_ / scale[:, None]).astype(np.int8)
    model.coef_ = weights * scale[:, None]
    return scale, weights


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    parser.add_argument("--model", type=Path)
    parser.add_argument("--audit", type=Path, help="Optional local JSON of validation disagreements")
    parser.add_argument("--verified-labels", type=Path, help="Optional independently confirmed labels keyed by ITIL ID")
    parser.add_argument("--evaluation-labels", type=Path, help="Optional blind labels for the final holdout, keyed by ITIL ID")
    args = parser.parse_args()
    with args.csv.open(encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))
    ids = [row["Номер ITIL"].strip() for row in rows]
    assert len(ids) == len(set(ids)) and all(ids)
    verified = json.loads(args.verified_labels.read_text(encoding="utf-8")) if args.verified_labels else {}
    assert verified.keys() <= set(ids)
    history = [row["Проблемы"].strip() for row in rows]
    categories = sorted(set(history) - {""})
    assert set(verified.values()) <= set(categories)
    category_indices = {category: i for i, category in enumerate(categories)}
    labels = np.array([category_indices.get(verified.get(identifier, original), -1)
                       for identifier, original in zip(ids, history)])
    dates = np.array([datetime.strptime(row["Дата заявки"].strip(), "%d.%m.%Y %H:%M:%S")
                      for row in rows], dtype="datetime64[s]")
    texts = [words(row["Текст заявки"]) for row in rows]
    groups = duplicate_groups(texts)
    assert len(groups) == len(labels) == len(rows)
    max_dates = dates.copy()
    np.maximum.at(max_dates, groups, dates)
    ordered = np.sort(dates)
    validation_from, test_from = ordered[[int(len(rows) * .65), int(len(rows) * .82)]]
    usable = (labels >= 0) & np.array([len(tokens) >= 3 for tokens in texts])
    train = np.flatnonzero(usable & (max_dates[groups] < validation_from))
    validation = np.flatnonzero(usable & (dates >= validation_from) & (max_dates[groups] < test_from))
    test = np.flatnonzero(usable & (dates >= test_from))
    if any(ids[index] in verified for index in test):
        raise ValueError("Use --evaluation-labels for holdout annotations")
    for a, b in ((train, validation), (train, test), (validation, test)):
        assert not (set(groups[a]) & set(groups[b]))
    group_labels = {}
    for index in train:
        group_labels.setdefault(groups[index], set()).add(labels[index])
    conflicts = {group for group, values in group_labels.items() if len(values) > 1}
    print(json.dumps(dict(rows=len(rows), labeled=int((labels >= 0).sum()), usable=int(usable.sum()),
                          groups=len(set(groups)), train=len(train), validation=len(validation), test=len(test),
                          validation_from=str(validation_from), test_from=str(test_from),
                          training_conflict_groups=len(conflicts))), flush=True)
    group_sizes = np.bincount(groups[train])
    sample_weight = 1 / np.sqrt(group_sizes[groups[train]])
    sample_weight[np.isin(groups[train], list(conflicts))] *= .5
    age_days = (validation_from - dates[train]) / np.timedelta64(1, "D")
    candidates = []
    for use_characters in (False, True):
        features = matrix(texts, use_characters)
        for regularization, recent in ((3, False), (12, False), (30, False), (6, True), (18, True)):
            model = LogisticRegression(C=regularization, max_iter=400)
            weights_by_age = .35 + .65 * np.exp(-age_days / 365) if recent else 1
            model.fit(features[train], labels[train], sample_weight=sample_weight * weights_by_age)
            assert np.array_equal(model.classes_, np.arange(len(categories)))
            scale, weights = quantize(model)
            probabilities = scores(model, features[validation])
            threshold = threshold_for(probabilities, labels[validation])
            quality = results(probabilities, labels[validation], threshold)
            print("logistic", use_characters, regularization, recent, results(probabilities, labels[validation]), threshold, quality, flush=True)
            candidates.append((quality[1], quality[0], model, features, use_characters, threshold, scale, weights))
        baseline = ComplementNB(alpha=.3).fit(features[train], labels[train], sample_weight=sample_weight)
        probabilities = baseline.predict_proba(features[validation])
        print("complement NB", use_characters, results(probabilities, labels[validation]),
              results(probabilities, labels[validation], threshold_for(probabilities, labels[validation])), flush=True)
        similarities = (features[validation] @ features[train].T).toarray()
        nearest = np.argsort(-similarities, axis=1)[:, :7]
        votes = np.eye(len(categories))[labels[train][nearest]] * np.take_along_axis(similarities, nearest, axis=1)[:, :, None] ** 4
        probabilities = votes.sum(axis=1)
        probabilities /= np.maximum(probabilities.sum(axis=1, keepdims=True), 1e-12)
        print("nearest neighbors", use_characters, results(probabilities, labels[validation]),
              results(probabilities, labels[validation], threshold_for(probabilities, labels[validation])), flush=True)
    _, _, model, features, use_characters, threshold, scale, weights = max(candidates, key=lambda entry: entry[:2])
    validation_probabilities = scores(model, features[validation])
    if args.audit:
        ranked = sorted(zip(validation, validation_probabilities), key=lambda entry: -entry[1].max())
        disagreements = [dict(id=ids[i], current=categories[labels[i]], predicted=categories[p.argmax()],
                              probability=float(p.max()), row=int(i + 2))
                         for i, p in ranked if p.argmax() != labels[i]]
        args.audit.write_text(json.dumps(disagreements, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.model:
        if threshold > 1:
            raise ValueError("No candidate met the validation precision target")
        test_probabilities = scores(model, features[test])
        print("test all", results(test_probabilities, labels[test]), flush=True)
        print("test highlighted", results(test_probabilities, labels[test], threshold), "threshold", threshold, flush=True)
        if args.evaluation_labels:
            independent = json.loads(args.evaluation_labels.read_text(encoding="utf-8"))
            positions = [position for position, index in enumerate(test) if ids[index] in independent]
            expected = [category_indices[independent[ids[test[position]]]] for position in positions]
            assert len(positions) == len(independent)
            print("blind review all", results(test_probabilities[positions], expected), flush=True)
            print("blind review highlighted", results(test_probabilities[positions], expected, threshold), flush=True)
        payload = dict(categories=categories, useCharacters=use_characters, threshold=threshold,
                       intercept=model.intercept_.tolist(), scale=scale.tolist(),
                       weights=base64.b64encode(weights.tobytes()).decode("ascii"))
        args.model.write_text("// Сгенерировано tools/train_itil_category.py.\n"
                              "globalThis.itilCategoryModel = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
                              encoding="utf-8", newline="")


if __name__ == "__main__":
    with threadpool_limits(limits=2):
        main()
