import network
import time
from yolobit import *
from aiot_lcd1602 import LCD1602

AP_SSID = "Lumina-Home-Setup"

lcd = LCD1602()
lcd.clear()


def lcd_show(text):
    lcd.clear()
    lcd.move_to(0, 0)
    lcd.putstr(text)


ap = network.WLAN(network.AP_IF)
ap.active(True)
ap.config(essid=AP_SSID, authmode=network.AUTH_OPEN)

print("AP STARTED:", AP_SSID)
print("AP CONFIG:", ap.ifconfig())
lcd_show("AP READY")

while True:
    time.sleep_ms(1000)
