import time
from machine import Pin, SoftI2C
from yolobit import *
import aiot_dht20 as dht20_lib
from aiot_dht20 import DHT20

i2c = SoftI2C(scl=Pin(22), sda=Pin(21))
found = i2c.scan()
print("I2C scan:", [hex(a) for a in found])
if 0x38 not in found:
    print("!! Khong thay DHT20 (0x38) — kiem tra lai cong I2C")

dht20_lib.i2c = i2c
d = DHT20(i2c)

for i in range(10):
    try:
        d.read_dht20()
        t = d.dht20_temperature()
        h = d.dht20_humidity()
    except Exception as e:
        t = h = None
        print("DHT20 loi:", repr(e))
    raw = pin0.read_analog()
    light = round(translate(raw, 0, 4095, 0, 100))
    print("t=%s C   h=%s %%   light_raw=%d -> %d" % (t, h, raw, light))
    time.sleep(2)