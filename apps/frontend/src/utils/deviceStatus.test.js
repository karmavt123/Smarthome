import { describe, test, expect } from 'vitest';
import {
  isDeviceOn,
  getNextAction,
  getStatusLabel,
  CONTROLLABLE_TYPES,
} from './deviceStatus';

// Vi sao test o day thay vi o App.test.js: xem dau file App.test.js.
//
// deviceStatus.js la logic thuan, khong DOM, khong mang, khong state — nhung lai la thu ma
// Dashboard, the thiet bi, the khoa cua va man hinh An ninh deu dua vao. Diem de vo nhat la
// su BAT DOI XUNG giua cua va cac thiet bi khac: cua dung open/close, con den/quat dung
// on/off. Lan nao co nguoi "don dep" cho nay lai la mot lan cua co the im lang hien sai
// trang thai — va trang thai cua chinh la thu frontend dung de quyet dinh co bat buoc xac
// thuc PIN/Face khi mo cua bang giong noi hay khong.
describe('isDeviceOn', () => {
  const light = (status) => ({ deviceType: 'light', status, connectionStatus: 'online' });
  const door = (status) => ({ deviceType: 'door', status, connectionStatus: 'online' });

  test('cua doc open/closed, thiet bi khac doc on/off', () => {
    expect(isDeviceOn(light('on'))).toBe(true);
    expect(isDeviceOn(light('off'))).toBe(false);
    expect(isDeviceOn(door('open'))).toBe(true);
    expect(isDeviceOn(door('closed'))).toBe(false);
  });

  test('khong duoc lan tu vung trang thai giua hai loai', () => {
    // Mot canh cua co status 'on' khong phai la cua dang mo.
    expect(isDeviceOn(door('on'))).toBe(false);
    // Va mot bong den co status 'open' khong phai la den dang bat.
    expect(isDeviceOn(light('open'))).toBe(false);
  });

  test('optimisticAction thang trang thai that', () => {
    expect(isDeviceOn(light('off'), 'turn_on')).toBe(true);
    expect(isDeviceOn(light('on'), 'turn_off')).toBe(false);
    expect(isDeviceOn(door('closed'), 'open')).toBe(true);
    expect(isDeviceOn(door('open'), 'close')).toBe(false);
  });
});

describe('getNextAction', () => {
  const light = (status) => ({ deviceType: 'light', status, connectionStatus: 'online' });
  const door = (status) => ({ deviceType: 'door', status, connectionStatus: 'online' });

  test('dao trang thai, dung bo hanh dong cua tung loai', () => {
    expect(getNextAction(light('off'))).toBe('turn_on');
    expect(getNextAction(light('on'))).toBe('turn_off');
    expect(getNextAction(door('closed'))).toBe('open');
    expect(getNextAction(door('open'))).toBe('close');
  });

  test('bam theo optimisticAction chu khong theo status', () => {
    expect(getNextAction(light('off'), 'turn_on')).toBe('turn_off');
    expect(getNextAction(door('closed'), 'open')).toBe('close');
  });
});

describe('getStatusLabel', () => {
  const light = (status) => ({ deviceType: 'light', status, connectionStatus: 'online' });
  const door = (status) => ({ deviceType: 'door', status, connectionStatus: 'online' });

  test('mat ket noi duoc uu tien hon bat/tat', () => {
    expect(
      getStatusLabel({ deviceType: 'light', status: 'on', connectionStatus: 'offline' })
    ).toBe('Mất kết nối');
  });

  test('nhung khi dang co lenh cho thi van hien trang thai lac quan', () => {
    expect(
      getStatusLabel({ deviceType: 'light', status: 'off', connectionStatus: 'offline' }, 'turn_on')
    ).toBe('Đang bật');
  });

  test('cam bien khong co bat/tat de hien', () => {
    expect(
      getStatusLabel({ deviceType: 'sensor', status: 'on', connectionStatus: 'online' })
    ).toBe('Đang gửi dữ liệu');
  });

  test('nhan doc theo dung loai thiet bi', () => {
    expect(getStatusLabel(light('on'))).toBe('Đang bật');
    expect(getStatusLabel(light('off'))).toBe('Đang tắt');
    expect(getStatusLabel(door('open'))).toBe('Đang mở');
    expect(getStatusLabel(door('closed'))).toBe('Đã đóng');
  });
});

describe('CONTROLLABLE_TYPES', () => {
  test('cam bien khong nam trong nhom dieu khien duoc', () => {
    expect(CONTROLLABLE_TYPES).toEqual(['light', 'fan', 'door']);
    expect(CONTROLLABLE_TYPES.includes('sensor')).toBe(false);
  });
});
