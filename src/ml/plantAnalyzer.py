import os
import sys
import json

from PIL import Image

import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-2.5-flash")


def analyze_plant_image(
    current_image_path,
    previous_image_path,
    plant_name,
    plant_type,
    current_week,
    total_weeks,
    verification_code,
    is_first_upload,
):
    current_image = Image.open(current_image_path)

    previous_image = None
    if previous_image_path and os.path.exists(previous_image_path):
        previous_image = Image.open(previous_image_path)

    stage_context = ""
    if is_first_upload:
        stage_context = f"""
This is the FIRST upload (Week {current_week}) for a {total_weeks}-week journey.

CRITICAL: The user was instructed to write the verification code "{verification_code}" on a piece of paper and place it visible near the plant.

You MUST verify:
1. A handwritten code "{verification_code}" is clearly visible in the image
2. The code is written on paper/card and placed near the plant
3. A real plant is visible in the image

If the code "{verification_code}" is NOT visible or does not match, set valid=false and explain why.
"""
    else:
        stage_context = f"""
This is upload for Week {current_week} of a {total_weeks}-week journey.

The PREVIOUS stage image is provided as the SECOND image for comparison.

You MUST evaluate:
1. Is this the SAME plant as the previous image?
2. Has VISIBLE growth occurred since the last upload?
3. Is the growth realistic for {current_week - (current_week // 2)} weeks of elapsed time?
4. Is the plant healthy?
"""

    prompt = f"""
You are an AI plant growth verifier for a sustainability platform called GreenPulse.

PLANT DETAILS:
- Plant Name: {plant_name}
- Plant Type: {plant_type}
- Current Week: {current_week} of {total_weeks}
- Verification Code: {verification_code}

{stage_context}

IMAGE VALIDATION RULES:
Reject the image immediately if ANY of the following apply:
- No plant is visible
- The image is a screenshot, meme, advertisement, or social media post
- The image appears AI-generated, synthetic, cartoon-style, or digitally rendered
- The image contains stock-photo watermarks or appears downloaded from the internet
- The image is a blurry, dark, overexposed, or distorted photo
- The image is a duplicate of a previous upload
- The image shows a different plant species than expected
- The image is unrelated to plant growth
- Plant is too small to evaluate growth
- Unrealistic growth progression (e.g., seed to full tree in 1 week)

FRAUD DETECTION:
- Same image uploaded twice = fraud
- Different plant species = fraud
- Stock photo or internet image = fraud
- AI-generated plant image = fraud
- Verification code mismatch (first upload) = fraud

GROWTH EVALUATION:
- Compare current image with previous image when available
- Look for: new leaves, stem growth, flower buds, fruit development
- Growth must be proportional to elapsed time
- Healthy plants show vibrant color, firm stems, no wilting

Return ONLY valid JSON with this EXACT schema:

{{
  "valid": true or false,
  "samePlant": true or false,
  "growthDetected": true or false,
  "growthQuality": "EXCELLENT" or "GOOD" or "FAIR" or "POOR" or "NONE",
  "plantHealth": "EXCELLENT" or "GOOD" or "FAIR" or "POOR" or "DEAD",
  "fraudDetected": true or false,
  "score": 0 to 100,
  "feedback": ["feedback1", "feedback2"]
}}

Score Guidelines:
- 90-100: Excellent growth, healthy plant, verified code visible
- 70-89: Good growth, healthy plant
- 50-69: Some growth, moderate health
- 30-49: Poor growth or health issues
- 0-29: No growth, unhealthy, or suspicious

Be strict. Authenticity is the top priority.
"""

    if previous_image:
        response = model.generate_content([prompt, previous_image, current_image])
    else:
        response = model.generate_content([prompt, current_image])

    text = response.text.strip()
    text = text.replace("```json", "")
    text = text.replace("```", "")

    return json.loads(text)


if __name__ == "__main__":
    try:
        current_path = sys.argv[1]
        previous_path = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "null" else None
        plant_name = sys.argv[3]
        plant_type = sys.argv[4]
        current_week = int(sys.argv[5])
        total_weeks = int(sys.argv[6])
        verification_code = sys.argv[7]
        is_first = sys.argv[8].lower() == "true"

        result = analyze_plant_image(
            current_path,
            previous_path,
            plant_name,
            plant_type,
            current_week,
            total_weeks,
            verification_code,
            is_first,
        )
        print(json.dumps(result))

    except Exception as e:
        print(
            json.dumps(
                {
                    "valid": False,
                    "samePlant": False,
                    "growthDetected": False,
                    "growthQuality": "NONE",
                    "plantHealth": "POOR",
                    "fraudDetected": True,
                    "score": 0,
                    "feedback": [str(e)],
                }
            )
        )
