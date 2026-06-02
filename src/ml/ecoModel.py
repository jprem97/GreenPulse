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

CONFIDENCE              = 0.45
IMAGE_SIZE              = 960
BLUR_THRESHOLD          = 60
MIN_WASTE_CONFIDENCE_SUM = 0.60

# =========================================================
# WASTE OBJECT TAXONOMY
# =========================================================

IMPORTANT_OBJECTS = {
    "bottle":     "recyclable",
    "cup":        "recyclable",
    "book":       "recyclable",
    "banana":     "organic",
    "apple":      "organic",
    "orange":     "organic",
    "trash can":  "trash_bin",
    "cell phone": "electronics",
    "laptop":     "electronics",
    "tv":         "electronics",
}

WASTE_CATEGORIES = {"recyclable", "organic", "electronics", "trash_bin"}

# =========================================================
# NON-WASTE CONTEXT PATTERNS
# If ANY of these object combos appear WITHOUT a trash_bin
# the scene is rejected as non-waste context.
# =========================================================

NON_WASTE_CONTEXT_PATTERNS = [
    ({"banana", "apple", "orange"}, "Fresh produce arrangement — not a waste scene."),
    ({"banana", "bottle"},          "Produce + clean container — not a waste scene."),
    ({"apple",  "cup"},             "Produce + clean container — not a waste scene."),
    ({"laptop", "cup"},             "Office/desk setup — not a waste scene."),
    ({"laptop", "cell phone"},      "Personal device setup — not a waste scene."),
    ({"laptop", "tv"},              "Consumer electronics display — not a waste scene."),
]

# =========================================================
# HELPERS
# =========================================================

def invalid(reason):
    return {
        "classification": "INVALID",
        "score":          0,
        "gp":             0,
        "reason":         reason,
    }

def load_image(image_path):
    return Image.open(image_path).convert("RGB")

def is_blurry(image):
    gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var() < BLUR_THRESHOLD

def is_animated(image):
    return getattr(image, "is_animated", False)

# =========================================================
# YOLO DETECTION
# Returns [] if nothing recognised in IMPORTANT_OBJECTS
# =========================================================

def detect_objects(image_path):

    results = MODEL(image_path, imgsz=IMAGE_SIZE, conf=CONFIDENCE, verbose=False)
    result  = results[0]

    objects  = []
    existing = set()

    for box in result.boxes:
        class_id   = int(box.cls[0])
        class_name = result.names[class_id]
        confidence = float(box.conf[0])

        if class_name not in IMPORTANT_OBJECTS:
            continue
        if class_name in existing:
            continue

        existing.add(class_name)
        objects.append({
            "name":       class_name,
            "category":   IMPORTANT_OBJECTS[class_name],
            "confidence": round(confidence, 2),
        })

    return objects   # empty list [] if nothing matched

# =========================================================
# SCENE ANALYSIS
# =========================================================

def analyze_scene(image):
    image_cv     = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    gray         = cv2.cvtColor(image_cv, cv2.COLOR_BGR2GRAY)
    edges        = cv2.Canny(gray, 100, 200)
    edge_density = np.mean(edges) / 255.0
    brightness   = np.mean(gray)
    sharpness    = cv2.Laplacian(gray, cv2.CV_64F).var()
    return {
        "edgeDensity": round(edge_density, 3),
        "brightness":  round(brightness, 2),
        "sharpness":   round(sharpness, 2),
    }

# =========================================================
# WASTE CONTEXT VALIDATION
# Returns (True, None) or (False, reason_string)
# =========================================================

def validate_waste_context(objects, scene):

    # Gate 1 — array is empty → nothing waste-related detected
    if len(objects) == 0:
        return False, "Detected objects array is empty — no waste-related objects found."

    # Gate 2 — only waste-category objects count
    waste_objects = [o for o in objects if o["category"] in WASTE_CATEGORIES]
    if len(waste_objects) == 0:
        return False, "No waste-category objects detected."

    # Gate 3 — confidence sum must clear minimum threshold
    confidence_sum = sum(o["confidence"] for o in waste_objects)
    if confidence_sum < MIN_WASTE_CONFIDENCE_SUM:
        return False, (
            f"Waste signal too weak "
            f"(confidence {confidence_sum:.2f} < {MIN_WASTE_CONFIDENCE_SUM})."
        )

    # Gate 4 — context pattern check (skip if trash_bin present)
    has_bin      = any(o["category"] == "trash_bin" for o in objects)
    detected_set = {o["name"] for o in objects}

    if not has_bin:
        for pattern_set, reason in NON_WASTE_CONTEXT_PATTERNS:
            if pattern_set.issubset(detected_set):
                return False, reason

    # Gate 5 — reject clean product/studio photos (skip if trash_bin present)
    if not has_bin:
        if scene["edgeDensity"] < 0.04 and scene["brightness"] > 160:
            return False, "Scene looks like a clean product/studio photo — not a waste scene."

    return True, None

# =========================================================
# SCORE ENGINE
# Base score 0 — earned only from waste evidence.
# Scene is a modifier capped at ±15.
# =========================================================

def calculate_score(objects, scene):

    score       = 0
    recyclable  = 0
    organic     = 0
    electronics = 0
    trash_bins  = 0

    for obj in objects:
        cat = obj["category"]
        if   cat == "recyclable":  recyclable  += 1
        elif cat == "organic":     organic     += 1
        elif cat == "electronics": electronics += 1
        elif cat == "trash_bin":   trash_bins  += 1

    # waste object points
    score += trash_bins * 28
    score += recyclable * 8
    score += organic    * 4
    if trash_bins >= 3:
        score += 8

    # scene modifier — hard capped
    sd = 0
    if   scene["edgeDensity"] < 0.12: sd += 10
    elif scene["edgeDensity"] < 0.20: sd += 3
    else:                             sd -= 10
    if scene["brightness"] > 80:      sd += 3
    if scene["sharpness"]  < 80:      sd -= 8
    score += max(-15, min(15, sd))

    # penalties
    if recyclable and organic: score -= 5
    if electronics:            score -= 12

    return {
        "score":       max(0, min(100, int(score))),
        "recyclable":  recyclable,
        "organic":     organic,
        "electronics": electronics,
        "trash_bins":  trash_bins,
    }

# =========================================================
# CLASSIFICATION — four classes only
# =========================================================

def classify(score):
    if score >= 75: return "GOOD"
    if score >= 45: return "MEDIUM"
    if score >= 20: return "BAD"
    return "INVALID"

# =========================================================
# FEEDBACK
# =========================================================

def generate_feedback(summary, scene):
    feedback = []
    if summary["trash_bins"] >= 1:
        feedback.append("Waste disposal infrastructure detected.")
    if summary["recyclable"]:
        feedback.append("Recyclable materials detected.")
    if summary["organic"]:
        feedback.append("Organic waste detected.")
    if summary["electronics"]:
        feedback.append("Electronic waste detected — requires proper e-waste disposal.")
    if summary["recyclable"] and summary["organic"]:
        feedback.append("Mixed waste — consider separating recyclable and organic waste.")
    ed = scene["edgeDensity"]
    if   ed < 0.12: feedback.append("Clean and organized environment detected.")
    elif ed < 0.20: feedback.append("Moderately cluttered environment detected.")
    else:           feedback.append("Highly cluttered waste environment detected.")
    return feedback

# =========================================================
# MAIN ANALYSIS
# =========================================================

def analyze_image(image_path):

    try:

        image = load_image(image_path)

        # --------------------------------------------------
        # STEP 1 — image quality
        # --------------------------------------------------

        if is_blurry(image):
            return invalid("Blurry image detected.")

        if is_animated(image):
            return invalid("Animated images are not allowed.")

        # --------------------------------------------------
        # STEP 2 — YOLO detection
        # --------------------------------------------------

        objects = detect_objects(image_path)

        # *** EMPTY ARRAY CHECK ***
        # detect_objects returns [] when:
        #   - YOLO found nothing at all, OR
        #   - YOLO found objects but none matched IMPORTANT_OBJECTS
        # Either way → INVALID immediately.
        if len(objects) == 0:
            return invalid("No recognisable objects detected in the image.")

        # --------------------------------------------------
        # STEP 3 — scene analysis (modifier only)
        # --------------------------------------------------

        scene = analyze_scene(image)

        # --------------------------------------------------
        # STEP 4 — waste context validation (5 gates)
        # --------------------------------------------------

        is_valid, rejection_reason = validate_waste_context(objects, scene)

        if not is_valid:
            return invalid(rejection_reason)

        # --------------------------------------------------
        # STEP 5 — scoring
        # --------------------------------------------------

        summary        = calculate_score(objects, scene)
        score          = summary["score"]
        classification = classify(score)

        if score == 0:
            return invalid("Waste detected but score is zero after penalties.")

        # --------------------------------------------------
        # STEP 6 — green points (GOOD and MEDIUM only)
        # --------------------------------------------------

        gp = 0 if classification in ("BAD", "INVALID") else int(score // 4)

        # --------------------------------------------------
        # STEP 7 — feedback
        # --------------------------------------------------

        feedback = generate_feedback(summary, scene)

        # --------------------------------------------------
        # RESULT
        # --------------------------------------------------

        return {
            "classification":  classification,
            "score":           score,
            "gp":              gp,
            "sceneAnalysis":   scene,
            "detectedObjects": objects,
            "feedback":        feedback,
        }

    except Exception as error:
        return invalid(str(error))

# =========================================================
# SPAWN ENTRY POINT
# Node.js: spawn('python', ['eco_analysis.py', imagePath])
# Only JSON is ever printed to stdout.
# =========================================================

if __name__ == "__main__":

    if len(sys.argv) < 2:
        print(json.dumps(invalid("No image path provided.")))
        sys.exit(1)

    print(json.dumps(analyze_image(sys.argv[1])))