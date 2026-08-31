import csv
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime
from decimal import Decimal, InvalidOperation
from difflib import SequenceMatcher
from pathlib import Path

import openpyxl
from charset_normalizer import from_bytes


def norm_text(value):
    if value is None:
        return ""
    value = str(value).upper().replace("Ё", "Е")
    return re.sub(r"[^0-9A-ZА-Я]+", "", value)


def norm_fio(value):
    if value is None:
        return ""
    value = str(value).upper().replace("Ё", "Е")
    return " ".join(re.findall(r"[A-ZА-Я]+", value))


def norm_date(value):
    if value is None or value == "":
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    text = str(value).strip()
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y", "%d.%m.%y"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return norm_text(text)


def money(value):
    if value is None or value == "":
        return None
    text = str(value).replace(" ", "").replace("\u00a0", "").replace(",", ".")
    try:
        return Decimal(text).quantize(Decimal("0.01"))
    except InvalidOperation:
        return None


def similarity(left, right):
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio() * 100


def amount_similarity(source, *targets):
    best = 0.0
    for target in targets:
        if source is None or target is None:
            continue
        diff = abs(source - target)
        if diff == 0:
            score = 100
        elif diff <= Decimal("0.10"):
            score = 98
        elif diff <= Decimal("1.00"):
            score = 95
        else:
            base = max(abs(source), abs(target), Decimal("1"))
            rel = diff / base
            if int(source) == int(target):
                score = 90
            elif rel <= Decimal("0.01"):
                score = 88
            elif rel <= Decimal("0.05"):
                score = 72
            elif rel <= Decimal("0.15"):
                score = 45
            else:
                score = max(0, 35 - float(rel * 35))
        best = max(best, float(score))
    return best


def main(xlsx_path, csv_path):
    ws = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True).active
    fssp = []
    for excel_row, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        fssp.append({
            "excel_row": excel_row,
            "fio": row[1], "dob": row[2], "id": row[3], "case": row[4],
            "amount": row[5], "start": row[6], "ip": row[7], "end": row[8],
            "article": row[9], "point": row[10], "subpoint": row[11], "result": row[18],
        })

    raw = Path(csv_path).read_bytes()
    decoded = str(from_bytes(raw).best())
    reader = csv.reader(decoded.splitlines(), delimiter=";")
    headers = next(reader)
    p = []
    for csv_row, row in enumerate(reader, start=2):
        if len(row) < len(headers):
            row += [""] * (len(headers) - len(row))
        p.append({
            "csv_row": csv_row,
            "fio": row[15], "dob": row[16], "case": row[9], "id": row[10],
            "amount_debt": row[19], "amount_enforcement": row[54], "filed": row[48],
            "start": row[60], "ip": row[62], "end": row[63],
            "article": row[64], "point": row[65], "subpoint": row[66],
            "stage": row[5], "status": row[6], "creditor": row[41],
        })

    fields = ("fio", "dob", "id", "case", "ip", "start", "end")
    indexes = {field: defaultdict(list) for field in fields}
    for i, row in enumerate(p):
        for field in fields:
            if field == "fio": key = norm_fio(row[field])
            elif field in ("dob", "start", "end"): key = norm_date(row[field])
            else: key = norm_text(row[field])
            if key:
                indexes[field][key].append(i)

    summaries = []
    for row in fssp:
        keys = {
            "fio": norm_fio(row["fio"]), "dob": norm_date(row["dob"]),
            "id": norm_text(row["id"]), "case": norm_text(row["case"]),
            "ip": norm_text(row["ip"]), "start": norm_date(row["start"]),
            "end": norm_date(row["end"]),
        }
        cand = set()
        for field, key in keys.items():
            if key:
                cand.update(indexes[field].get(key, []))
        scored = []
        fa = money(row["amount"])
        for i in cand:
            pr = p[i]
            exact = {
                "fio": bool(keys["fio"] and keys["fio"] == norm_fio(pr["fio"])),
                "dob": bool(keys["dob"] and keys["dob"] == norm_date(pr["dob"])),
                "id": bool(keys["id"] and keys["id"] in (norm_text(pr["id"]), norm_text(pr["case"]))),
                "case": bool(keys["case"] and keys["case"] in (norm_text(pr["case"]), norm_text(pr["id"]))),
                "ip": bool(keys["ip"] and keys["ip"] == norm_text(pr["ip"])),
                "start": bool(keys["start"] and keys["start"] == norm_date(pr["start"])),
                "end": bool(keys["end"] and keys["end"] == norm_date(pr["end"])),
            }
            pa_force = money(pr["amount_enforcement"])
            pa_debt = money(pr["amount_debt"])
            amount_force = fa is not None and pa_force is not None and fa == pa_force
            amount_debt = fa is not None and pa_debt is not None and fa == pa_debt
            score = (exact["ip"] * 100 + exact["id"] * 40 + exact["case"] * 35 +
                     exact["fio"] * 30 + exact["dob"] * 25 + exact["start"] * 20 +
                     exact["end"] * 10 + amount_force * 15 + amount_debt * 5)
            scored.append((score, i, exact, amount_force, amount_debt))
        scored.sort(reverse=True)
        best = scored[0] if scored else None
        summary = {"excel_row": row["excel_row"], "result": row["result"], "candidate_count": len(cand)}
        if best:
            score, i, exact, amount_force, amount_debt = best
            pr = p[i]
            summary.update({
                "best_csv_row": pr["csv_row"], "score": score, "exact": exact,
                "amount_force": amount_force, "amount_debt": amount_debt,
                "p_fio": pr["fio"], "p_dob": pr["dob"], "p_id": pr["id"], "p_case": pr["case"],
                "p_amount_force": pr["amount_enforcement"], "p_amount_debt": pr["amount_debt"],
                "p_start": pr["start"], "p_ip": pr["ip"], "p_end": pr["end"],
                "p_stage": pr["stage"], "p_status": pr["status"],
            })
        summaries.append(summary)

    by_result = {}
    for result in sorted(set(x["result"] for x in summaries)):
        group = [x for x in summaries if x["result"] == result]
        by_result[result] = {
            "rows": len(group),
            "with_candidate": sum(x["candidate_count"] > 0 for x in group),
            "best_ip": sum(x.get("exact", {}).get("ip", False) for x in group),
            "best_id_or_case": sum(x.get("exact", {}).get("id", False) or x.get("exact", {}).get("case", False) for x in group),
            "best_fio_dob": sum(x.get("exact", {}).get("fio", False) and x.get("exact", {}).get("dob", False) for x in group),
            "best_identity3": sum(sum(x.get("exact", {}).get(k, False) for k in ("fio", "dob", "id", "case")) >= 3 for x in group),
            "amount_force": sum(x.get("amount_force", False) for x in group),
        }

    notable = [x for x in summaries if x["result"] != "Найден" and (
        x.get("exact", {}).get("ip", False) or
        sum(x.get("exact", {}).get(k, False) for k in ("fio", "dob", "id", "case")) >= 3
    )]
    unresolved = [x for x in summaries if x["candidate_count"] == 0]
    found_amount_mismatch = []
    found_without_ip = []
    for frow, summary in zip(fssp, summaries):
        if frow["result"] != "Найден":
            continue
        ip_key = norm_text(frow["ip"])
        ip_candidates = indexes["ip"].get(ip_key, []) if ip_key else []
        if not ip_candidates:
            found_without_ip.append(summary)
            continue
        best_ip = None
        best_ip_score = -1
        for i in ip_candidates:
            pr = p[i]
            exact_identity = {
                "fio": norm_fio(frow["fio"]) == norm_fio(pr["fio"]),
                "dob": norm_date(frow["dob"]) == norm_date(pr["dob"]),
                "id": norm_text(frow["id"]) in (norm_text(pr["id"]), norm_text(pr["case"])),
                "case": norm_text(frow["case"]) in (norm_text(pr["case"]), norm_text(pr["id"])),
            }
            fa = money(frow["amount"])
            force = money(pr["amount_enforcement"])
            debt = money(pr["amount_debt"])
            id_score = sum(exact_identity.values())
            if id_score > best_ip_score:
                best_ip_score = id_score
                best_ip = {
                    "excel_row": frow["excel_row"], "fio": frow["fio"], "ip": frow["ip"],
                    "csv_row": pr["csv_row"], "exact_identity": exact_identity,
                    "fssp_amount": frow["amount"], "p_force": pr["amount_enforcement"],
                    "p_debt": pr["amount_debt"],
                    "force_diff": str(abs(fa - force)) if fa is not None and force is not None else None,
                    "debt_diff": str(abs(fa - debt)) if fa is not None and debt is not None else None,
                }
        if best_ip and best_ip["force_diff"] != "0.00":
            found_amount_mismatch.append(best_ip)

    not_found_identity_hints = [x for x in summaries if x["result"] == "Не найден" and (
        (x.get("exact", {}).get("fio", False) and x.get("exact", {}).get("dob", False)) or
        ((x.get("exact", {}).get("id", False) or x.get("exact", {}).get("case", False)) and
         (x.get("exact", {}).get("fio", False) or x.get("exact", {}).get("dob", False)))
    )]

    # Проверка «с нуля»: не используем уже занесённые дату возбуждения, номер ИП,
    # дату окончания и основание. Считаем только исходные идентификационные поля.
    clean_start_stats = {}
    clean_start_examples = []
    for result in sorted(set(row["result"] for row in fssp)):
        group = [row for row in fssp if row["result"] == result]
        counters = Counter()
        for row in group:
            fio_key = norm_fio(row["fio"])
            dob_key = norm_date(row["dob"])
            id_key = norm_text(row["id"])
            case_key = norm_text(row["case"])
            fa = money(row["amount"])
            base = set(indexes["fio"].get(fio_key, [])) & set(indexes["dob"].get(dob_key, []))
            exact_amount = []
            exact_doc = []
            for i in base:
                pr = p[i]
                amounts = (money(pr["amount_enforcement"]), money(pr["amount_debt"]))
                if fa is not None and fa in amounts:
                    exact_amount.append(i)
                if id_key in (norm_text(pr["id"]), norm_text(pr["case"])) or case_key in (norm_text(pr["case"]), norm_text(pr["id"])):
                    exact_doc.append(i)
            if base:
                counters["fio_dob"] += 1
            if exact_amount:
                counters["fio_dob_amount"] += 1
                if len(exact_amount) == 1:
                    counters["unique_fio_dob_amount"] += 1
            if exact_doc:
                counters["fio_dob_doc"] += 1
                if len(exact_doc) == 1:
                    counters["unique_fio_dob_doc"] += 1
            both = set(exact_amount) & set(exact_doc)
            if both:
                counters["all_identity_fields"] += 1
                if len(both) == 1:
                    counters["unique_all_identity_fields"] += 1
            if result != "Найден" and (exact_amount or exact_doc):
                candidates = sorted(set(exact_amount) | set(exact_doc))
                clean_start_examples.append({
                    "excel_row": row["excel_row"], "result": result, "fio": row["fio"],
                    "fssp_id": row["id"], "fssp_amount": row["amount"],
                    "base_count": len(base), "amount_count": len(exact_amount), "doc_count": len(exact_doc),
                    "candidates": [{
                        "csv_row": p[i]["csv_row"], "p_id": p[i]["id"], "p_case": p[i]["case"],
                        "p_force": p[i]["amount_enforcement"], "p_debt": p[i]["amount_debt"],
                        "stage": p[i]["stage"], "status": p[i]["status"],
                    } for i in candidates[:5]],
                })
        clean_start_stats[result] = {"rows": len(group), **dict(counters)}

    token_index = defaultdict(set)
    amount_ruble_index = defaultdict(set)
    doc_digits_index = defaultdict(set)
    for i, row in enumerate(p):
        for token in norm_fio(row["fio"]).split():
            if len(token) >= 4:
                token_index[token].add(i)
        for value in (money(row["amount_enforcement"]), money(row["amount_debt"])):
            if value is not None:
                amount_ruble_index[int(value)].add(i)
        for value in (row["id"], row["case"]):
            digits = re.sub(r"\D", "", str(value or ""))
            if len(digits) >= 5:
                doc_digits_index[digits].add(i)

    fuzzy_results = []
    for row in fssp:
        source_fio = norm_fio(row["fio"])
        source_dob = norm_date(row["dob"])
        source_docs = (norm_text(row["id"]), norm_text(row["case"]))
        source_amount = money(row["amount"])
        candidates = set(indexes["dob"].get(source_dob, []))
        for token in source_fio.split():
            if len(token) >= 4:
                candidates.update(token_index.get(token, set()))
        if source_amount is not None:
            for ruble in range(int(source_amount) - 1, int(source_amount) + 2):
                candidates.update(amount_ruble_index.get(ruble, set()))
        for value in (row["id"], row["case"]):
            digits = re.sub(r"\D", "", str(value or ""))
            if len(digits) >= 5:
                candidates.update(doc_digits_index.get(digits, set()))

        ranked = []
        for i in candidates:
            pr = p[i]
            fio_score = similarity(source_fio, norm_fio(pr["fio"]))
            dob_score = similarity(source_dob, norm_date(pr["dob"]))
            target_docs = (norm_text(pr["id"]), norm_text(pr["case"]))
            doc_score = max(similarity(a, b) for a in source_docs for b in target_docs if a and b)
            amt_score = amount_similarity(source_amount, money(pr["amount_enforcement"]), money(pr["amount_debt"]))
            total = fio_score * .35 + dob_score * .20 + doc_score * .25 + amt_score * .20
            ranked.append((total, i, fio_score, dob_score, doc_score, amt_score))
        ranked.sort(reverse=True)
        top = []
        for total, i, fio_score, dob_score, doc_score, amt_score in ranked[:3]:
            pr = p[i]
            top.append({
                "score": round(total, 1), "fio_score": round(fio_score, 1),
                "dob_score": round(dob_score, 1), "doc_score": round(doc_score, 1),
                "amount_score": round(amt_score, 1), "csv_row": pr["csv_row"],
                "fio": pr["fio"], "dob": pr["dob"], "id": pr["id"], "case": pr["case"],
                "force": pr["amount_enforcement"], "debt": pr["amount_debt"],
                "stage": pr["stage"], "status": pr["status"],
            })
        fuzzy_results.append({
            "excel_row": row["excel_row"], "result": row["result"], "source_fio": row["fio"],
            "source_dob": row["dob"], "source_id": row["id"], "source_amount": row["amount"],
            "candidate_count": len(candidates), "margin": round(top[0]["score"] - top[1]["score"], 1) if len(top) > 1 else None,
            "top": top,
        })

    fuzzy_distribution = {}
    for result in sorted(set(x["result"] for x in fuzzy_results)):
        group = [x for x in fuzzy_results if x["result"] == result]
        fuzzy_distribution[result] = {
            "rows": len(group),
            "top_95": sum(x["top"] and x["top"][0]["score"] >= 95 for x in group),
            "top_90": sum(x["top"] and x["top"][0]["score"] >= 90 for x in group),
            "top_80": sum(x["top"] and x["top"][0]["score"] >= 80 for x in group),
            "top_70": sum(x["top"] and x["top"][0]["score"] >= 70 for x in group),
            "margin_10": sum(x["margin"] is not None and x["margin"] >= 10 for x in group),
        }
    fuzzy_not_found = [x for x in fuzzy_results if x["result"] == "Не найден" and x["top"] and x["top"][0]["score"] >= 70]
    print(json.dumps({
        "by_result": by_result, "notable": notable, "unresolved": unresolved,
        "found_amount_mismatch": found_amount_mismatch,
        "found_without_ip": found_without_ip,
        "not_found_identity_hints": not_found_identity_hints,
        "clean_start_stats": clean_start_stats,
        "clean_start_examples": clean_start_examples,
        "fuzzy_distribution": fuzzy_distribution,
        "fuzzy_not_found": fuzzy_not_found,
    }, ensure_ascii=True, default=str))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
