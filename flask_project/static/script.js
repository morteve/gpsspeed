const BASE_URL = "https://gpsspeed.onrender.com";


let totalDistance = 0;
let lastPosition = null;

// HTML-elementer
const drawer = document.getElementById('drawer');
const settingsIcon = document.getElementById('settings-icon');
const speedDisplay = document.getElementById('speed');
const fuelDisplay = document.getElementById('fuel');
const distanceDisplay = document.getElementById('distance');
const fuelPerDistanceDisplay = document.getElementById('fuel-per-distance');
const calibrationForm = document.getElementById('calibration-form');

// Drawer-funksjonalitet
settingsIcon.addEventListener('click', () => {
    drawer.classList.toggle('open');
    generateCalibrationTable();
});

// Kalibreringsdata (default verdier)
let calibrationData = [
    { rpm: 850, speed: 0, fuel: 0.8 },
    { rpm: 3200, speed: 20, fuel: 10.0 },
    { rpm: 4500, speed: 40, fuel: 16.0 },
    { rpm: 5850, speed: 60, fuel: 22.5 },
];

// Generer kalibreringstabell
function generateCalibrationTable() {
    const calibrationFields = document.querySelector(".calibration-fields");
    calibrationFields.innerHTML = ""; // Tøm eksisterende innhold

    calibrationData.forEach((data, index) => {
        const row = document.createElement("div");
        row.classList.add("calibration-row");

        row.innerHTML = `
            <label>RPM:</label>
            <input type="number" class="rpm-input" value="${data.rpm}" data-index="${index}" data-field="rpm">
            <label>Hastighet (km/t):</label>
            <input type="number" class="speed-input" value="${data.speed}" data-index="${index}" data-field="speed">
            <label>Forbruk (L/t):</label>
            <input type="number" class="fuel-input" value="${data.fuel}" data-index="${index}" data-field="fuel">
        `;

        calibrationFields.appendChild(row);
    });
}

// Oppdater kalibreringsdata ved brukerinput
document.querySelector(".calibration-fields").addEventListener("input", (event) => {
    const index = parseInt(event.target.dataset.index);
    const field = event.target.dataset.field;
    const value = parseFloat(event.target.value);

    if (!isNaN(value) && index !== undefined && field) {
        calibrationData[index][field] = value; // Oppdater den relevante egenskapen
    } else {
        console.warn("Ugyldig verdi ignorert:", event.target.value);
    }
});

// Kalibrer data
document.getElementById("calibrate-btn").addEventListener("click", () => {
    const rpmValues = calibrationData.map(data => data.rpm);
    const speedValues = calibrationData.map(data => data.speed);
    const fuelValues = calibrationData.map(data => data.fuel);

    fetch(`${BASE_URL}/calibrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rpm: rpmValues, speed: speedValues, fuel: fuelValues })
    })
        .then(response => response.json())
        .then(result => {
            alert(result.message || "Kalibrering vellykket!");
        })
        .catch(error => {
            alert("Feil ved kalibrering.");
            console.error(error);
        });
});



// Generer tabellen ved oppstart
generateCalibrationTable();


// Kalibrer og send data til serveren
document.getElementById('calibrate-btn').addEventListener('click', () => {
    const rpmInputs = document.querySelectorAll('.rpm-input');
    const fuelInputs = document.querySelectorAll('.fuel-input');

    calibrationData = Array.from(rpmInputs).map((input, index) => ({
        rpm: parseFloat(input.value),
        fuel: parseFloat(fuelInputs[index].value)
    }));

    fetch(`${BASE_URL}/calibrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            rpm: calibrationData.map(row => row.rpm),
            fuel: calibrationData.map(row => row.fuel)
        })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message || 'Kalibrering fullført');
    })
    .catch(error => {
        alert('Feil ved kalibrering: ' + error.message);
    });
});


// Oppdater drivstofforbruk basert på hastighet
function calculateFuelAndUpdate(speed) {
    fetch(`${BASE_URL}/calculate?speed=${speed}&unit=kmh`)
        .then(response => response.json())
        .then(data => {
            if (data.fuel_per_hour && data.fuel_per_distance) {
                document.getElementById("fuel").textContent = `Drivstofforbruk: ${data.fuel_per_hour.toFixed(2)} L/t`;
                document.getElementById("fuel-per-distance").textContent = `Forbruk: ${data.fuel_per_distance.toFixed(2)} L/km`;
            } else {
                console.error("Ugyldig respons fra API:", data);
            }
        })
        .catch(error => console.error("Feil ved beregning:", error));
}

// Oppdater basert på GPS hastighet
function updateSpeedAndFuel(speed) {
    const speedDisplay = document.getElementById("speed");
    const formattedSpeed = unit === "kmh" ? speed * 3.6 : speed; // Konverter m/s til km/t eller knop

    speedDisplay.textContent = `Hastighet: ${formattedSpeed.toFixed(2)} ${unit === "kmh" ? "km/t" : "knop"}`;

    // Beregn drivstoff basert på hastighet
    calculateFuelAndUpdate(formattedSpeed);
}

// Beregn hastighet basert på GPS-posisjon
function calculateSpeed(position) {
    const { latitude, longitude } = position.coords;
    const currentTime = position.timestamp;

    console.log('New position:', { latitude, longitude, currentTime });

    if (lastPosition) {
        const { latitude: lastLat, longitude: lastLon, time: lastTime } = lastPosition;
        console.log('Last position:', { lastLat, lastLon, lastTime });

        const distance = haversineDistance(lastLat, lastLon, latitude, longitude); // km
        console.log('Distance moved (km):', distance);

        const timeElapsed = (currentTime - lastTime) / 1000 / 3600; // timer
        console.log('Time elapsed (hours):', timeElapsed);

        const speed = distance / timeElapsed; // km/t
        console.log('Calculated speed (km/h):', speed);

        totalDistance += distance;
        lastPosition = { latitude, longitude, time: currentTime };
        return { speed, distance };
    }

    lastPosition = { latitude, longitude, time: currentTime };
    return { speed: 0, distance: 0 };
}

// Start GPS-overvåkning
function startGPS() {
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                const speed = position.coords.speed || 0; // Hastighet i m/s
                updateSpeedAndFuel(speed);
            },
            (error) => {
                console.error("GPS-feil:", error);
                document.getElementById("speed").textContent = "Henter hastighet...";
            },
            { enableHighAccuracy: true }
        );
    } else {
        console.error("GPS er ikke tilgjengelig.");
    }
}

// Haversine formel for avstand
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radiusen til jorden i km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos((lat1 * Math.PI) / 180) *
              Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Update fuel and distance
function updateFuelAndDistance(rpm, speed) {
    console.log('Updating fuel and distance with:', { rpm, speed });

    // Når hastighet ikke er mottatt (null eller undefined), sett drivstofforbruk til 0
    if (speed === null || speed === undefined) {
        console.log('Speed is null or undefined, setting fuel to 0.');
        fuelDisplay.textContent = `Drivstofforbruk: 0.0 L/t`;
        fuelPerDistanceDisplay.textContent = `Forbruk: - L/km (hastighet ikke tilgjengelig)`;
        return;
    }

    // Når hastighet er 0, bruk oppdatert idle RPM
    if (speed === 0) {
        const idleRPM = Math.min(...calibrationData.map(d => d.rpm)); // Laveste RPM
        const fuelAtIdleRPM = calibrationData.find(d => d.rpm === idleRPM)?.fuel || 0; // Oppdatert forbruk for laveste RPM
        console.log('Speed is 0, using updated idle RPM:', { idleRPM, fuelAtIdleRPM });

        fuelDisplay.textContent = `Drivstofforbruk: ${fuelAtIdleRPM.toFixed(2)} L/t`;
        fuelPerDistanceDisplay.textContent = `Forbruk: - L/km (stoppet)`;
        return;
    }

    // Når hastighet > 0, kall API for beregning
    fetch(`${BASE_URL}/calculate?rpm=${rpm}&speed=${speed}&unit=kmh`)
        .then(response => response.json())
        .then(data => {
            console.log('API data (fuel calculations):', data);

            fuelDisplay.textContent = `Drivstofforbruk: ${data.fuel_per_hour.toFixed(2)} L/t`;
            fuelPerDistanceDisplay.textContent = `Forbruk: ${data.fuel_per_distance.toFixed(2)} L/km`;
        })
        .catch(error => console.error('Error in updateFuelAndDistance:', error));
}



function startGPS() {
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                console.log("Position received:", position); // Log hele posisjonsobjektet
                console.log("Raw speed (m/s):", position.coords.speed); // Log hastighet fra posisjonsdata

                let speed = position.coords.speed;

                // Hvis hastighet ikke er tilgjengelig, beregn manuelt eller bruk fallback
                if (speed === null || speed === undefined) {
                    const { speed: calculatedSpeed } = calculateSpeed(position);
                    speed = calculatedSpeed || 0; // Fallback til 0 hvis beregning også feiler
                } else {
                    // Konverter m/s til km/t
                    speed = speed * 3.6;
                }
                console.log("Final speed (km/h):", speed); // Log endelig hastighet

                // Oppdater visning av hastighet
                speedDisplay.textContent = `Hastighet: ${speed.toFixed(2)} km/t`;

                // Oppdater drivstoff og distanse
                updateFuelAndDistance(speed);
            },
            (error) => {
                let errorMessage = "Feil ved henting av hastighet";

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Tilgang til GPS er avvist.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "GPS-posisjon ikke tilgjengelig.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "GPS-forespørselen tok for lang tid.";
                        break;
                }

                console.error(errorMessage);
                speedDisplay.textContent = errorMessage;
                console.error("Geolocation error:", error); // Log detaljer om feilen
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        speedDisplay.textContent = "Geolokasjon støttes ikke av enheten.";
    }
}
