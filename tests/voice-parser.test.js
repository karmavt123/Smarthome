const {
  normalizeText,
  parseVoiceIntent,
  scoreDeviceName,
} = require('../src/services/voice-command.service');

describe('voice command parsing', () => {
  test('normalizes Vietnamese diacritics', () => {
    expect(normalizeText('Bật đèn phòng khách!')).toBe('bat den phong khach');
  });

  test.each([
    ['bat den phong khach', 'light', 'turn_on'],
    ['tắt quạt', 'fan', 'turn_off'],
    ['mở cửa', 'door', 'open'],
    ['khoa cua', 'door', 'close'],
    ['turn on light', 'light', 'turn_on'],
  ])('parses %s', (text, deviceType, action) => {
    expect(parseVoiceIntent(text)).toMatchObject({ deviceType, action });
  });

  test('rejects unsupported speech', () => {
    expect(parseVoiceIntent('hom nay troi dep')).toBeNull();
  });

  test('prefers a device name mentioned in the command', () => {
    expect(scoreDeviceName('Living Room Light', 'turn on living room light')).toBeGreaterThan(
      scoreDeviceName('Kitchen Light', 'turn on living room light')
    );
  });
});
