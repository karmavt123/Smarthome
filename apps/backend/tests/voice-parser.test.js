const { normalizeText, scoreDeviceName } = require('../src/services/voice-command.service');

describe('voice command text helpers', () => {
  test('normalizes Vietnamese diacritics', () => {
    expect(normalizeText('Bật đèn phòng khách!')).toBe('bat den phong khach');
  });

  test('prefers a device name mentioned in the command', () => {
    expect(scoreDeviceName('Living Room Light', 'turn on living room light')).toBeGreaterThan(
      scoreDeviceName('Kitchen Light', 'turn on living room light')
    );
  });
});
