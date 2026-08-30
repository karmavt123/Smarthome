import network
import time
from yolobit import *
from umqtt.simple import MQTTClient
from aiot_rgbled import RGBLed
from aiot_dht20 import DHT20
from aiot_lcd1602 import LCD1602
from machine import Pin, SoftI2C
import aiot_dht20 as dht20_lib
from iot_config import WIFI_SSID, WIFI_PASSWORD, AIO_USERNAME, AIO_KEY

device_name = "YoloBit-A82F"

LIGHT_DEVICE_CODE = f"{device_name}-light"
FAN_DEVICE_CODE = f"{device_name}-fan"
DOOR_DEVICE_CODE = f"{device_name}-door"
TEMP_HUMIDITY_DEVICE_CODE = f"{device_name}-temperature-humidity-sensor"
LIGHT_SENSOR_DEVICE_CODE = f"{device_name}-light-sensor"

# Adafruit IO feed key luôn lowercase — publish/subscribe topic phải khớp đúng key
# này (không phải case gốc của device_code), nếu không Adafruit echo lệnh ra topic
# khác, board không bao giờ nhận được. Node side (mqtt.service.js) cũng lowercase
# device_code khi build topic, phải khớp đúng ở đây.
COMMAND_FEED = f"{AIO_USERNAME}/feeds/{LIGHT_DEVICE_CODE.lower()}-command"
STATE_FEED = f"{AIO_USERNAME}/feeds/{LIGHT_DEVICE_CODE.lower()}-state"

FAN_COMMAND_FEED = f"{AIO_USERNAME}/feeds/{FAN_DEVICE_CODE.lower()}-command"
FAN_STATE_FEED = f"{AIO_USERNAME}/feeds/{FAN_DEVICE_CODE.lower()}-state"

DOOR_COMMAND_FEED = f"{AIO_USERNAME}/feeds/{DOOR_DEVICE_CODE.lower()}-command"
DOOR_STATE_FEED = f"{AIO_USERNAME}/feeds/{DOOR_DEVICE_CODE.lower()}-state"

TEMPERATURE_FEED = f"{AIO_USERNAME}/feeds/{TEMP_HUMIDITY_DEVICE_CODE.lower()}-temperature"
HUMIDITY_FEED = f"{AIO_USERNAME}/feeds/{TEMP_HUMIDITY_DEVICE_CODE.lower()}-humidity"
LIGHT_LEVEL_FEED = f"{AIO_USERNAME}/feeds/{LIGHT_SENSOR_DEVICE_CODE.lower()}-light"

# RGB LED ở pin14, có 4 LED
tiny_rgb = RGBLed(pin14.pin, 4)

# Quạt DC điều khiển tốc độ bằng PWM ở pin10 (analog write 0-1023)
FAN_PIN = pin10

# Servo 180° ở pin6 điều khiển khoá cửa — quay tới góc rồi release() ngay
# (không giữ xung PWM liên tục), tránh servo nóng/rung khi không cần giữ lực.
DOOR_PIN = pin6
DOOR_OPEN_ANGLE = 90
DOOR_CLOSED_ANGLE = 180
# Thời gian chờ servo quay hết góc trước khi release — servo 180 thường mất
# ~100-200ms cho mỗi ~60°, 400ms đủ dư cho một lần quay 0<->90.
DOOR_MOVE_MS = 400

# Cảm biến nhiệt độ/độ ẩm DHT20 — chung bus I2C với LCD ở cổng Grove
# (SCL 22, SDA 21, lấy từ aiot_lcd1602.py). DHT20 ở 0x38, LCD ở 0x21.
i2c = SoftI2C(scl=Pin(22), sda=Pin(21))

# dht20_init() trong thư viện hãng dùng biến `i2c` TRAN (thiếu `self.`), nên nếu
# nhánh đó chạy thì nổ NameError. Gán sẵn vào namespace của module để phòng.
dht20_lib.i2c = i2c

aiot_dht20 = DHT20(i2c)

# Cảm biến ánh sáng — quang trở analog ở pin0, đọc raw 0-4095 rồi quy về 0-100
LIGHT_SENSOR_PIN = pin0

# LCD hiển thị trạng thái thay cho display.scroll() (màn LED 5x5 onboard) —
# dễ quan sát/debug hơn khi board không cắm máy tính xem Serial.
try:
    lcd = LCD1602()
    lcd.clear()
except Exception as e:
    print("LCD 1602 khong tim thay, bo qua:", repr(e))
    lcd = None

# Gửi cảm biến mỗi 60s (1 phút) — vòng loop chính sleep 0.5s/lần, nên cứ 120 lần
# lặp thì đọc+publish 1 lần. Xem SENSOR_READ_EVERY_LOOPS bên dưới trong main().
SENSOR_READ_EVERY_LOOPS = 40

# Nhớ màu vừa set gần nhất, để "ON" bật lại đúng màu đó thay vì luôn trắng.
# Mặc định trắng khi board vừa khởi động, chưa có lệnh set_color nào.
last_color = "#fff"

# Nhớ tốc độ quạt vừa set gần nhất, để "ON" chạy lại đúng tốc độ đó.
# Mặc định 100 (full tốc) khi board vừa khởi động, chưa có lệnh set_speed nào.
last_fan_speed = 100


def lcd_show(text):
    print("LCD:", text)          # luon in ra Serial de con thay khi khong co LCD
    if lcd is None:
        return
    lcd.clear()
    lcd.move_to(0, 0)
    lcd.putstr(text)


def lcd_line(row, text):
    padded = text
    if len(padded) < 16:
        padded = padded + (" " * (16 - len(padded)))
    print("LCD[%d]: %s" % (row, text))
    if lcd is None:
        return
    lcd.move_to(0, row)
    lcd.putstr(padded)


def connect_wifi(timeout_s=20):
    wifi = network.WLAN(network.STA_IF)
    wifi.active(True)

    if not wifi.isconnected():
        lcd_show("WIFI")
        print("Dang ket noi WiFi:", WIFI_SSID)
        wifi.connect(WIFI_SSID, WIFI_PASSWORD)

        # Co timeout + in status: vong cho vo han khong bao gi la kieu loi
        # kho chan doan nhat — board dung im, khong ai biet vi sao.
        deadline = time.ticks_add(time.ticks_ms(), timeout_s * 1000)
        while not wifi.isconnected():
            if time.ticks_diff(deadline, time.ticks_ms()) <= 0:
                status = wifi.status()
                print("WIFI THAT BAI, status =", status)
                lcd_show("WIFI FAIL")
                raise Exception("Khong vao duoc WiFi '%s' (status %s)" % (WIFI_SSID, status))
            time.sleep(0.5)

    print("WIFI CONNECTED:", wifi.ifconfig())
    lcd_show("WIFI OK")


def set_light_color(hex_color):
    print("SET LIGHT COLOR:", hex_color)

    rgb = hex_to_rgb(hex_color)
    tiny_rgb.show(0, rgb)
    tiny_rgb.show(1, rgb)
    tiny_rgb.show(2, rgb)
    tiny_rgb.show(3, rgb)


def set_light_on():
    global last_color
    set_light_color(last_color)
    lcd_show("ON")


def set_light_off():
    set_light_color("#000000")
    lcd_show("OFF")


def set_fan_speed(speed):
    speed = max(0, min(100, int(speed)))
    print("SET FAN SPEED:", speed)
    FAN_PIN.write_analog(round(translate(speed, 0, 100, 0, 1023)))


def set_fan_on():
    global last_fan_speed
    set_fan_speed(last_fan_speed)
    lcd_show("FAN ON")


def set_fan_off():
    set_fan_speed(0)
    lcd_show("FAN OFF")


def set_door_open():
    print("DOOR OPEN")
    DOOR_PIN.servo_write(DOOR_OPEN_ANGLE)
    time.sleep_ms(DOOR_MOVE_MS)
    DOOR_PIN.servo_release()
    lcd_show("DOOR OPEN")


def set_door_close():
    print("DOOR CLOSE")
    DOOR_PIN.servo_write(DOOR_CLOSED_ANGLE)
    time.sleep_ms(DOOR_MOVE_MS)
    DOOR_PIN.servo_release()
    lcd_show("DOOR CLOSED")


def on_door_message(raw, payload):
    # Hiện payload lên LCD NGAY khi vào đây, trước khi đụng servo — để biết chắc
    # board có nhận được message hay không, tách bạch với việc servo có quay hay
    # không (2 lỗi khác nhau, dòng này debug lỗi "có nhận được không").
    lcd_show("RX DOOR:" + payload)

    if payload == "OPEN":
        set_door_open()

    elif payload == "CLOSE":
        set_door_close()

    else:
        print("UNKNOWN DOOR COMMAND:", payload)
        return None

    return raw


def on_light_message(raw, payload):
    global last_color

    if payload == "ON":
        set_light_on()

    elif payload == "OFF":
        set_light_off()

    elif payload.startswith("#") and len(payload) in (4, 7):
        last_color = raw
        set_light_color(raw)

    else:
        print("UNKNOWN LIGHT COMMAND:", payload)
        return None

    return raw


def on_fan_message(raw, payload):
    global last_fan_speed

    if payload == "ON":
        set_fan_on()

    elif payload == "OFF":
        set_fan_off()

    elif payload.isdigit():
        last_fan_speed = int(payload)
        set_fan_speed(last_fan_speed)

    else:
        print("UNKNOWN FAN COMMAND:", payload)
        return None

    return raw


def read_and_publish_sensor():
    # Đọc cảm biến trước, LẤY giá trị sau — đọc trước rồi lấy giá trị mới bị trễ
    # 1 nhịp so với lần đọc thật (giá trị cache của lần trước).
    aiot_dht20.read_dht20()
    temperature = aiot_dht20.dht20_temperature()
    humidity = aiot_dht20.dht20_humidity()
    light_level = round(translate(LIGHT_SENSOR_PIN.read_analog(), 0, 4095, 0, 100))

    print("TEMPERATURE:", temperature, "HUMIDITY:", humidity, "LIGHT:", light_level)

    if lcd is not None:
        lcd.clear()
    lcd_line(0, "T:" + str(temperature) + " H:" + str(humidity))
    lcd_line(1, "Light:" + str(light_level))

    try:
        mqtt_client.publish(TEMPERATURE_FEED, str(temperature))
        mqtt_client.publish(HUMIDITY_FEED, str(humidity))
        mqtt_client.publish(LIGHT_LEVEL_FEED, str(light_level))
    except Exception as e:
        print("SENSOR PUBLISH FAILED:", repr(e))
        lcd_line(1, "Send FAIL")
        raise

    print("SENSOR DATA SENT")
    lcd_line(1, "Sent OK")


def on_mqtt_message(topic, msg):
    topic = topic.decode() if isinstance(topic, bytes) else topic
    raw = msg.decode().strip()
    payload = raw.upper()

    print("MQTT MESSAGE")
    print("topic:", topic)
    print("payload:", payload)

    if topic == COMMAND_FEED:
        result = on_light_message(raw, payload)
        state_feed = STATE_FEED
    elif topic == FAN_COMMAND_FEED:
        result = on_fan_message(raw, payload)
        state_feed = FAN_STATE_FEED
    elif topic == DOOR_COMMAND_FEED:
        result = on_door_message(raw, payload)
        state_feed = DOOR_STATE_FEED
    else:
        print("UNKNOWN TOPIC:", topic)
        return

    if result is None:
        return

    mqtt_client.publish(state_feed, result)
    print("STATE PUBLISHED:", state_feed, result)


def main():
    connect_wifi()

    global mqtt_client

    mqtt_client = MQTTClient(
        client_id="yolobit-" + LIGHT_DEVICE_CODE,
        server="io.adafruit.com",
        port=1883,
        user=AIO_USERNAME,
        password=AIO_KEY,
        keepalive=30,
    )

    mqtt_client.set_callback(on_mqtt_message)

    print("Connecting MQTT...")
    mqtt_client.connect()
    print("MQTT CONNECTED")

    mqtt_client.subscribe(COMMAND_FEED)
    print("Subscribed:", COMMAND_FEED)

    mqtt_client.subscribe(FAN_COMMAND_FEED)
    print("Subscribed:", FAN_COMMAND_FEED)

    mqtt_client.subscribe(DOOR_COMMAND_FEED)
    print("Subscribed:", DOOR_COMMAND_FEED)

    lcd_show("READY")

    counter = 0
    sensor_counter = 0

    while True:
        try:
            mqtt_client.check_msg()

            counter += 1
            sensor_counter += 1

            if counter >= 40:
                print("PING MQTT")
                mqtt_client.ping()
                print("PING OK")
                counter = 0

            if sensor_counter >= SENSOR_READ_EVERY_LOOPS:
                read_and_publish_sensor()
                sensor_counter = 0

        except Exception as e:
            print("MQTT ERROR:", repr(e))
            print("RECONNECTING...")

            try:
                mqtt_client.disconnect()
            except:
                pass

            time.sleep(2)

            try:
                mqtt_client.connect()
                print("MQTT RECONNECTED")

                mqtt_client.subscribe(COMMAND_FEED)
                print("RESUBSCRIBED:", COMMAND_FEED)

                mqtt_client.subscribe(FAN_COMMAND_FEED)
                print("RESUBSCRIBED:", FAN_COMMAND_FEED)

                mqtt_client.subscribe(DOOR_COMMAND_FEED)
                print("RESUBSCRIBED:", DOOR_COMMAND_FEED)

            except Exception as reconnect_error:
                print("RECONNECT FAILED:", repr(reconnect_error))

        time.sleep(0.5)


main()