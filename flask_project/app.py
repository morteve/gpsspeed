from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import numpy as np
import logging

# Opprett Flask-applikasjonen
app = Flask(__name__, static_url_path='', static_folder='static')
CORS(app)  # Tillat CORS for å støtte forespørsler fra eksterne kilder

# Logging for debugging
logging.basicConfig(level=logging.DEBUG)

# Globale kalibreringsdata
calibration_data = {
    "rpm": [850, 3200, 4500, 5850],
    "fuel": [0.8, 10.0, 16.0, 22.5]
}

# Hjemmerute for å tjene index.html fra static-mappen
@app.route("/")
def serve_frontend():
    return send_from_directory("static", "index.html")

# Endepunkt for kalibrering
@app.route("/calibrate", methods=["POST"])
def calibrate():
    data = request.json  # Hent JSON-data fra forespørselen
    try:
        # Valider at "rpm" og "fuel" finnes i dataene
        if "rpm" not in data or "fuel" not in data:
            raise ValueError("Data må inneholde 'rpm' og 'fuel'")
        if len(data["rpm"]) != len(data["fuel"]):
            raise ValueError("Antall RPM-verdier og drivstoffverdier må være likt")
        if any(f < 0 for f in data["fuel"]):
            raise ValueError("Drivstofforbruk kan ikke være negativt")
        if any(r <= 0 for r in data["rpm"]):
            raise ValueError("RPM må være større enn 0")

        # Oppdater globale kalibreringsdata
        calibration_data["rpm"] = data["rpm"]
        calibration_data["fuel"] = data["fuel"]

        # Returner suksessrespons
        return jsonify({
            "status": "success",
            "message": "Kalibrering oppdatert",
            "data": data
        })
    except Exception as e:
        # Returner feilmelding
        return jsonify({"status": "error", "message": str(e)}), 400

# Endepunkt for beregning av drivstofforbruk
@app.route("/calculate", methods=["GET"])
def calculate():
    try:
        # Hent RPM og hastighet fra spørringsparametere
        rpm = float(request.args.get("rpm", 850))
        speed = float(request.args.get("speed", 0))

        logging.debug(f"RPM: {rpm}, Speed: {speed}")

        # Interpoler drivstofforbruk basert på RPM
        fuel = np.interp(rpm, calibration_data["rpm"], calibration_data["fuel"])

        # Juster drivstofforbruk basert på hastighet (for eksempel, høyere hastighet kan gi lavere effektivitet)
        if speed > 0:
            fuel_efficiency_factor = 1 - (speed / 200)  # Juster 200 som maks hastighet
            fuel = max(fuel * fuel_efficiency_factor, 0)

        # Returner beregnet drivstofforbruk
        return jsonify({"rpm": rpm, "speed": speed, "fuel": fuel})
    except Exception as e:
        # Returner feilmelding
        return jsonify({"status": "error", "message": str(e)}), 400

# Tjen statiske filer direkte fra static-mappen
@app.route('/<path:path>')
def serve_static_files(path):
    return send_from_directory("static", path)

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))  # Standard til 5000 hvis ingen PORT er satt
    app.run(host="0.0.0.0", port=port)
