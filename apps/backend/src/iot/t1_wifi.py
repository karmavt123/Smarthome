import network, time

try:
    from iot_config import WIFI_SSID, WIFI_PASSWORD
except ImportError:
    print("!! Khong tim thay iot_config.py tren board")
    raise SystemExit

STAT = {
    1000: "IDLE", 1001: "CONNECTING", 1010: "GOT_IP",
    201: "NO_AP_FOUND (khong thay SSID)",
    202: "WRONG_PASSWORD (sai mat khau)",
    203: "CONNECT_FAIL (AP tu choi)",
}
AUTH = {0: "OPEN", 1: "WEP", 2: "WPA-PSK", 3: "WPA2-PSK", 4: "WPA/WPA2-PSK"}

w = network.WLAN(network.STA_IF)
w.active(False)
time.sleep(1)
w.active(True)
time.sleep(2)

print("--- QUET ---")
nets = w.scan()
print("Tong:", len(nets))
for ssid, bssid, ch, rssi, auth, hidden in nets:
    try:
        name = ssid.decode()
    except Exception:
        name = str(ssid)
    print("  %-24s ch=%-3d rssi=%-5d auth=%s" % (name, ch, rssi, AUTH.get(auth, auth)))

found = [n for n in nets if n[0] == WIFI_SSID.encode()]
print("--- TIM '%s': %s ---" % (WIFI_SSID, "CO" if found else "KHONG CO"))

print("--- KET NOI ---")
w.connect(WIFI_SSID, WIFI_PASSWORD)
for i in range(30):
    if w.isconnected():
        break
    print("  %2ds status=%s" % (i, STAT.get(w.status(), w.status())))
    time.sleep(1)

if w.isconnected():
    print("OK ->", w.ifconfig())
else:
    print("THAT BAI, status cuoi =", STAT.get(w.status(), w.status()))