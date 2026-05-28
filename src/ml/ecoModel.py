# =========================================================
# SIMPLE AI ECO ANALYSIS MODEL
# READY FOR NODE.JS SPAWN()
# =========================================================

# Install:
# pip install ultralytics opencv-python pillow

# =========================================================
# IMPORTS
# =========================================================

from ultralytics import YOLO
from PIL import Image

import cv2
import numpy as np

import sys
import json

# =========================================================
# LOAD MODEL
# =========================================================

MODEL = YOLO("yolov8m.pt")

# =========================================================
# CONFIG
# =========================================================

CONFIDENCE = 0.45

IMAGE_SIZE = 960

BLUR_THRESHOLD = 60

# =========================================================
# IMPORTANT OBJECTS
# =========================================================

IMPORTANT_OBJECTS = {

    # recyclable
    "bottle": "recyclable",
    "cup": "recyclable",
    "book": "recyclable",

    # organic
    "banana": "organic",
    "apple": "organic",
    "orange": "organic",

    # disposal
    "trash can": "trash_bin",

    # electronics
    "cell phone": "electronics",
    "laptop": "electronics",
    "tv": "electronics",
}

# =========================================================
# LOAD IMAGE
# =========================================================

def load_image(image_path):

    image = Image.open(image_path)

    return image.convert("RGB")

# =========================================================
# BLUR CHECK
# =========================================================

def is_blurry(image):

    gray = cv2.cvtColor(
        np.array(image),
        cv2.COLOR_RGB2GRAY
    )

    variance = cv2.Laplacian(
        gray,
        cv2.CV_64F
    ).var()

    return variance < BLUR_THRESHOLD

# =========================================================
# ANIMATED CHECK
# =========================================================

def is_animated(image):

    return getattr(image, "is_animated", False)

# =========================================================
# YOLO DETECTION
# =========================================================

def detect_objects(image_path):

    results = MODEL(

        image_path,

        imgsz=IMAGE_SIZE,

        conf=CONFIDENCE,

        verbose=False
    )

    result = results[0]

    objects = []

    existing = []

    for box in result.boxes:

        class_id = int(box.cls[0])

        class_name = result.names[class_id]

        confidence = float(box.conf[0])

        # ignore unrelated objects
        if class_name not in IMPORTANT_OBJECTS:
            continue

        # prevent duplicates
        if class_name in existing:
            continue

        existing.append(class_name)

        objects.append({

            "name": class_name,

            "category":
            IMPORTANT_OBJECTS[class_name],

            "confidence":
            round(confidence, 2)
        })

    return objects

# =========================================================
# OPENCV SCENE ANALYSIS
# =========================================================

def analyze_scene(image):

    image_cv = cv2.cvtColor(
        np.array(image),
        cv2.COLOR_RGB2BGR
    )

    gray = cv2.cvtColor(
        image_cv,
        cv2.COLOR_BGR2GRAY
    )

    # =====================================================
    # EDGE DENSITY
    # =====================================================

    edges = cv2.Canny(gray, 100, 200)

    edge_density = np.mean(edges) / 255.0

    # =====================================================
    # BRIGHTNESS
    # =====================================================

    brightness = np.mean(gray)

    # =====================================================
    # SHARPNESS
    # =====================================================

    sharpness = cv2.Laplacian(
        gray,
        cv2.CV_64F
    ).var()

    return {

        "edgeDensity":
        round(edge_density, 3),

        "brightness":
        round(brightness, 2),

        "sharpness":
        round(sharpness, 2),
    }

# =========================================================
# SCORE ENGINE
# =========================================================

def calculate_score(objects, scene):

    score = 50

    recyclable = 0

    organic = 0

    electronics = 0

    trash_bins = 0

    # =====================================================
    # OBJECT ANALYSIS
    # =====================================================

    for obj in objects:

        category = obj["category"]

        if category == "recyclable":

            recyclable += 1

        elif category == "organic":

            organic += 1

        elif category == "electronics":

            electronics += 1

        elif category == "trash_bin":

            trash_bins += 1

    # =====================================================
    # POSITIVE SIGNALS
    # =====================================================

    score += recyclable * 6

    score += organic * 2

    if trash_bins >= 1:

        score += 18

    if trash_bins >= 3:

        score += 10

    # =====================================================
    # SCENE QUALITY
    # =====================================================

    edge_density = scene["edgeDensity"]

    brightness = scene["brightness"]

    sharpness = scene["sharpness"]

    # clean environment
    if edge_density < 0.12:

        score += 15

    # moderate clutter
    elif edge_density < 0.20:

        score += 5

    # heavy clutter
    else:

        score -= 15

    # brightness
    if brightness > 80:

        score += 5

    # blur penalty
    if sharpness < 80:

        score -= 10

    # =====================================================
    # NEGATIVE SIGNALS
    # =====================================================

    if recyclable and organic:

        score -= 5

    if electronics:

        score -= 12

    # =====================================================
    # NORMALIZE
    # =====================================================

    score = max(0, min(100, int(score)))

    return {

        "score": score,

        "recyclable": recyclable,

        "organic": organic,

        "electronics": electronics,

        "trash_bins": trash_bins,
    }

# =========================================================
# CLASSIFICATION
# =========================================================

def classify(score):

    if score >= 75:

        return "GOOD"

    elif score >= 45:

        return "MEDIUM"

    return "BAD"

# =========================================================
# FEEDBACK
# =========================================================

def generate_feedback(summary, scene):

    feedback = []

    if summary["trash_bins"] >= 1:

        feedback.append(
            "Waste disposal awareness detected."
        )

    if summary["recyclable"]:

        feedback.append(
            "Recyclable materials detected."
        )

    if summary["organic"]:

        feedback.append(
            "Organic waste detected."
        )

    if summary["electronics"]:

        feedback.append(
            "Electronic waste requires proper disposal."
        )

    # =====================================================
    # SCENE FEEDBACK
    # =====================================================

    edge_density = scene["edgeDensity"]

    if edge_density < 0.12:

        feedback.append(
            "Clean and organized environment detected."
        )

    elif edge_density < 0.20:

        feedback.append(
            "Moderately cluttered environment detected."
        )

    else:

        feedback.append(
            "Highly cluttered waste environment detected."
        )

    return feedback

# =========================================================
# MAIN ANALYSIS
# =========================================================

def analyze_image(image_path):

    try:

        image = load_image(image_path)

        # =================================================
        # VALIDATION
        # =================================================

        if is_blurry(image):

            return {

                "classification": "INVALID",

                "score": 0,

                "gp": 0,

                "reason":
                "Blurry image detected."
            }

        if is_animated(image):

            return {

                "classification": "INVALID",

                "score": 0,

                "gp": 0,

                "reason":
                "Animated image not allowed."
            }

        # =================================================
        # YOLO
        # =================================================

        objects = detect_objects(image_path)

        # =================================================
        # SCENE ANALYSIS
        # =================================================

        scene = analyze_scene(image)

        # =================================================
        # INVALID CHECK
        # =================================================

        if not objects and scene["edgeDensity"] < 0.03:

            return {

                "classification": "INVALID",

                "score": 0,

                "gp": 0,

                "reason":
                "No meaningful waste content detected."
            }

        # =================================================
        # SCORE
        # =================================================

        summary = calculate_score(

            objects,

            scene
        )

        score = summary["score"]

        classification = classify(score)

        # =================================================
        # GP
        # =================================================

        gp = int(score // 4)

        # =================================================
        # FEEDBACK
        # =================================================

        feedback = generate_feedback(

            summary,

            scene
        )

        # =================================================
        # FINAL RESULT
        # =================================================

        return {

            "classification":
            classification,

            "score":
            score,

            "gp":
            gp,

            "sceneAnalysis":
            scene,

            "detectedObjects":
            objects,

            "feedback":
            feedback,
        }

    except Exception as error:

        return {

            "classification": "INVALID",

            "score": 0,

            "gp": 0,

            "reason": str(error)
        }

# =========================================================
# SPAWN SUPPORT
# =========================================================

if __name__ == "__main__":

    # image path from Node.js spawn()
    image_path = sys.argv[1]

    # run analysis
    result = analyze_image(image_path)

    # IMPORTANT:
    # only print JSON
    print(json.dumps(result))