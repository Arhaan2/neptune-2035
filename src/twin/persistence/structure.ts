import { failure, finiteNumber } from '../safety';
import { CONTRACT } from './limits';

export function record(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) failure('invalid-input', 'INVALID_OBJECT', `${field} must be a plain object.`, { field });
}
export function array(value: unknown, field: string, max: number): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length > max) failure('invalid-input', 'ARRAY_LIMIT', `${field} must be an array with at most ${max} entries.`, { field, details: { max } });
}
export function string(value: unknown, field: string, max: number = CONTRACT.maxStringLength): asserts value is string {
  if (typeof value !== 'string' || value.length > max) failure('invalid-input', 'STRING_LIMIT', `${field} must be a string of at most ${max} UTF-16 code units.`, { field, details: { max } });
}
export function keys(value: Record<string, unknown>, allowed: readonly string[], field: string) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) failure('invalid-input', 'UNKNOWN_FIELD', `Unknown ${field} field: ${key}`, { field: `${field}.${key}` });
}
export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes++;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { bytes += 4; i++; }
    else bytes += 3;
  }
  return bytes;
}
export function byteLimit(text: string) {
  if (text.length > CONTRACT.maxProjectBytes || utf8Bytes(text) > CONTRACT.maxProjectBytes) failure('invalid-input', 'PROJECT_BYTES', `Project exceeds ${CONTRACT.maxProjectBytes} UTF-8 bytes.`, { field: 'project', unit: 'byte', details: { max: CONTRACT.maxProjectBytes } });
}
/** Bounds nesting and duplicate keys before JSON.parse allocates the object tree. */
export function preflightJSON(text: string) {
  byteLimit(text);
  const stack: { object: boolean; key: boolean; keys: Set<string> }[] = [];
  let punctuation = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      const start = i, frame = stack.at(-1);
      for (i++; i < text.length; i++) { if (text[i] === '\\') i++; else if (text[i] === '"') break; }
      if (i - start > CONTRACT.maxStringLength * 6 + 1) failure('invalid-input', 'STRING_LIMIT', 'Encoded string exceeds the structural string limit.');
      if (frame?.object && frame.key) {
        const key: unknown = JSON.parse(text.slice(start, i + 1)); string(key, 'key');
        if (frame.keys.has(key)) failure('invalid-input', 'DUPLICATE_KEY', `Duplicate JSON key: ${key}`);
        frame.keys.add(key); frame.key = false;
      }
    } else if (c === '{' || c === '[') {
      stack.push({ object: c === '{', key: c === '{', keys: new Set() });
      if (stack.length > CONTRACT.maxDepth) failure('invalid-input', 'STRUCTURE_DEPTH', `Project nesting exceeds ${CONTRACT.maxDepth}.`);
    } else if (c === '}' || c === ']') stack.pop();
    else if (c === ',') { const frame = stack.at(-1); if (frame?.object) frame.key = true; }
    if (c === ',' || c === ':') if (++punctuation > CONTRACT.maxStructuralItems) failure('invalid-input', 'STRUCTURE_ITEMS', 'Project structure exceeds the allocation limit.');
  }
}
/** Counts values and object keys, rejects cycles, accessors and non-JSON data before stringify. */
export function validateStructure(value: unknown) {
  let items = 0;
  const ancestors = new Set<object>();
  const visit = (v: unknown, depth: number) => {
    if (++items > CONTRACT.maxStructuralItems) failure('invalid-input', 'STRUCTURE_ITEMS', `Project exceeds ${CONTRACT.maxStructuralItems} structural items.`);
    if (typeof v === 'number') { finiteNumber(v, 'serialized number'); return; }
    if (typeof v === 'string') { string(v, 'serialized string'); return; }
    if (v === null || typeof v === 'boolean') return;
    if (!v || typeof v !== 'object') failure('invalid-input', 'NON_JSON_VALUE', 'Project contains a non-JSON value.');
    if (depth > CONTRACT.maxDepth) failure('invalid-input', 'STRUCTURE_DEPTH', `Project nesting exceeds ${CONTRACT.maxDepth}.`);
    if (ancestors.has(v)) failure('invalid-input', 'CYCLIC_DATA', 'Project contains a cycle.');
    ancestors.add(v);
    if (Array.isArray(v)) {
      if (v.length + items > CONTRACT.maxStructuralItems) failure('invalid-input', 'STRUCTURE_ITEMS', 'Project structure exceeds the allocation limit.');
      if (Object.getPrototypeOf(v) !== Array.prototype) failure('invalid-input', 'UNSAFE_ARRAY', 'Project arrays must use the standard array prototype.');
      if (Reflect.ownKeys(v).length !== v.length + 1) failure('invalid-input', 'UNSAFE_ARRAY', 'Project arrays must be dense and have no extra own properties.');
      for (let i = 0; i < v.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(v, i);
        if (!descriptor || !('value' in descriptor)) failure('invalid-input', 'UNSAFE_ARRAY', 'Array accessors, sparse slots and custom serialization are unsupported.');
        visit(descriptor.value, depth + 1);
      }
    }
    else {
      record(v, 'project object');
      for (const key of Reflect.ownKeys(v)) {
        if (typeof key !== 'string') failure('invalid-input', 'UNSAFE_PROPERTY', 'Project symbol properties are unsupported.');
        const descriptor = Object.getOwnPropertyDescriptor(v, key)!;
        if (++items > CONTRACT.maxStructuralItems) failure('invalid-input', 'STRUCTURE_ITEMS', 'Project structure exceeds the allocation limit.');
        string(key, 'serialized key');
        if (['__proto__', 'prototype', 'constructor'].includes(key) || !('value' in descriptor) || !descriptor.enumerable) failure('invalid-input', 'UNSAFE_PROPERTY', `Unsupported project property: ${key}`);
        visit(descriptor.value, depth + 1);
      }
    }
    ancestors.delete(v);
  };
  visit(value, 1);
}
export function safeJSON(value: unknown): string {
  validateStructure(value);
  const text = JSON.stringify(value); byteLimit(text); return text;
}
/** Stable non-security identity: accidental mismatch detection, not authentication. */
export function identity(value: unknown): string {
  const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, canonical(x)])) : v;
  const text = JSON.stringify(canonical(value));
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619) >>> 0; b = (Math.imul(b, 33) ^ text.charCodeAt(i)) >>> 0; }
  return `neptune-${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}
