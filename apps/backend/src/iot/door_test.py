import time
from yolobit import *

DOOR_PIN = pin6


def on_button_a_pressed():
    print("BUTTON A PRESSED, SERVO OPEN")
    DOOR_PIN.servo_write(90)
    time.sleep_ms(2000)
    DOOR_PIN.servo_write(0)
    DOOR_PIN.servo_release()
    print("SERVO DONE")


button_a.on_pressed = on_button_a_pressed

while True:
    time.sleep_ms(100)
