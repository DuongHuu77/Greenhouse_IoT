import paho.mqtt.client as mqtt
import firebase_admin
from firebase_admin import credentials, db
import json
import time

# ======================= CẤU HÌNH FIREBASE =======================
cred = credentials.Certificate("serviceAccoountKey2.json")
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://iot-green-house-ebeaf-default-rtdb.firebaseio.com'
})

# ======================= CẤU HÌNH MQTT =======================
MQTT_BROKER = "localhost"
MQTT_TOPIC_SUB = "greenhouse/sensor" # Topic để nhận cảm biến
# Các topic để gửi lệnh điều khiển xuống thiết bị
MQTT_TOPIC_PUB_FAN = "greenhouse/control/fan"
MQTT_TOPIC_PUB_PUMP = "greenhouse/control/pump"
MQTT_TOPIC_PUB_LIGHT = "greenhouse/control/light"

client = mqtt.Client()

# ======================= PHẦN 1: MQTT -> FIREBASE (Cảm biến) =======================
def on_mqtt_message(client, userdata, message):
    try:
        payload = json.loads(message.payload.decode("utf-8"))
        print(f"[MQTT -> Firebase] Dữ liệu cảm biến: {payload}")

        ref = db.reference('Green_house')
        data_to_firebase = {
            "temp": payload.get("temperature"),
            "hum": payload.get("humidity"),
            "soil_hum": payload.get("soil"),
            "light": payload.get("light")
        }
        ref.update(data_to_firebase)
    except Exception as e:
        print(f"Lỗi MQTT: {e}")

# ======================= PHẦN 2: FIREBASE -> MQTT (Điều khiển) =======================
# Hàm này sẽ tự chạy khi dữ liệu trên Firebase thay đổi
def on_firebase_change(event):
    # event.path: Đường dẫn con bị thay đổi (ví dụ: /fan_switch)
    # event.data: Giá trị mới (ví dụ: "ON")
    
    path = event.path
    data = event.data

    if not data: return # Bỏ qua nếu dữ liệu rỗng

    print(f"[Firebase -> MQTT] Phát hiện thay đổi: {path} = {data}")

    # Kiểm tra xem cái gì thay đổi để gửi vào đúng topic
    if path == "/fan_switch":
        client.publish(MQTT_TOPIC_PUB_FAN, str(data))
    elif path == "/pump_switch":
        client.publish(MQTT_TOPIC_PUB_PUMP, str(data))
    elif path == "/light_switch":
        client.publish(MQTT_TOPIC_PUB_LIGHT, str(data))

# ======================= KHỞI CHẠY =======================
# 1. Kết nối MQTT
client.on_message = on_mqtt_message
client.connect(MQTT_BROKER, 1883, 60)
client.subscribe(MQTT_TOPIC_SUB)
client.loop_start() # Chạy MQTT ngầm

# 2. Lắng nghe Firebase
print("Đang lắng nghe thay đổi từ Firebase...")
ref = db.reference('Green_house')
# Đăng ký hàm on_firebase_change để lắng nghe mọi thay đổi trong nhánh Green_house
stream = ref.listen(on_firebase_change)

# Giữ chương trình chính luôn chạy
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    stream.close()
    client.loop_stop()
    print("Dừng Bridge.")