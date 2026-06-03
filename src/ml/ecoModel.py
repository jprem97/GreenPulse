from ultralytics import YOLO
from PIL import Image, ImageEnhance

import cv2
import numpy as np
import sys
import json
import tempfile
import os

MODEL = YOLO("yolov8m.pt")

CONFIDENCE               = 0.35
IMAGE_SIZE               = 1280
BLUR_THRESHOLD           = 28
MIN_WASTE_CONFIDENCE_SUM = 0.45

BRIGHTNESS_FACTOR = 1.40
CONTRAST_FACTOR   = 1.30
SHARPNESS_FACTOR  = 1.80

WASTE_OBJECTS = {
    "bottle":     ("recyclable", "recycling", 3),
    "wine glass": ("recyclable", "recycling", 3),
    "vase":       ("recyclable", "recycling", 2),
    "cup":        ("recyclable", "recycling", 2),
    "bowl":       ("recyclable", "recycling", 1),
    "book":       ("recyclable", "recycling", 2),
    "banana":     ("organic", "compost", 2),
    "apple":      ("organic", "compost", 2),
    "orange":     ("organic", "compost", 2),
    "carrot":     ("organic", "compost", 2),
    "broccoli":   ("organic", "compost", 2),
    "sandwich":   ("organic", "compost", 1),
    "pizza":      ("organic", "compost", 1),
    "hot dog":    ("organic", "compost", 1),
    "donut":      ("organic", "compost", 1),
    "cake":       ("organic", "compost", 1),
    "laptop":     ("electronics", "ewaste", -1),
    "tv":         ("electronics", "ewaste", -1),
    "cell phone": ("electronics", "ewaste", -1),
    "mouse":      ("electronics", "ewaste", -1),
    "keyboard":   ("electronics", "ewaste", -1),
    "remote":     ("electronics", "ewaste", -1),
}

WASTE_CATEGORIES = {"recyclable", "organic", "electronics"}

NON_WASTE_CONTEXT_PATTERNS = [
    ({"banana", "apple", "orange"},  "Fresh produce arrangement — not a waste scene."),
    ({"laptop", "mouse"},            "Workstation setup — not a waste scene."),
    ({"laptop", "keyboard"},         "Workstation setup — not a waste scene."),
    ({"laptop", "cell phone"},       "Personal devices — not a waste scene."),
    ({"tv", "remote"},               "Home entertainment setup — not a waste scene."),
    ({"pizza", "cup"},               "Food service scene — not a waste scene."),
    ({"sandwich", "cup"},            "Food service scene — not a waste scene."),
    ({"cake", "cup"},                "Food service scene — not a waste scene."),
]

def invalid(reason):
    return {
        "classification": "INVALID",
        "score":          0,
        "gp":             0,
        "reason":         reason,
    }

def enhance_image(image):
    image = ImageEnhance.Brightness(image).enhance(BRIGHTNESS_FACTOR)
    image = ImageEnhance.Contrast(image).enhance(CONTRAST_FACTOR)
    image = ImageEnhance.Sharpness(image).enhance(SHARPNESS_FACTOR)
    return image

def load_image(image_path):
    original = Image.open(image_path).convert("RGB")
    enhanced = enhance_image(original)
    return original, enhanced

def is_blurry(image):
    gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var() < BLUR_THRESHOLD

def is_animated(image):
    return getattr(image, "is_animated", False)

def detect_objects(enhanced_image):
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp_path = tmp.name
    enhanced_image.save(tmp_path, format="JPEG", quality=95)

    try:
        results = MODEL(tmp_path, imgsz=IMAGE_SIZE, conf=CONFIDENCE, verbose=False)
    finally:
        os.unlink(tmp_path)

    result  = results[0]
    objects = []
    counts  = {}

    for box in result.boxes:
        class_id   = int(box.cls[0])
        class_name = result.names[class_id]
        confidence = float(box.conf[0])

        if class_name not in WASTE_OBJECTS:
            continue

        counts[class_name] = counts.get(class_name, 0) + 1
        category, bin_type, seg_val = WASTE_OBJECTS[class_name]

        objects.append({
            "name":       class_name,
            "category":   category,
            "bin_type":   bin_type,
            "confidence": round(confidence, 2),
        })

    return objects, counts

def analyze_scene(image):
    image_cv     = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    gray         = cv2.cvtColor(image_cv, cv2.COLOR_BGR2GRAY)
    edges        = cv2.Canny(gray, 100, 200)
    edge_density = np.mean(edges) / 255.0
    brightness   = np.mean(gray)
    sharpness    = cv2.Laplacian(gray, cv2.CV_64F).var()

    hsv         = cv2.cvtColor(image_cv, cv2.COLOR_BGR2HSV)
    hue_std     = float(np.std(hsv[:, :, 0]))

    return {
        "edgeDensity": round(edge_density, 3),
        "brightness":  round(brightness, 2),
        "sharpness":   round(sharpness, 2),
        "hueVariance": round(hue_std, 2),
    }

def validate_waste_context(objects, counts, scene):
    if len(objects) == 0:
        return False, "No recognisable waste objects detected in the image."

    waste_objects = [o for o in objects if o["category"] in WASTE_CATEGORIES]
    if len(waste_objects) == 0:
        return False, "No waste-category objects detected."

    confidence_sum = sum(o["confidence"] for o in waste_objects)
    if confidence_sum < MIN_WASTE_CONFIDENCE_SUM:
        return False, (
            f"Waste signal too weak "
            f"(confidence {confidence_sum:.2f} < {MIN_WASTE_CONFIDENCE_SUM})."
        )

    detected_set = {o["name"] for o in objects}
    is_cluttered = scene["edgeDensity"] > 0.12

    if not is_cluttered:
        for pattern_set, reason in NON_WASTE_CONTEXT_PATTERNS:
            if pattern_set.issubset(detected_set):
                return False, reason

    if not is_cluttered:
        if scene["edgeDensity"] < 0.04 and scene["brightness"] > 160:
            return False, "Scene appears to be a clean product photo — not a waste scene."

    return True, None

def calculate_segregation_score(objects, counts, scene):
    if not objects:
        return {"score": 0, "recyclable": 0, "organic": 0,
                "electronics": 0, "totalDetections": 0}

    recyclable_count  = sum(1 for o in objects if o["category"] == "recyclable")
    organic_count     = sum(1 for o in objects if o["category"] == "organic")
    electronics_count = sum(1 for o in objects if o["category"] == "electronics")
    total_detections  = len(objects)

    waste_type_groups = sum([recyclable_count > 0, organic_count > 0])

    score = 0
    for name, count in counts.items():
        if name not in WASTE_OBJECTS:
            continue
        _, _, seg_val = WASTE_OBJECTS[name]
        if seg_val > 0:
            score += seg_val * count

    max_single_type_count = max(counts.values()) if counts else 0

    if max_single_type_count >= 5:
        score += 35
    elif max_single_type_count >= 3:
        score += 20
    elif max_single_type_count >= 2:
        score += 8

    multi_type_sorted = sum(1 for name, cnt in counts.items()
                            if cnt >= 2 and WASTE_OBJECTS.get(name, (None,None,0))[2] > 0)
    if multi_type_sorted >= 3:
        score += 20
    elif multi_type_sorted >= 2:
        score += 10

    ed = scene["edgeDensity"]
    br = scene["brightness"]
    sh = scene["sharpness"]
    hv = scene["hueVariance"]

    scene_delta = 0

    if   ed < 0.08:  scene_delta += 15
    elif ed < 0.13:  scene_delta += 10
    elif ed < 0.18:  scene_delta += 3
    elif ed < 0.25:  scene_delta -= 12
    else:            scene_delta -= 22

    if br > 80:  scene_delta += 3
    if sh < 100: scene_delta -= 5
    if hv > 45:  scene_delta += 8

    score += max(-25, min(25, scene_delta))

    single_occurrence_types = sum(1 for name, cnt in counts.items()
                                  if cnt == 1 and WASTE_OBJECTS.get(name,(None,None,0))[2] > 0)
    if single_occurrence_types >= 4:
        score -= 15
    elif single_occurrence_types >= 3:
        score -= 8

    if electronics_count > 0:
        score -= 20
        if electronics_count >= 2:
            score -= 10

    if recyclable_count > 0 and organic_count > 0:
        score -= 10

    score = max(0, min(100, int(score)))

    return {
        "score":            score,
        "recyclable":       recyclable_count,
        "organic":          organic_count,
        "electronics":      electronics_count,
        "totalDetections":  total_detections,
        "maxSameTypeCount": max_single_type_count,
        "wasteTypeGroups":  waste_type_groups,
    }

def classify(score):
    if score >= 75: return "GOOD"
    if score >= 45: return "MEDIUM"
    if score >= 20: return "BAD"
    return "INVALID"

def generate_feedback(summary, scene, classification, counts):
    feedback = []
    ed = scene["edgeDensity"]

    if classification == "GOOD":
        feedback.append(
            "Excellent waste segregation! Waste is properly separated into designated bins."
        )
    elif classification == "MEDIUM":
        feedback.append(
            "Partial waste segregation detected. "
            "Some waste is grouped but separation is incomplete."
        )
    elif classification == "BAD":
        feedback.append(
            "Poor waste management. Waste is mixed and unsegregated — "
            "no proper separation into bins detected."
        )

    max_count = summary.get("maxSameTypeCount", 0)
    if max_count >= 4:
        feedback.append(
            f"Multiple items of the same waste type detected ({max_count}+) — "
            "indicates intentional sorting. Well done!"
        )
    elif max_count >= 2:
        feedback.append(
            "Some grouping of same-type waste detected — partial sorting effort noted."
        )
    else:
        feedback.append(
            "No grouping of waste types detected — consider separating waste into dedicated bins."
        )

    if summary["recyclable"] > 0:
        feedback.append(
            "Recyclable items detected (bottles, glass, paper) — "
            "ensure they go into a designated recycling bin."
        )
    if summary["organic"] > 0:
        feedback.append(
            "Organic waste detected — use a compost or organic waste bin."
        )
    if summary["recyclable"] > 0 and summary["organic"] > 0:
        feedback.append(
            "Recyclable and organic waste are mixed — use separate bins for each type."
        )
    if summary["electronics"] > 0:
        feedback.append(
            "Electronic waste detected — must be taken to a certified e-waste collection centre."
        )

    if   ed < 0.08:  feedback.append("The waste area is very clean and well-organised.")
    elif ed < 0.13:  feedback.append("The waste area is organised with clear bin structure.")
    elif ed < 0.18:  feedback.append("The waste area is moderately cluttered.")
    elif ed < 0.25:  feedback.append("The waste area is cluttered — bins may be overflowing.")
    else:            feedback.append(
        "Heavily cluttered or overflowing waste area — immediate clean-up recommended."
    )

    return feedback

def analyze_image(image_path):
    try:
        original, enhanced = load_image(image_path)

        if is_animated(original):
            return invalid("Animated images are not allowed.")

        if is_blurry(enhanced):
            return invalid(
                "Image is too blurry — please take a clearer photo in better lighting."
            )

        objects, counts = detect_objects(enhanced)

        if len(objects) == 0:
            return invalid("No recognisable waste objects detected in the image.")

        scene = analyze_scene(original)

        is_valid, rejection_reason = validate_waste_context(objects, counts, scene)

        if not is_valid:
            return invalid(rejection_reason)

        summary        = calculate_segregation_score(objects, counts, scene)
        score          = summary["score"]
        classification = classify(score)

        if score == 0:
            return invalid("Waste detected but segregation score is too low to classify.")

        gp = 0 if classification in ("BAD", "INVALID") else int(score // 4)

        feedback = generate_feedback(summary, scene, classification, counts)

        seen     = {}
        for o in sorted(objects, key=lambda x: -x["confidence"]):
            if o["name"] not in seen:
                seen[o["name"]] = o
        deduped_objects = list(seen.values())

        return {
            "classification":  classification,
            "score":           score,
            "gp":              gp,
            "segregation": {
                "status":          _seg_status(summary),
                "wasteTypeGroups": summary["wasteTypeGroups"],
                "maxSameType":     summary["maxSameTypeCount"],
                "totalDetections": summary["totalDetections"],
            },
            "sceneAnalysis":   scene,
            "detectedObjects": deduped_objects,
            "objectCounts":    counts,
            "feedback":        feedback,
        }

    except Exception as error:
        return invalid(str(error))

def _seg_status(summary):
    score = summary["score"]
    mx    = summary["maxSameTypeCount"]

    if score >= 75:
        return "WELL_SEGREGATED"
    elif score >= 45:
        if mx >= 2:
            return "PARTIALLY_SEGREGATED"
        return "MINIMAL_SEGREGATION"
    elif score >= 20:
        return "UNSEGREGATED"
    return "INVALID_SCENE"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps(invalid("No image path provided.")))
        sys.exit(1)

    print(json.dumps(analyze_image(sys.argv[1])))