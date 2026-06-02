import os
import sys
import json

from PIL import Image

import google.generativeai as genai

# =====================================================
# CONFIG
# =====================================================

genai.configure(
    api_key=os.getenv("GEMINI_API_KEY")
)

model = genai.GenerativeModel(
    "gemini-2.5-flash"
)

# =====================================================
# ANALYZE IMAGE
# =====================================================

def analyze_image(image_path):

    image = Image.open(image_path)

    prompt = """
You are an AI waste-management evaluator.

Analyze the image.

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

    # remove markdown fences if present

    text = text.replace(
        "```json",
        ""
    )

    text = text.replace(
        "```",
        ""
    )

    return json.loads(text)

# =====================================================
# MAIN
# =====================================================

if __name__ == "__main__":

    try:

        image_path = sys.argv[1]

        result = analyze_image(
            image_path
        )

        print(
            json.dumps(result)
        )

    except Exception as e:

        print(
            json.dumps({

                "classification":
                "INVALID",

                "score":
                0,

                "gp":
                0,

                "reason":
                str(e),

                "feedback":
                []
            })
        )