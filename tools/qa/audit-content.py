#!/usr/bin/env python3
"""Read-only, dependency-free content audit. Unsupported mathematics is NOT verified."""
from pathlib import Path
from fractions import Fraction
import ast
import collections
import hashlib
import json
import math
import re

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'audit'
MATH = re.compile(r'\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$')

def strip_math(s):
    return re.sub(r'\\[()[\]]|\$\$', '', s).strip()

def tex_number(source):
    """A deliberately small grammar: numeric arithmetic, fractions and square roots.
    Never evals source, imports, attributes, names, or arbitrary Python calls.
    """
    source = strip_math(source).replace('{,}', '')
    source = re.sub(r'(?<=\d),(?=\d{3}(?:\D|$))', '', source)
    source = source.replace('\\left', '').replace('\\right', '')
    source = re.sub(r'\\(?:times|cdot)', '*', source).replace('\\div', '/')
    def argument(s, pos):
        while pos < len(s) and s[pos].isspace(): pos += 1
        if pos >= len(s): raise ValueError('missing argument')
        if s[pos] != '{': return s[pos], pos + 1
        start = pos + 1
        depth = 1
        pos += 1
        while pos < len(s) and depth:
            if s[pos] == '{': depth += 1
            if s[pos] == '}': depth -= 1
            pos += 1
        if depth: raise ValueError('unbalanced braces')
        return s[start:pos - 1], pos
    def expand(s):
        out = ''; pos = 0
        while pos < len(s):
            m = re.match(r'\\(frac|dfrac|tfrac|sqrt)\b', s[pos:])
            # TeX commands immediately followed by digits have no word boundary.
            if not m: m = re.match(r'\\(frac|dfrac|tfrac|sqrt)(?=[{\d ])', s[pos:])
            if m:
                command = m[1]; a, end = argument(s, pos + len(m[0]))
                if command == 'sqrt': out += 'sqrt(' + expand(a) + ')'; pos = end
                else:
                    b, end = argument(s, end)
                    fraction = '((' + expand(a) + ')/(' + expand(b) + '))'
                    mixed = re.search(r'(\d+)\s*$', out)
                    if mixed: out = out[:mixed.start()] + '(' + mixed[1] + '+' + fraction + ')'
                    else: out += fraction
                    pos = end
            else: out += s[pos]; pos += 1
        return out
    s = expand(source).replace('^', '**').replace('{', '(').replace('}', ')').replace('\\%', '/100').replace('%', '/100').strip()
    s = re.sub(r'(\d|\))(?=sqrt\()', r'\1*', s)
    s = re.sub(r'(\d|\))(?=\()', r'\1*', s)
    s = re.sub(r'\)(?=\d)', ')*', s)
    if not re.fullmatch(r'[0-9.\s+*/()\-sqrt]+', s): raise ValueError('unsupported expression')
    def visit(n):
        if isinstance(n, ast.Expression): return visit(n.body)
        if isinstance(n, ast.Constant) and type(n.value) in (int, float): return Fraction(str(n.value))
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.UAdd, ast.USub)):
            return visit(n.operand) * (-1 if isinstance(n.op, ast.USub) else 1)
        if isinstance(n, ast.BinOp):
            a, b = visit(n.left), visit(n.right)
            if isinstance(n.op, ast.Add): return a + b
            if isinstance(n.op, ast.Sub): return a - b
            if isinstance(n.op, ast.Mult): return a * b
            if isinstance(n.op, ast.Div): return a / b
            if isinstance(n.op, ast.Pow) and abs(b) <= 100: return a ** b
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == 'sqrt' and len(n.args) == 1 and not n.keywords:
            return math.sqrt(visit(n.args[0]))
        raise ValueError('unsupported AST')
    return visit(ast.parse(s, mode='eval'))

def number_or_none(s):
    try: return tex_number(s)
    except (ValueError, SyntaxError, ZeroDivisionError, OverflowError, TypeError): return None

def equal(a, b): return math.isclose(float(a), float(b), rel_tol=1e-10, abs_tol=1e-10)

manifest = json.loads((ROOT / 'master-manifest.json').read_text())
entries = []
def walk(nodes, trail=()):
    for n in nodes or []:
        entries.extend((e, trail + (n.get('name', n['id']),)) for e in n.get('practice_files', []))
        walk(n.get('topics'), trail + (n.get('name', n['id']),))
        walk(n.get('subtopics'), trail + (n.get('name', n['id']),))
walk(manifest['subjects'])
errors, numeric, arithmetic_claims, claim_candidates, option_candidates = [], [], [], [], []
question_ids, dupe_content, coverage = {}, collections.defaultdict(list), []
pending, present, visual_count = [], 0, 0
option_counts = collections.Counter()
schema = json.loads((ROOT / 'schemas/question-bank.schema.json').read_text())
for entry, trail in entries:
    file = ROOT / entry['path']
    if not file.is_file(): pending.append(entry['id']); continue
    present += 1
    bank = json.loads(file.read_text())
    for required in schema['required']:
        if required not in bank: errors.append({'file': entry['path'], 'error': 'Missing bank field ' + required})
    for key, spec in schema['properties'].items():
        value = bank.get(key)
        typ = spec.get('type')
        if (typ == 'string' and not isinstance(value, str)) or (typ == 'integer' and type(value) != int) or (typ == 'array' and not isinstance(value, list)):
            errors.append({'file': entry['path'], 'error': 'Invalid schema type for ' + key})
        if 'minimum' in spec and value < spec['minimum']: errors.append({'file': entry['path'], 'error': 'Schema minimum for ' + key})
    if bank['questionCount'] != len(bank['questions']) or entry['questionCount'] != len(bank['questions']):
        errors.append({'file': entry['path'], 'error': 'Count mismatch'})
    if bank['schemaVersion'] != '1.0' or bank['type'] != 'mcq': errors.append({'file': entry['path'], 'error': 'Bank schema constants'})
    for q in bank['questions']:
        where = {'file': entry['path'], 'id': q['id']}
        if q['id'] in question_ids: errors.append({**where, 'error': 'Global duplicate question ID', 'first': question_ids[q['id']]})
        question_ids[q['id']] = entry['path']
        for key in ['id', 'question', 'answer', 'hint', 'explanation']:
            if not isinstance(q.get(key), str) or not q[key].strip(): errors.append({**where, 'error': 'Missing/non-string text ' + key})
        opts = q.get('options', [])
        option_counts[len(opts)] += 1
        if not isinstance(opts, list) or len(opts) < 2: errors.append({**where, 'error': 'Insufficient options'})
        labels = [o.get('label') for o in opts]
        if len(set(labels)) != len(labels): errors.append({**where, 'error': 'Duplicate option label'})
        if labels.count(q.get('answer')) != 1: errors.append({**where, 'error': 'Answer does not identify exactly one label'})
        texts = [re.sub(r'\s+', ' ', o.get('text', '')).strip() for o in opts]
        if not all(texts) or len(set(texts)) != len(texts): errors.append({**where, 'error': 'Empty/identical option text'})
        values = [number_or_none(o['text']) for o in opts]
        if all(v is not None for v in values):
            for i in range(len(values)):
                for j in range(i + 1, len(values)):
                    if equal(values[i], values[j]): option_candidates.append({**where, 'signal': 'Numerically equivalent options', 'labels': [labels[i], labels[j]]})
        if q.get('visual'): visual_count += 1
        key = json.dumps([re.sub(r'\s+', ' ', q['question']).strip(), opts, q['answer']], sort_keys=True)
        dupe_content[key].append({**where, 'bank': entry['id'], 'bankName': entry['name'], 'trail': list(trail)})
        # Exact prompt templates only; symbolic or ambiguous parses stay unverified.
        prompt = strip_math(q['question'])
        expected, rule = None, None
        m = re.fullmatch(r'(?:What is|Evaluate|Compute|Simplify|Calculate|Find the value of):?\s+(.+?)[.?]?', prompt, re.I | re.S)
        if m:
            expected = number_or_none(m[1])
            if expected is not None: rule = 'numeric-arithmetic-expression'
        m = re.fullmatch(r'(\d+(?:\.\d+)?) is (\d+(?:\.\d+)?)% of what number\?', prompt)
        if m: expected = Fraction(m[1]) * 100 / Fraction(m[2]); rule = 'reverse-percentage'
        m = re.fullmatch(r'A population starts at (\d+) and grows by (\d+)% each year\. What is the population after (\d+) years \(rounded to the nearest whole number\)\?', prompt)
        if m: expected = round(int(m[1]) * (1 + Fraction(m[2]) / 100) ** int(m[3])); rule = 'compound-growth'
        # Explicitly supplied truth values; do not infer real-world proposition truth.
        if 'What is the truth value of "P AND Q"?' in prompt or 'What is the truth value of "P OR Q"?' in prompt:
            truth = re.findall(r'\((true|false)\)', prompt)
            if len(truth) == 2:
                a, b = [x == 'true' for x in truth]
                value = (a and b) if 'P AND Q' in prompt else (a or b)
                expected = str(value); rule = 'supplied-boolean-values'
        m = re.search(r' is (true|false)\. What is the truth value of its negation \(NOT the statement\)\?', prompt)
        if m: expected = str(m[1] == 'false'); rule = 'supplied-negation'
        if expected is not None:
            matches = []
            for o, v in zip(opts, values):
                if isinstance(expected, str): good = o['text'].strip().lower() == expected.lower()
                else: good = v is not None and equal(v, expected)
                if good: matches.append(o['label'])
            # A fully supported prompt with fully supported choices must also
            # fail when no choice matches. Unsupported choice notation remains
            # outside this deliberately limited solver's proof coverage.
            if matches or isinstance(expected, str) or all(v is not None for v in values):
                row = {**where, 'rule': rule, 'derived': str(expected), 'matchingLabels': matches, 'key': q['answer'],
                       'status': 'PASS' if matches == [q['answer']] else 'REVIEW_FORM' if q['answer'] in matches else 'FAIL'}
                numeric.append(row)
                if row['status'] == 'FAIL': errors.append({**row, 'error': 'Independent answer derivation mismatch'})
        # Check exact numeric equality claims, not option distractors. Rounded
        # assertions are REVIEW candidates, never silently auto-revised.
        for segment in MATH.finditer(q.get('explanation', '')):
            tex = next(x for x in segment.groups() if x is not None)
            parts = tex.split('=')
            if len(parts) < 2: continue
            vals = [number_or_none(x) for x in parts]
            if not all(v is not None for v in vals): continue
            row = {**where, 'tex': tex, 'status': 'PASS' if all(equal(vals[0], v) for v in vals[1:]) else 'REVIEW'}
            arithmetic_claims.append(row)
            if row['status'] == 'REVIEW': claim_candidates.append(row)
        coverage.append({**where, 'structural': 'checked', 'semanticSolver': rule if any(r['id'] == q['id'] for r in numeric[-1:]) else 'NOT_PROVEN'})

duplicates = [{'question': json.loads(k), 'occurrences': v} for k, v in dupe_content.items() if len(v) > 1]
source_json = sorted(p for p in ROOT.rglob('*.json') if not any(x in p.parts for x in ['node_modules', 'test-results', 'audit']))
json_fail = []
for p in source_json:
    try: json.loads(p.read_text())
    except Exception as e: json_fail.append({'file': str(p.relative_to(ROOT)), 'error': str(e)})
summary = {'projectJsonFiles': len(source_json), 'jsonSyntaxErrors': json_fail, 'listedBanks': len(entries), 'shippedBanks': present,
           'pendingBanks': len(pending), 'questionsChecked': len(coverage), 'optionCounts': dict(option_counts),
           'visuals': visual_count, 'errors': errors, 'independentlySolvedQuestions': len(numeric),
           'exactNumericClaimsChecked': len(arithmetic_claims), 'numericClaimReviewCandidates': claim_candidates,
           'crossBankDuplicateGroups': len(duplicates), 'duplicateExtraOccurrences': sum(len(d['occurrences']) - 1 for d in duplicates),
           'numericOptionReviewCandidates': option_candidates,
           'pendingIds': pending, 'status': 'FAIL' if errors or json_fail else 'PASS_WITH_SEMANTIC_REVIEW_SIGNALS' if option_candidates or claim_candidates else 'PASS',
           'limitation': 'All questions checked structurally; only eligible arithmetic/boolean templates solved independently. Unsupported semantics are NOT_PROVEN, not PASS.'}
OUT.mkdir(exist_ok=True)
for name, data in [('CONTENT_AUDIT.json', summary), ('QUESTION_COVERAGE.json', coverage), ('NUMERIC_SOLVER_RESULTS.json', numeric),
                   ('NUMERIC_CLAIM_RESULTS.json', arithmetic_claims), ('DUPLICATE_REVIEW_DATA.json', duplicates)]:
    (OUT / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ['pendingIds', 'errors', 'numericClaimReviewCandidates', 'numericOptionReviewCandidates']}, ensure_ascii=False))
print('Errors:', len(errors), 'Numeric claim candidates:', len(claim_candidates))
for issue in (errors + claim_candidates)[:30]: print(json.dumps(issue, ensure_ascii=False))
raise SystemExit(1 if errors or json_fail else 0)
