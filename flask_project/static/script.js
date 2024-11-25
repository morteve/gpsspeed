const BASE_URL = "https://gpsspeed.onrender.com";

// Globale variabler
let calibrationData = [
    { rpm: 850, fuel: 0.8 },
    { rpm: 3200, fuel: 10.0 },
    { rpm: 4500, fuel: 16.0 },
    { rpm: 5850, fuel: 22.5 }
];
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
    populateCalibrationTable();
});

// Fyll ut kalibreringstabell
function populateCalibrationTable() {
    const fieldsContainer = document.querySelector('.calibration-fields');
    fieldsContainer.innerHTML = '';
    calibrationData.forEach((row, index) => {
        fieldsContainer.innerHTML += `
            <div class="calibration-row">
                <label>RPM:</label>
                <input type="number" class="rpm-input" value="${row.rpm}" data-index="${index}">
                <label>Forbruk (L/t):</label>
                <input type="number" class="fuel-input" value="${row.fuel}" data-index="${index}">
            </div>
        `;
    });
}

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

// GPS overvåking
function startGPS() {
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            position => {
                console.log('Position received:', position);

                // Bruk calculateSpeed for fallback
                let speed = position.coords.speed;

                if (speed === null || speed === undefined) {
                    const { speed: calculatedSpeed } = calculateSpeed(position);
                    speed = calculatedSpeed;
                } else {
                    speed = speed * 3.6; // Konverter m/s til km/t
                }

                const rpm = 3200; // Standardverdi
                speedDisplay.textContent = `Hastighet: ${speed.toFixed(2)} km/t`;
                distanceDisplay.textContent = `Distanse: ${totalDistance.toFixed(2)} km`;

                updateFuelAndDistance(rpm, speed);
            },
            error => {
                console.error('GPS-feil:', error);
                speedDisplay.textContent = 'Feil ved henting av hastighet';
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        speedDisplay.textContent = 'Geolokasjon støttes ikke av enheten.';
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



// Start GPS

function startGPS() {
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            position => {
                console.log('Position received:', position); // Logg hele posisjonsobjektet
                console.log('Raw speed (m/s):', position.coords.speed); // Logg hastighet fra posisjonsdata

                // Prøv å hente hastighet
                let speed = position.coords.speed;

                // Hvis speed ikke er tilgjengelig, beregn manuelt basert på forflytning
                if (speed === null || speed === undefined) {
                    const { speed: calculatedSpeed } = calculateSpeed(position);
                    speed = calculatedSpeed;
                } else {
                    // Konverter hastighet fra m/s til km/t
                    speed = speed * 3.6;
                }
                console.log('Final speed (km/h):', speed); // Logg endelig hastighet som vises

                const rpm = 3200; // Standardverdi for testing

                // Oppdater visninger
                speedDisplay.textContent = `Hastighet: ${speed.toFixed(2)} km/t`;
                distanceDisplay.textContent = `Distanse: ${totalDistance.toFixed(2)} km`;

                // Oppdater drivstoff og distanse
                updateFuelAndDistance(rpm, speed);
            },
            error => {
                let errorMessage = 'Feil ved henting av hastighet';

                // Spesifikke feilmeldinger
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Tilgang til GPS er avvist.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'GPS-posisjon ikke tilgjengelig.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'GPS-forespørselen tok for lang tid.';
                        break;
                }

                console.error(errorMessage);
                speedDisplay.textContent = errorMessage;
                console.error('Geolocation error:', error); // Logg detaljer om feilen
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        speedDisplay.textContent = 'Geolokasjon støttes ikke av enheten.';
    }
}
