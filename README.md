# Greenhouse IoT — Real-Time Monitoring & Control System

A smart greenhouse system built on a **4-layer IoT architecture**, enabling real-time environmental monitoring and remote actuator control via MQTT, Firebase Realtime Database, and a responsive web dashboard.

<img width="80%" alt="image" src="https://github.com/user-attachments/assets/82c746ae-15cb-4c7f-9071-60278fc81fb3" />


---

## Overview

Developed as part of the *IoT Architecture & Protocols* practicum at **HCMUTE** (Ho Chi Minh City University of Technology and Education, Semester 1 — 2025–2026).

The system collects four environmental parameters — **temperature, air humidity, soil moisture, and light intensity** — and transmits them in real time from an ESP32-C6 microcontroller through an MQTT broker (Eclipse Mosquitto) to Firebase Realtime Database. A browser-based SPA dashboard and an Android mobile app allow users to monitor live readings and toggle three actuators (fan, water pump, grow light) remotely from any device.

---

## System Architecture

The system follows the **4-layer IoT model**:

| Layer | Responsibility | Implementation |
|---|---|---|
| **Perception** | Sensor acquisition & actuator control | ESP32-C6, DHT11, BH1750, Soil Sensor, Relay |
| **Network** | Wireless data transport | Wi-Fi (ESP32-C6), MQTT v3.1.1 over TCP/IP |
| **Processing** | Message routing & cloud storage | Eclipse Mosquitto Broker, Firebase Realtime Database |
| **Application** | User interface & remote control | Vanilla JS SPA, Chart.js, MIT App Inventor |

### Data Flow

```
[Sensors] ──► ESP32-C6 ──► Wi-Fi ──► Mosquitto Broker ◄──► bridge.py ◄──► Firebase RTDB
                                                                                  ↕
                                                                   Web Dashboard / Android App
```

- **Monitoring path:** ESP32 publishes a JSON payload to `greenhouse/sensor` every few seconds → `bridge.py` receives it via `on_mqtt_message`, parses `temperature / humidity / soil / light`, and writes to `Green_house/*` in Firebase → the dashboard's `onValue` listeners fire and update the UI instantly, without a page reload.

- **Control path:** User clicks a toggle button on the dashboard → `set(switchRef, newState)` writes `"ON"` or `"OFF"` to `Green_house/fan_switch` (or `pump_switch` / `light_switch`) → `bridge.py`'s Firebase stream listener (`on_firebase_change`) detects the path change and publishes to the corresponding MQTT control topic (`greenhouse/control/fan`, etc.) → ESP32 receives the command via its subscription and switches the relay.

<!-- [IMAGE] 4-layer architecture diagram -->
<!-- <img src="assets/architecture.png" width="80%"/> -->
<img width="80%"  alt="image" src="https://github.com/user-attachments/assets/9f615c05-00f9-4cf3-ab58-ab75bd322394" />

<!-- [IMAGE] System specification / data flow diagram -->
<!-- <img src="assets/system_spec.png" width="80%"/> -->
<img width="80%"  alt="image" src="https://github.com/user-attachments/assets/5c8ea6c6-6097-46bf-94b4-78bd23e80439" />

---

## Hardware

| Component | Role | Interface |
|---|---|---|
| ESP32-C6 | Central MCU — Wi-Fi 6, BLE, RISC-V 32-bit | — |
| DHT11 | Temperature (0–50 °C ±2 °C) & humidity (20–90 %RH ±5 %RH) | 1-Wire |
| BH1750 | Light intensity (1–65 535 lux ±7 lux) | I²C |
| Soil Moisture Sensor | Soil moisture (0–100 % ±5 %) | Analog / Digital |
| Water Pump (12 V) | Irrigation actuator | Relay |
| Fan (12 V) | Ventilation actuator | Relay |
| LED Module (12 V) | Supplemental grow lighting | Relay |
| Relay Module | Isolates 3.3 V logic from 12 V load | GPIO |

<!-- [IMAGE] Hardware wiring schematic -->
<!-- <img src="assets/schematic.png" width="80%"/> -->
<img width="80%"  alt="image" src="https://github.com/user-attachments/assets/a60b0b6c-a61b-41fb-8118-caf66933c34c" />

<!-- [IMAGE] Physical hardware model -->
<!-- <img src="assets/hardware.jpg" width="70%"/> -->
<img width="80%" alt="image" src="https://github.com/user-attachments/assets/d843dae8-003f-4a2c-9a11-5da6294348e6" />

---

## Repository Structure

```
Greenhouse_IoT/
│
├── bridge.py                   # MQTT ↔ Firebase bridge (Python)
├── mqtt_simulation.py          # ESP32 simulator — publishes fake sensor data via MQTT
├── simulator.htm               # Browser-based simulator — writes fake data directly to Firebase
│
├── web_iot_greenhouse/
│   ├── index.html              # SPA entry point
│   ├── function.js             # Firebase listeners, Chart.js, actuator toggle logic
│   ├── style.css               # Responsive CSS Grid layout
│   └── image/                  # Icons, model overlay assets, fan animation
│
├── mobileapp.apk/                     # MIT App Inventor .aia file
│
├── serviceAccountKey.json      # ⚠ Firebase Admin SDK key — see Security section
└── .gitignore
```

---

## Key Components

### `bridge.py` — MQTT ↔ Firebase Bridge

The bridge is the central integration point between the embedded layer and the cloud. It runs two concurrent loops:

**MQTT → Firebase (sensor ingestion)**
```python
def on_mqtt_message(client, userdata, message):
    payload = json.loads(message.payload.decode("utf-8"))
    db.reference('Green_house').update({
        "temp"    : payload.get("temperature"),
        "hum"     : payload.get("humidity"),
        "soil_hum": payload.get("soil"),
        "light"   : payload.get("light")
    })
```
Subscribes to `greenhouse/sensor`. On each message, deserialises the JSON payload and pushes all four values to Firebase in a single `update()` call.

**Firebase → MQTT (actuator control)**
```python
def on_firebase_change(event):
    topic_map = {
        "/fan_switch"  : "greenhouse/control/fan",
        "/pump_switch" : "greenhouse/control/pump",
        "/light_switch": "greenhouse/control/light"
    }
    if event.path in topic_map:
        client.publish(topic_map[event.path], str(event.data))
```
Registers a Firebase stream listener on `Green_house/`. When a switch node changes (e.g. `/fan_switch → "ON"`), the bridge immediately publishes the new state to the corresponding MQTT control topic.

---

### `function.js` — Web Dashboard Logic

**Real-time sensor display**

`onValue` listeners are attached to `Green_house/temp`, `hum`, `soil_hum`, and `light`. Every Firebase push fires the callback and updates the DOM element plus the corresponding Chart.js dataset without reloading the page.

**Dual-axis temperature & humidity chart**

The combo chart plots temperature on the left Y-axis (`y1`) and humidity on the right Y-axis (`y2`), both sharing the same time-based X-axis. The rolling window is capped at 20 data points: once exceeded, `shift()` removes the oldest entry before calling `chart.update("none")` to suppress animation and keep rendering snappy.

**Actuator toggle logic (`bindToggle`)**

A single `bindToggle()` function handles all three actuators generically. It:
1. Reads the current state from Firebase via `onValue(switchRef, …)` and updates the status dot (green/red), the ON/OFF label, and the visual overlay on the greenhouse model (fan video/image, pump valve image, light image).
2. Attaches a click handler to the toggle button — writing the inverted state back to Firebase. Because the UI only updates through the `onValue` callback (not the click handler directly), all connected clients stay consistent automatically.

**Soil moisture gradient bar**

The bar uses a fixed CSS gradient (`dry → wet`) as background. A grey overlay div (`#soil-bar-fill`) is positioned on the right and its width is set to `(100 - value)%` — exposing only the relevant portion of the gradient.

**SPA page routing**

`showPage(id)` removes the `active` class from all `.page` elements and adds it to the target, giving zero-reload navigation between Home, Soil Moisture, Temperature & Humidity, and Light pages.

---

### Simulation Tools

Two tools were built to test the full pipeline without physical hardware:

| Tool | How it works |
|---|---|
| `mqtt_simulation.py` | Publishes random JSON sensor data to `greenhouse/sensor` every 3 s via MQTT; also subscribes to `greenhouse/control/#` and logs received commands — mimics ESP32 behaviour |
| `simulator.htm` | Browser page that writes random values directly to Firebase (bypassing MQTT) using `set()` for current readings and `push()` to append timestamped entries to `Green_house_logs/*` for historical tracking |

---

## Firebase Database Structure

```json
{
  "Green_house": {
    "temp"         : 28.5,
    "hum"          : 65,
    "soil_hum"     : 72,
    "light"        : 843,
    "fan_switch"   : "OFF",
    "pump_switch"  : "OFF",
    "light_switch" : "OFF"
  },
  "Green_house_logs": {
    "temp"  : { "<push_id>": { "value": 28.5, "time": 1718000000000 } },
    "hum"   : { "<push_id>": { "value": 65,   "time": 1718000000000 } },
    "soil"  : { "<push_id>": { "value": 72,   "time": 1718000000000 } },
    "light" : { "<push_id>": { "value": 843,  "time": 1718000000000 } }
  }
}
```

`Green_house` holds the latest reading (overwritten on each cycle via `set()`). `Green_house_logs` stores the full time-series history using Firebase's `push()` — each call generates a chronologically sortable unique key.

<!-- [IMAGE] Firebase Console — database tree screenshot -->
<!-- <img src="assets/firebase_nodes.png" width="70%"/> -->

---

## Web Dashboard

<!-- [IMAGE] Home page screenshot -->
<!-- <img src="assets/dashboard_home.png" width="80%"/> -->
<img width="80%"  alt="image" src="https://github.com/user-attachments/assets/161ee1ce-a5ee-4680-ba1d-97f110f6ae15" />

<!-- [IMAGE] Soil Moisture page screenshot -->
<!-- <img src="assets/dashboard_soil.png" width="80%"/> -->
<img width="80%" alt="image" src="https://github.com/user-attachments/assets/501e583a-3474-461b-8adb-4d08cee57e55" />

<!-- [IMAGE] Temperature & Humidity page screenshot -->
<!-- <img src="assets/dashboard_temphum.png" width="80%"/> -->
<img width="80%" alt="image" src="https://github.com/user-attachments/assets/596d164b-e108-47cc-b2d9-fb18bba50fc0" />

<!-- [IMAGE] Light page screenshot -->
<!-- <img src="assets/dashboard_light.png" width="80%"/> -->
<img width="80%"  alt="image" src="https://github.com/user-attachments/assets/8b0d967a-f112-4e36-be3f-aa80c62e050f" />

| Page | Content |
|---|---|
| **Home** | 4-card sensor summary, greenhouse model overlay with live actuator visuals, ON/OFF toggle buttons |
| **Soil Moisture** | Gradient moisture bar + rolling line chart |
| **Temperature & Humidity** | Dual-axis line chart (temperature left, humidity right) |
| **Light** | Rolling line chart for lux readings |

**Layout:** CSS Grid (`240 px sidebar | 1fr content`, `70 px header | 1fr main | 60 px footer`). Fully responsive — at ≤768 px the sidebar collapses off-screen and a hamburger button (`#menu-toggle`) slides it in over a dimmed overlay.

### Mobile App

<!-- [IMAGE] Mobile app screenshots -->
<!-- <img src="assets/mobile.png" width="55%"/> -->

<p align="center">
  <img src="https://github.com/user-attachments/assets/c8ba04f6-9549-4052-9a82-769fd2349487" width="45%" />
  <img src="https://github.com/user-attachments/assets/c9ab63ec-8bb2-486a-907c-6840da74ee36" width="45%" />
</p>

Built with **MIT App Inventor**. A WebView component loads the web dashboard URL, giving the full monitoring and control experience inside a native Android shell.

---

## Getting Started

### Prerequisites

- Python 3.x with `paho-mqtt` and `firebase-admin` (`pip install paho-mqtt firebase-admin`)
- [Eclipse Mosquitto](https://mosquitto.org/download/) running locally
- Firebase project with Realtime Database enabled and security rules set to allow read/write

### 1. Clone

```bash
git clone https://github.com/DuongHuu77/Greenhouse_IoT.git
cd Greenhouse_IoT
```

### 2. Add Firebase credentials

Place your `serviceAccountKey.json` (Firebase Admin SDK key) in the project root. Update `bridge.py` if the filename differs:

```python
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://<your-project>-default-rtdb.firebaseio.com'
})
```

### 3. Start Mosquitto

```bash
mosquitto -v
```

### 4. Start the bridge

```bash
python bridge.py
```

### 5. Run the simulator (no hardware required)

```bash
python mqtt_simulation.py   # simulates ESP32 over MQTT
# or open simulator.htm in a browser to write directly to Firebase
```

### 6. Open the dashboard

Open `web_iot_greenhouse/index.html` in a browser, or serve it locally:

```bash
cd web_iot_greenhouse && npx serve .
```

---

## ⚠ Security — `serviceAccountKey.json`

`serviceAccountKey.json` contains a **Firebase Admin SDK private key** with full read/write access to the database. This file is listed in `.gitignore` and must **never be committed**.

To generate your own: Firebase Console → Project Settings → Service Accounts → **Generate new private key**.

If accidentally pushed, **revoke the key immediately** in the Firebase Console before generating a new one.

---

## Credits

**Course:** IoT Architecture & Protocols Practicum (`ITAL328264_01`)  
**Institution:** HCMUTE — Faculty of Electrical & Electronics Engineering  
**Supervisor:** Dr. Trương Quang Phúc  
**Academic Year:** 2025–2026, Semester 1

### Team

| # | Name | Student ID | Contributions | GitHub |
|:-:|---|:-:|---|:-:|
| 1 | **Dương Trương Thái Hữu** | 23139020 | MQTT protocol design & implementation (`bridge.py`) · Firebase Realtime Database integration · Web dashboard development (`function.js`, `index.html`) · Simulation tooling · Technical report (MQTT & Firebase sections) | [![gh](https://img.shields.io/badge/-DuongHuu77-181717?logo=github)](https://github.com/DuongHuu77) |
| 2 | Nguyễn Anh Thảo | 23139043 | System architecture design · Requirements analysis · Web & mobile application · System specification diagrams · Technical report (web & mobile sections) | [![gh](https://img.shields.io/badge/-GitHub-181717?logo=github)](https://github.com/nguyenthaozzz) |
| 3 | Nguyễn Đình Thi | 23139044 | Hardware selection & schematic design · System block diagram · Web context diagram · Web development · Technical report (hardware section) | [![gh](https://img.shields.io/badge/-GitHub-181717?logo=github)](https://github.com/timmie182) |

---

<div align="center">
  <sub>HCMUTE · Greenhouse IoT · 2025–2026</sub>
</div>
