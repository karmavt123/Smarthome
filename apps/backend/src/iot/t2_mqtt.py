import network, time
from umqtt.simple import MQTTClient
from iot_config import WIFI_SSID, WIFI_PASSWORD, AIO_USERNAME, AIO_KEY

DEV = "YoloBit-A82F"
TEMP_FEED  = "%s/feeds/%s-temperature-humidity-sensor-temperature" % (AIO_USERNAME, DEV.lower())
LIGHT_CMD  = "%s/feeds/%s-light-command" % (AIO_USERNAME, DEV.lower())

w = network.WLAN(network.STA_IF)
w.active(True)
if not w.isconnected():
    w.connect(WIFI_SSID, WIFI_PASSWORD)
    for _ in range(20):
        if w.isconnected():
            break
        time.sleep(1)
if not w.isconnected():
    print("WIFI FAIL"); raise SystemExit
print("WIFI OK", w.ifconfig()[0])

def on_msg(topic, msg):
    print(">>> NHAN:", topic.decode(), "=", msg.decode())

print("AIO_USERNAME =", AIO_USERNAME)
print("Publish  ->", TEMP_FEED)
print("Subscribe->", LIGHT_CMD)

c = MQTTClient(client_id="t2-" + DEV, server="io.adafruit.com", port=1883,
               user=AIO_USERNAME, password=AIO_KEY, keepalive=30)
c.set_callback(on_msg)
c.connect()
print("MQTT CONNECTED")
c.subscribe(LIGHT_CMD)

for i in range(12):
    val = str(25 + i)
    c.publish(TEMP_FEED, val)
    print("gui:", val)
    c.check_msg()
    time.sleep(5)

c.disconnect()
print("XONG")