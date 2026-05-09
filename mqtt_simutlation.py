import time
import json
import random
import paho.mqtt.client as mqtt

# --- CẤU HÌNH ---
MQTT_BROKER = "localhost"
TOPIC_SENSOR = "greenhouse/sensor"
# Các topic lắng nghe lệnh điều khiển
TOPIC_CONTROL_FAN = "greenhouse/control/fan"
TOPIC_CONTROL_PUMP = "greenhouse/control/pump"
TOPIC_CONTROL_LIGHT = "greenhouse/control/light"

# Hàm xử lý khi nhận lệnh từ Bridge gửi về
def on_message(client, userdata, message):
    topic = message.topic
    payload = message.payload.decode("utf-8")
    
    print(f"\n[COMMAND RECEIVED] Topic: {topic} | Lệnh: {payload}")
    
    # Giả lập hành động bật/tắt thiết bị
    if topic == TOPIC_CONTROL_FAN:
        print(f" -> QUẠT đang chuyển sang trạng thái: {payload}")
    elif topic == TOPIC_CONTROL_PUMP:
        print(f" -> MÁY BƠM đang chuyển sang trạng thái: {payload}")
    elif topic == TOPIC_CONTROL_LIGHT:
        print(f" -> ĐÈN đang chuyển sang trạng thái: {payload}")

client = mqtt.Client()
client.on_message = on_message

print("Đang kết nối giả lập...")
client.connect(MQTT_BROKER, 1883, 60)

# Đăng ký nhận tin từ các topic điều khiển
client.subscribe("greenhouse/control/#") # Dấu # là nhận tất cả các topic con của control

# Chạy luồng ngầm để luôn lắng nghe tin nhắn đến
client.loop_start()

try:
    while True:
        # Tạo dữ liệu ngẫu nhiên
        data = {
            "temperature": round(random.uniform(25, 35), 1),
            "humidity": round(random.uniform(50, 90), 1),
            "soil": random.randint(60, 80),
            "light": random.randint(2000, 5000)
        }
        
        # Gửi lên Broker
        client.publish(TOPIC_SENSOR, json.dumps(data))
        print(f"Sent sensor data: {data}")
        
        time.sleep(3) # Gửi mỗi 3 giây

except KeyboardInterrupt:
    print("Dừng giả lập.")
    client.loop_stop()
    client.disconnect()