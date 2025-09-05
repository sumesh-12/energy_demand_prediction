import os
import sqlite3
import numpy as np
import pandas as pd
import joblib
from flask import Flask, request, jsonify
from tensorflow.keras.models import load_model
import datetime
import traceback

# --- APP SETUP ---
app = Flask(__name__)

# --- DATABASE SETUP (SQLite) ---
DATABASE_FILE = 'database.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row 
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        );
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            message TEXT NOT NULL
        );
    ''')
    conn.commit()
    conn.close()
    print("Database initialized successfully!")

# --- LOAD MACHINE LEARNING MODELS ---
try:
    model_path = os.path.join('model', 'model.keras')
    features_scaler_path = os.path.join('model', 'scaler_features.joblib')
    target_scaler_path = os.path.join('model', 'target_scaler.joblib')

    prediction_model = load_model(model_path)
    features_scalers_dict = joblib.load(features_scaler_path)
    target_scaler = joblib.load(target_scaler_path)
    
    print("Machine learning models loaded successfully!")
except Exception as e:
    print(f"Error loading machine learning models: {e}")
    prediction_model, features_scalers_dict, target_scaler = None, None, None


# --- ROUTES ---

@app.route("/")
def home():
    return {"message": "Backend is running!"}

@app.route("/healthz")
def healthz():
    return {"ok": True}

# --- PREDICTION ROUTE ---
@app.route("/predict", methods=["POST"])
def predict():
    if not all([prediction_model, features_scalers_dict, target_scaler]):
        return jsonify({'success': False, 'error': 'Models not loaded'}), 500

    try:
        data = request.json
        if not data:
            return jsonify({"error": "No input provided"}), 400

        day = int(data.get("day"))
        month = int(data.get("month"))
        year = datetime.datetime.now().year

        try:
            prediction_date = datetime.date(year, month, day)
        except ValueError:
            return jsonify({"success": False, "error": "Invalid date provided."}), 400

        dayofweek = prediction_date.weekday()
        is_weekend = 1 if dayofweek >= 5 else 0
        
        # --- Simple placeholders ---
        seasonality_placeholders = {
            1: {'temp': 5.0, 'load': 16000}, 2: {'temp': 6.0, 'load': 15800},
            3: {'temp': 9.0, 'load': 15500}, 4: {'temp': 12.0, 'load': 15000},
            5: {'temp': 16.0, 'load': 14500}, 6: {'temp': 20.0, 'load': 14800},
            7: {'temp': 25.0, 'load': 15000}, 8: {'temp': 24.0, 'load': 14900},
            9: {'temp': 19.0, 'load': 15200}, 10: {'temp': 14.0, 'load': 15600},
            11: {'temp': 8.0, 'load': 15900}, 12: {'temp': 6.0, 'load': 16200}
        }
        
        monthly_placeholders = seasonality_placeholders.get(month, {'temp': 15.0, 'load': 15000})
        avg_temp, avg_load, avg_humidity, avg_wind = monthly_placeholders['temp'], monthly_placeholders['load'], 60.0, 10.0

        # --- Features list ---
        feature_columns = [
            'temperature', 'humidity', 'wind_speed', 'is_weekend', 'is_holiday', 'hour', 
            'dayofweek', 'month', 'rolling_mean_24h', 'rolling_std_24h', 'rolling_mean_168h', 
            'rolling_std_168h', 'load_diff_1', 'sin_hour', 'cos_hour', 'sin_dayofweek', 
            'cos_dayofweek', 'sin_month', 'cos_month'
        ]
        feature_columns.extend([f'load_lag_{i}' for i in range(1, 25)])
        feature_columns.extend([f'temp_lag_{i}' for i in range(1, 4)])
        feature_columns.extend([f'wind_lag_{i}' for i in range(1, 4)])
        feature_columns.append('humidity_lag_1')

        predictions_for_day = []

        for hour in range(24):
            input_data = {
                'temperature': avg_temp, 'humidity': avg_humidity, 'wind_speed': avg_wind, 'is_weekend': is_weekend, 
                'is_holiday': 0, 'hour': hour, 'dayofweek': dayofweek, 'month': month, 'rolling_mean_24h': avg_load, 
                'rolling_std_24h': 500, 'rolling_mean_168h': avg_load, 'rolling_std_168h': 1000, 'load_diff_1': 0,
                'sin_hour': np.sin(2*np.pi*hour/24), 'cos_hour': np.cos(2*np.pi*hour/24),
                'sin_dayofweek': np.sin(2*np.pi*dayofweek/7), 'cos_dayofweek': np.cos(2*np.pi*dayofweek/7),
                'sin_month': np.sin(2*np.pi*month/12), 'cos_month': np.cos(2*np.pi*month/12),
            }
            for i in range(1, 25): input_data[f'load_lag_{i}'] = avg_load
            for i in range(1, 4): input_data[f'temp_lag_{i}'] = avg_temp
            for i in range(1, 4): input_data[f'wind_lag_{i}'] = avg_wind
            input_data['humidity_lag_1'] = avg_humidity

            input_df = pd.DataFrame([input_data], columns=feature_columns)
            
            # scale using per-feature scalers
            scaled_df = input_df.copy()
            for col in input_df.columns:
                if col in features_scalers_dict:
                    scaler = features_scalers_dict[col]
                    col_data = scaled_df[[col]].astype(float)
                    scaled_df[col] = scaler.transform(col_data)

            scaled_features = scaled_df.values
            sequence_length = 168
            reshaped_features = np.tile(scaled_features, (sequence_length, 1))
            reshaped_features = reshaped_features.reshape(1, sequence_length, scaled_features.shape[1])

            prediction_scaled = prediction_model.predict(reshaped_features, verbose=0)
            prediction_actual = target_scaler.inverse_transform(prediction_scaled)
            final_prediction = np.exp(prediction_actual[0][0])
            predictions_for_day.append(final_prediction)

        peak_load = max(predictions_for_day)
        peak_hour = predictions_for_day.index(peak_load)

        return jsonify({
            'success': True,
            'peak_load': float(peak_load),
            'peak_hour': peak_hour,
            'hourly_data': [float(p) for p in predictions_for_day]
        })

    except Exception as e:
        print(f"Error during prediction: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': 'Prediction failed'}), 500


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)
