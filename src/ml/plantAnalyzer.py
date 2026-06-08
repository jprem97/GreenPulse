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

    from datetime import datetime
    current_month = datetime.now().strftime("%B")

    stage_context = ""
    if is_first_upload:
        stage_context = f"""
This is the FIRST upload (Week {current_week}) for a {total_weeks}-week journey.

CRITICAL VERIFICATION CODE CHECK:
The user was instructed to write the verification code "{verification_code}" on a piece of paper and place it visible near the plant.

You MUST verify ALL of the following:
1. A handwritten code "{verification_code}" is clearly visible in the image
2. The code is written on paper/card with a pen/marker (NOT printed, NOT on a screen)
3. The code is placed physically near the plant (not overlaid digitally)
4. A real plant is visible in the image

VERIFICATION CODE FRAUD DETECTION:
- Printed or typed code = FRAUD (code must be handwritten)
- Code displayed on a phone/laptop screen = FRAUD
- Code digitally overlaid on the image = FRAUD
- Code written on a whiteboard instead of paper = FRAUD
- Code is blurry, partially hidden, or unreadable = INVALID
- Multiple codes visible = FRAUD
- Code from a different plantation (different format) = FRAUD

Set verificationCodeDetected to true ONLY if you can clearly see a handwritten code in the image.
Set verificationCodeMatches to true ONLY if the visible code exactly matches "{verification_code}".
If the code "{verification_code}" is NOT visible, does not match, or appears printed/digital, set valid=false and fraudDetected=true.

IMAGE AUTHENTICITY CHECK:
- Is this a real camera photo of a physical scene?
- Does it show natural lighting and shadows?
- Are there signs of digital manipulation?
- Is the resolution and quality consistent with a phone camera?
"""
    else:
        stage_context = f"""
This is upload for Week {current_week} of a {total_weeks}-week journey.

The PREVIOUS stage image is provided as the SECOND image for comparison.

You MUST evaluate:
1. Is this the SAME plant as the previous image? (same species, same pot/location)
2. Has VISIBLE growth occurred since the last upload?
3. Is the growth realistic for {current_week - (current_week // 2)} weeks of elapsed time?
4. Is the plant healthy?

SUBSEQUENT UPLOAD FRAUD DETECTION:
- If the same image is uploaded twice = FRAUD
- If a different plant species is shown = FRAUD (different plant)
- If the plant appears unchanged and it's been weeks = likely NOT the same plant
- If growth is unrealistic (e.g., seed to full tree in 1 week) = FRAUD
- Screenshots, AI-generated images, stock photos = FRAUD

VERIFICATION CODE IN SUBSEQUENT UPLOADS:
- The verification code is NOT required in the image for subsequent uploads
- If a code IS visible, check if it matches "{verification_code}"
- Set verificationCodeDetected to true if a code is visible, false otherwise
- Set verificationCodeMatches to true if the visible code matches "{verification_code}"

GROWTH ESTIMATION:
- Estimate the growth percentage compared to what's expected at this stage
- Compare leaf count, stem height, flower/fruit development
- Consider the plant type ({plant_type}) and typical growth rate
- Current month is {current_month} - factor in seasonal growth patterns
"""

    prompt = f"""
You are an AI plant growth verifier for a sustainability platform called GreenPulse.

PLANT DETAILS:
- Plant Name: {plant_name}
- Plant Type: {plant_type}
- Current Week: {current_week} of {total_weeks}
- Verification Code: {verification_code}
- Current Month: {current_month}

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

FRAUD DETECTION RULES:
- Same image uploaded twice = FRAUD
- Different plant species = FRAUD
- Stock photo or internet image = FRAUD
- AI-generated plant image = FRAUD
- Verification code mismatch (first upload) = FRAUD
- Printed/digital verification code (first upload) = FRAUD
- Code displayed on screen (first upload) = FRAUD
- Photo of a photo = FRAUD
- Heavily filtered/edited image = FRAUD

SOIL AND ENVIRONMENT ASSESSMENT:
- Is the plant in a reasonable pot/container for its type?
- Does the soil look appropriate (not artificial)?
- Is the growing environment realistic (indoor/outdoor)?
- Are there signs of care (watering, sunlight)?

GROWTH EVALUATION:
- Compare current image with previous image when available
- Look for: new leaves, stem growth, flower buds, fruit development
- Growth must be proportional to elapsed time
- Healthy plants show vibrant color, firm stems, no wilting
- Estimate overall growth progress as a percentage

Return ONLY valid JSON with this EXACT schema:

{{
  "valid": true or false,
  "samePlant": true or false,
  "verificationCodeDetected": true or false,
  "verificationCodeMatches": true or false,
  "growthDetected": true or false,
  "growthQuality": "EXCELLENT" or "GOOD" or "FAIR" or "POOR" or "NONE",
  "plantHealth": "EXCELLENT" or "GOOD" or "FAIR" or "POOR" or "DEAD",
  "fraudDetected": true or false,
  "fraudType": "NONE" or "DUPLICATE_IMAGE" or "DIFFERENT_PLANT" or "AI_GENERATED" or "STOCK_PHOTO" or "VERIFICATION_CODE_TAMPERED" or "PRINTED_CODE" or "SCREENSHOT" or "OTHER",
  "growthPercentage": 0 to 100,
  "score": 0 to 100,
  "feedback": ["feedback1", "feedback2", "feedback3"]
}}

Score Guidelines:
- 90-100: Excellent growth, healthy plant, verified code visible, perfect environment
- 70-89: Good growth, healthy plant, good environment
- 50-69: Some growth, moderate health, acceptable environment
- 30-49: Poor growth or health issues, environment concerns
- 0-29: No growth, unhealthy, suspicious, or fraud detected

Feedback Guidelines:
- Provide 2-4 specific, actionable feedback items
- Mention specific observations (leaf count, color, size)
- Include tips for improvement when score is below 70
- Note any concerns about authenticity or health

Be strict. Authenticity is the top priority. A fake image should never pass.
"""

    if previous_image:
        response = model.generate_content([prompt, previous_image, current_image])
    else:
        response = model.generate_content([prompt, current_image])

    text = response.text.strip()
    text = text.replace("```json", "")
    text = text.replace("```", "")

    result = json.loads(text)

    if "fraudType" not in result:
        result["fraudType"] = "OTHER" if result.get("fraudDetected") else "NONE"
    if "growthPercentage" not in result:
        result["growthPercentage"] = 0

    return result


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
                    "verificationCodeDetected": False,
                    "verificationCodeMatches": False,
                    "growthDetected": False,
                    "growthQuality": "NONE",
                    "plantHealth": "POOR",
                    "fraudDetected": True,
                    "fraudType": "OTHER",
                    "growthPercentage": 0,
                    "score": 0,
                    "feedback": [str(e)],
                }
            )
        )
