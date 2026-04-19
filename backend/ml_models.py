"""
Machine Learning models for predictive analytics
"""

import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
from typing import Dict, List, Tuple, Optional
import json
import os

# Model storage paths
MODEL_DIR = "models"
os.makedirs(MODEL_DIR, exist_ok=True)


class MLPipeline:
    """Machine Learning pipeline for student performance prediction"""

    def __init__(self):
        self.les_model = RandomForestRegressor(
            n_estimators=100, random_state=42)
        self.risk_model = LogisticRegression(random_state=42)
        self.scaler = StandardScaler()
        self.feature_names = [
            "student_marks",
            "attendance",
            "internal_assessments",
            "lab_performance",
            "assignment_scores",
            "study_hours",
            "concept_mastery",
        ]
        self.is_trained = False

    def preprocess_features(self, data: Dict) -> np.ndarray:
        """
        Preprocess student data: missing value handling, normalization, weighting
        """
        # Handle missing values
        features = np.array(
            [
                data.get("student_marks", 0),
                data.get("attendance", 0),
                data.get("internal_assessments", 0) * 5,  # Scale 20 to 100
                data.get("lab_performance", 0) * 4,       # Scale 25 to 100
                data.get("assignment_scores", 0) * 10,    # Scale 10 to 100
                data.get("study_hours", 0),
                data.get("concept_mastery", 0),
            ],
            dtype=float,
        )

        # Replace NaN with median
        features = np.nan_to_num(features, nan=np.nanmean(features))

        # Feature weighting based on importance
        weights = np.array(
            [0.25, 0.10, 0.15, 0.15, 0.15, 0.12, 0.08]
        )  # Total: 1.0
        weighted_features = features * weights

        # Normalization/Scaling (0-100 scale)
        normalized = np.clip(weighted_features, 0, 100)

        return normalized.reshape(1, -1)

    def calculate_les(
        self, features: np.ndarray
    ) -> Tuple[float, Dict]:
        """
        Calculate Learning Efficiency Score (LES)
        LES = weighted average of performance metrics
        Range: 0-100
        """
        if not self.is_trained:
            # Use simple calculation if model not trained
            les = float(np.mean(features))
        else:
            les = float(self.les_model.predict(features)[0])

        # Ensure LES is in 0-100 range
        les = np.clip(les, 0, 100)

        metrics = {
            "les": les,
            "r_squared": 0.0,
            "rmse": 0.0,
        }

        return les, metrics

    def predict_risk_level(self, features: np.ndarray) -> Dict:
        """
        Predict risk level: Low (0), Moderate (1), High (2)
        Based on LES score
        """
        les = float(np.mean(features))

        if les >= 70:
            risk_level = "low"
            risk_score = 0
        elif les >= 50:
            risk_level = "moderate"
            risk_score = 1
        else:
            risk_level = "high"
            risk_score = 2

        return {
            "risk_level": risk_level,
            "risk_score": risk_score,
            "les": les,
        }

    def train(self, X: List[Dict], y_les: List[float], y_risk: List[int]):
        """Train the ML models"""
        try:
            # Preprocess features
            X_processed = np.vstack([self.preprocess_features(x) for x in X])
            X_scaled = self.scaler.fit_transform(X_processed)

            # Train LES model
            self.les_model.fit(X_scaled, y_les)
            les_scores = cross_val_score(
                self.les_model, X_scaled, y_les, cv=5, scoring="r2"
            )

            # Train risk model
            self.risk_model.fit(X_scaled, y_risk)
            risk_scores = cross_val_score(
                self.risk_model, X_scaled, y_risk, cv=5, scoring="accuracy"
            )

            self.is_trained = True

            return {
                "status": "trained",
                "les_r2": float(np.mean(les_scores)),
                "risk_accuracy": float(np.mean(risk_scores)),
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def predict(self, student_data: Dict) -> Dict:
        """Make predictions for a student"""
        features = self.preprocess_features(student_data)
        X_scaled = self.scaler.transform(features)

        les, metrics = self.calculate_les(features)
        risk_prediction = self.predict_risk_level(features)

        # Features for LES computation
        los_mapping = {
            "student_marks": 0.25,
            "attendance": 0.10,
            "internal_assessments": 0.15,
            "lab_performance": 0.15,
            "assignment_scores": 0.15,
            "study_hours": 0.12,
            "concept_mastery": 0.08,
        }

        return {
            "les": les,
            "risk_level": risk_prediction["risk_level"],
            "metrics": metrics,
            "los_mapping": los_mapping,
        }


# Global ML pipeline instance
ml_pipeline = MLPipeline()
