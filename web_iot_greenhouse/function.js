// ======================= FIREBASE IMPORT =======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// ======================= FIREBASE CONFIG =======================
const firebaseConfig = {
    apiKey: "AIzaSyC_5zwHVBSGlafgtSerW6DWQ5_MoocACRo",
    authDomain: "iot-green-house-ebeaf.firebaseapp.com",
    databaseURL: "https://iot-green-house-ebeaf-default-rtdb.firebaseio.com",
    projectId: "iot-green-house-ebeaf",
    storageBucket: "iot-green-house-ebeaf.firebasestorage.app",
    messagingSenderId: "472750644936",
    appId: "1:472750644936:web:c402395617eb24e3f7cffd",
    measurementId: "G-VWSXQ37WJG"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);

// ======================= DOM ELEMENTS =======================
const nhietDoElement = document.getElementById('temperature');
const doAmElement = document.getElementById('humidity');
const soilElement = document.getElementById('soil');
const lightElement = document.getElementById('light');

// ======================= FIREBASE REFERENCE =======================
const tempRef = ref(database, 'Green_house/temp');
const humRef = ref(database, 'Green_house/hum');
const soilRef = ref(database, 'Green_house/soil_hum');
const lightRef = ref(database, 'Green_house/light');

// SWITCH DEVICE
const pumpSwitchRef = ref(database, 'Green_house/pump_switch');
const fanSwitchRef = ref(database, 'Green_house/fan_switch');
const lightSwitchRef = ref(database, 'Green_house/light_switch');

document.addEventListener("DOMContentLoaded", () => {

    // ==================== DIGITAL CLOCK ====================
    function updateClock() {
        const now = new Date();
        document.getElementById("clock").textContent = now.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // ==================== CHART CONFIG ====================
    function createChartConfig(label, color) {
        return {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: label,
                    data: [],
                    borderColor: color,
                    backgroundColor: color.replace("rgb", "rgba").replace(")", ",0.2)"),
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        title: { display: true, text: "Thời gian" },
                        grid: { display: true }
                    },
                    y: {
                        beginAtZero: false,
                        grid: { display: true }
                    }
                }
            }
        };
    }

    // ================= BIỂU ĐỒ NHIỆT ĐỘ – ĐỘ ẨM =================
    const ctxHumTemp = document.getElementById('temp-chart').getContext('2d');
    const HumTempchart = new Chart(ctxHumTemp, {
        type: 'line',
        data: { labels: [], datasets: [
            { label: "Nhiệt độ (°C)", data: [], borderColor: "red", borderWidth: 2, yAxisID: "y1", fill: false },
            { label: "Độ ẩm (%)", data: [], borderColor: "blue", borderWidth: 2, yAxisID: "y2", fill: false }
        ]},
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: "Thời gian" } },
                y1: { position: "left", grid: { display: false } },
                y2: { position: "right", grid: { display: true } }
            }
        }
    });

    let lasttemp = null;
    let lasthum = null;

    function update_combo_chart() {
        const now = new Date().toLocaleTimeString('vi-VN');
        HumTempchart.data.labels.push(now);
        HumTempchart.data.datasets[0].data.push(lasttemp);
        HumTempchart.data.datasets[1].data.push(lasthum);

        if (HumTempchart.data.labels.length > 20) {
            HumTempchart.data.labels.shift();
            HumTempchart.data.datasets[0].data.shift();
            HumTempchart.data.datasets[1].data.shift();
        }
        HumTempchart.update("none");
    }

    onValue(tempRef, (snap) => {
        const v = snap.val();
        nhietDoElement.innerText = v + "°C";
        lasttemp = v;
        update_combo_chart();
    });

    onValue(humRef, (snap) => {
        const v = snap.val();
        doAmElement.innerText = v + "%";
        lasthum = v;
        update_combo_chart();
    });

    // ================= BIỂU ĐỒ SOIL =================
    const soilChart = new Chart(document.getElementById('soil-chart').getContext('2d'),
        createChartConfig("Độ ẩm đất (%)", "rgb(0,128,0)")
    );

    onValue(soilRef, (snap) => {
        const v = snap.val();
        soilElement.innerText = v + "%";
        document.getElementById("soil-bar-fill").style.width = (100 - v) + "%";

        const t = new Date().toLocaleTimeString();
        soilChart.data.labels.push(t);
        soilChart.data.datasets[0].data.push(v);

        if (soilChart.data.labels.length > 20) {
            soilChart.data.labels.shift();
            soilChart.data.datasets[0].data.shift();
        }
        soilChart.update("none");
    });

    // ================= LIGHT CHART =================
    const lightChart = new Chart(document.getElementById('light-chart').getContext('2d'),
        createChartConfig("Cường độ ánh sáng (lux)", "rgb(255,206,86)")
    );

    onValue(lightRef, (snap) => {
        const v = snap.val();
        lightElement.innerText = v + " lux";

        const t = new Date().toLocaleTimeString();
        lightChart.data.labels.push(t);
        lightChart.data.datasets[0].data.push(v);

        if (lightChart.data.labels.length > 20) {
            lightChart.data.labels.shift();
            lightChart.data.datasets[0].data.shift();
        }
        lightChart.update("none");
    });

    // ==================== SPA PAGE SWITCH ====================
    window.showPage = function (id) {
        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        document.getElementById(id).classList.add("active");
    };

    // ==================== BIND TOGGLE FUNCTION ====================
    function bindToggle(cfg) {
        const {
            homeDot, homeText, homeBtn,
            spaDot, spaText, spaBtn,
            lightImageId, fanVideoId, fanImageId,
            pumpImageId, pumpImageId2,
            switchRef
        } = cfg;

        const hDot = document.getElementById(homeDot);
        const hTxt = document.getElementById(homeText);
        const hBtn = document.getElementById(homeBtn);

        const sDot = document.getElementById(spaDot);
        const sTxt = document.getElementById(spaText);
        const sBtn = document.getElementById(spaBtn);

        const lightImg = lightImageId ? document.getElementById(lightImageId) : null;
        const fanVid = fanVideoId ? document.getElementById(fanVideoId) : null;
        const fanImg = fanImageId ? document.getElementById(fanImageId) : null;
        const pumpImg = pumpImageId ? document.getElementById(pumpImageId) : null;
        const pumpImg2 = pumpImageId2 ? document.getElementById(pumpImageId2) : null;

        // Update UI
        function updateUI(state) {
            hTxt.innerText = state;
            sTxt.innerText = state;

            hDot.className = "dot " + (state === "ON" ? "online" : "offline");
            sDot.className = "dot " + (state === "ON" ? "online" : "offline");

            if (lightImg)
                lightImg.src = state === "ON" ? "./image/light_on.png" : "./image/light_off.png";

            if (fanVid && fanImg) {
                if (state === "ON") {
                    fanVid.hidden = false;
                    fanImg.hidden = true;
                } else {
                    fanVid.hidden = true;
                    fanImg.hidden = false;
                }
            }

            if (pumpImg) {
                const src = state === "ON" ? "./image/van_on.png" : "./image/van_off.png";
                pumpImg.src = src;
                pumpImg2.src = src;
            }
        }

        // Lắng nghe Firebase
        onValue(switchRef, (snap) => {
            const state = snap.val() || "OFF";
            updateUI(state);
        });

        // Xử lý nút
        const clickHandler = () => {
            const current = hTxt.innerText;
            const newState = current === "ON" ? "OFF" : "ON";
            set(switchRef, newState);
        };

        hBtn.addEventListener("click", clickHandler);
        sBtn.addEventListener("click", clickHandler);
    }

    // ==================== BIND 3 THIẾT BỊ ====================
    bindToggle({
        homeDot: "soil-dot-home", homeText: "soil-text-home", homeBtn: "pump-home",
        spaDot: "soil-dot-spa", spaText: "soil-text-spa", spaBtn: "pump-spa",
        pumpImageId: "pump-img-id", pumpImageId2: "pump-img-id2",
        switchRef: pumpSwitchRef
    });

    bindToggle({
        homeDot: "temp-dot-home", homeText: "temp-text-home", homeBtn: "fan-home",
        spaDot: "temp-dot-spa", spaText: "temp-text-spa", spaBtn: "fan-spa",
        fanVideoId: "fan-video-id", fanImageId: "fan-img-id",
        switchRef: fanSwitchRef
    });

    bindToggle({
        homeDot: "light-dot-home", homeText: "light-text-home", homeBtn: "light-home",
        spaDot: "light-dot-spa", spaText: "light-text-spa", spaBtn: "light-spa",
        lightImageId: "light-img-id",
        switchRef: lightSwitchRef
    });

    // ==================== MOBILE MENU (ĐÃ FIX) ====================
    const menuToggleButton = document.getElementById("menu-toggle");
    const sidebarElem = document.querySelector(".sidebar");
    const overlayElem = document.getElementById("overlay");

    if (menuToggleButton && sidebarElem && overlayElem) {

        menuToggleButton.addEventListener("click", () => {
            sidebarElem.classList.toggle("open");
            overlayElem.classList.toggle("active");
        });

        overlayElem.addEventListener("click", () => {
            sidebarElem.classList.remove("open");
            overlayElem.classList.remove("active");
        });

        document.querySelectorAll(".sidebar a").forEach(link => {
            link.addEventListener("click", () => {
                sidebarElem.classList.remove("open");
                overlayElem.classList.remove("active");
            });
        });
    }

    document.getElementById("year").textContent = new Date().getFullYear();
});
