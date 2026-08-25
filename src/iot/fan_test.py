import time
from yolobit import *

FAN_SPEED = 20


def on_button_a_pressed():
    print("BUTTON A PRESSED, FAN SPEED:", FAN_SPEED)
    pin10.write_analog(round(translate(FAN_SPEED, 0, 100, 0, 1023)))
    display.scroll(str(FAN_SPEED))


def on_button_b_pressed():
    print("BUTTON B PRESSED, FAN STOP")
    pin10.write_analog(0)
    display.scroll("STOP")


button_a.on_pressed = on_button_a_pressed
button_b.on_pressed = on_button_b_pressed

while True:
    time.sleep_ms(100)
