import { expect, test } from 'vitest'
import { transformNumber } from './smsoutbound'

test('rejects an international number', () => {
  expect(transformNumber("+1900123456")).toBe(undefined)
});

test('rejects an international number with local dialling format', () => {
  expect(transformNumber("00116490012345")).toBe(undefined)
});

test('ignores non-digits', () => {
  expect(transformNumber("04-1234 5678")).toBe("61412345678")
});

test('accepts Australian mobiles in E.164 format', () => {
  expect(transformNumber("+61412345678")).toBe("61412345678")
});

test('rejects Australian landlines', () => {
  expect(transformNumber("+61312345678")).toBe(undefined)
});

test('rejects 04... numbers with wrong length', () => {
  expect(transformNumber("04123")).toBe(undefined)
});

test('rejects +614... numbers with wrong length', () => {
  expect(transformNumber("614123")).toBe(undefined)
});
