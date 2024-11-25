from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import numpy as np
import logging

# Opprett Flask-applikasjonen
app = Flask(__name__, static_url_path='', static_folder='static')
CORS(app)  # Tillat CORS for eksterne forespørsler

# Logging for debugging
logging.basicConfig(level=logging.DEBUG)

# Globale kalibreringsdata (standardverdier)
calibration_data = {
    "rpm": [850, 3200, 4500, 5850],
    "fuel": [0.8, 10.0, 16.0, 22.5],
    "speed": [0, 20, 40, 60]
}

# Hjemmerute for å serve index.html fra static-mappen
@app.route("/")
def serve_frontend():
    return send_from_directory("static", "index.html")

# Endepunkt for kalibrering
@app.route("/calibrate", methods=["POST"])
def calibrate():
    data = request.json  # Hent JSON-data fra forespørselen
    try:
        # Valider data
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

        logging.info("Kalibrering oppdatert.")
        return jsonify({
            "status": "success",
            "message": "Kalibrering oppdatert",
            "data": calibration_data
        })
    except Exception as e:
        logging.error(f"Kalibreringsfeil: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/calculate", methods=["GET"])
def calculate():
    try:
        speed = float(request.args.get("speed", 0))  # Hastighet i km/t
        unit = request.args.get("unit", "kmh")  # Enhet: "kmh" eller "knots"

        # Konverter hastighet til km/t hvis nødvendig
        if unit == "knots":
            speed *= 1.852

        # Beregn RPM som lineær funksjon av hastighet
        min_speed, max_speed = min(calibration_data["speed"]), max(calibration_data["speed"])
        min_rpm, max_rpm = min(calibration_data["rpm"]), max(calibration_data["rpm"])
        rpm = np.interp(speed, calibration_data["speed"], calibration_data["rpm"])  # Interpoler RPM basert på hastighet

        # Interpoler drivstofforbruk basert på beregnet RPM
        fuel_per_hour = np.interp(rpm, calibration_data["rpm"], calibration_data["fuel"])

        # Beregn drivstofforbruk per distanse (L/km)
        fuel_per_distance = fuel_per_hour / max(speed, 1e-5)  # Unngå deling på null

        return jsonify({
            "rpm": rpm,
            "speed": speed,
            "unit": unit,
            "fuel_per_hour": fuel_per_hour,
            "fuel_per_distance": fuel_per_distance
        })
    except Exception as e:
        logging.error(f"Beregning feilet: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400



# Serve statiske filer direkte fra static-mappen
@app.route('/<path:path>')
def serve_static_files(path):
    return send_from_directory("static", path)

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
