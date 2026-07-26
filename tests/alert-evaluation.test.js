const { compareValue } = require('../src/services/alert-evaluation.service');

describe('alert comparisons', () => {
  test.each([
    [31, 'gt', 30, true],
    [30, 'gt', 30, false],
    [29, '<', 30, true],
    [30, 'gte', 30, true],
    [30, '<=', 30, true],
    [30, 'eq', 30, true],
  ])('%s %s %s is %s', (value, operator, threshold, expected) => {
    expect(compareValue(value, operator, threshold)).toBe(expected);
  });
});
