import os
import sys
import json

from PIL import Image

import google.generativeai as genai

genai.configure(
api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel(
    "gemini-2.5-flash"
)

def analyze_image(image_path):

    image = Image.open(image_path)

    prompt = """
You are an AI waste-management evaluator.

IMAGE VALIDATION AND CAPTURE REQUIREMENTS

Before evaluating waste segregation, first verify that the image itself is suitable for analysis.

MANDATORY REQUIREMENTS:

1. The image must clearly show actual waste, garbage, recyclables, compostables, litter, or waste containers.

2. Waste items must be visible enough to identify their category and placement.

3. If bins are present, the contents of the bins should be visible whenever possible.

4. The image should be captured from a top, overhead, or elevated angle that allows waste distribution and segregation patterns to be observed.

5. The image must contain sufficient lighting and focus for reliable analysis.

6. Multiple waste groups, bins, or sorting areas should be included in a single frame whenever possible.

STRICT INVALID CONDITIONS:

Classify as INVALID immediately if ANY of the following apply:

* No waste-related objects are visible.
* Only empty bins or containers are visible.
* Waste is hidden, covered, cropped out, or cannot be inspected.
* The image is blurry, dark, overexposed, distorted, or out of focus.
* The image is partially captured and does not show enough of the waste scene.
* The image contains only people, selfies, portraits, pets, vehicles, buildings, landscapes, rooms, desks, kitchens, or unrelated objects.
* The image is a screenshot, meme, advertisement, collage, poster, presentation slide, social media post, or edited graphic.
* The image appears AI-generated, synthetic, cartoon-style, digitally rendered, or heavily manipulated.
* The image contains stock-photo watermarks or appears downloaded from the internet.
* The image is taken from a distance where waste details cannot be verified.
* Waste categories cannot be confidently identified.

EMPTY BIN RULE:

The presence of bins alone is NOT evidence of waste segregation.

* Empty recycling bins = INVALID
* Empty waste station = INVALID
* Empty containers = INVALID

At least one visible waste item must be present before segregation can be evaluated.

WASTE VISIBILITY RULE:

If the waste itself is not visible, segregation cannot be determined.

When uncertain whether waste is visible or identifiable, choose INVALID.

SEGREGATION PRIORITY RULE:

The primary objective is to evaluate waste segregation behaviour, NOT scene cleanliness.

A perfectly clean environment with no waste is INVALID.

A waste scene with visible and correctly separated waste may be GOOD even if the surrounding area is not visually perfect.

CONFIDENCE RULE:

If confidence in waste identification or segregation assessment is below 70%, classify as INVALID rather than guessing.

Be strict. False positives are worse than false negatives.

Classify into ONLY one:

GOOD
MEDIUM
BAD
INVALID

Rules:

GOOD:
- Proper waste disposal
- Recycling awareness
- Clean surroundings

MEDIUM:
- Some waste visible
- Partial disposal effort
- Moderately cluttered

BAD:
- Littering
- Improper disposal
- Heavy waste clutter

INVALID:
- Selfie
- Person posing
- Animal photo
- Landscape
- Screenshot
- Meme
- Unrelated image
- No waste-related content



Return ONLY valid JSON.

Schema:

{
  "classification": "",
  "score": 0,
  "gp": 0,
  "reason": "",
  "feedback": []
}

Score must be 0-100.

GP Rules:
GOOD => score/4
MEDIUM => score/4
BAD => 0
INVALID => 0
"""

    response = model.generate_content(
        [prompt, image]
    )

    text = response.text.strip()

    text = text.replace("```json", "")
    text = text.replace("```", "")

    return json.loads(text)


if __name__ == "__main__":

    try:
        image_path = sys.argv[1]
        result = analyze_image(image_path)
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({
            "classification": "INVALID",
            "score": 0,
            "gp": 0,
            "reason": str(e),
            "feedback": []
        }))
        