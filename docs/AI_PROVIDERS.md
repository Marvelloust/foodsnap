# FoodSnap provider contracts

FoodSnap does not couple its product UI to a specific AI vendor. The application talks to normalized HTTP provider contracts.

## Vision / OCR request

`POST FOODSNAP_VISION_ENDPOINT`

Headers:

```text
Content-Type: application/json
Authorization: Bearer <FOODSNAP_VISION_TOKEN>   # when provided
```

Body:

```json
{
  "version": "1.0",
  "scanCode": "FS-...",
  "images": [
    {
      "name": "lunch.jpg",
      "mimeType": "image/jpeg",
      "dataUrl": "data:image/jpeg;base64,..."
    }
  ],
  "preferences": {
    "ai_detail": "balanced",
    "dietary": [],
    "cuisines": [],
    "allergens": []
  },
  "capabilities": [
    "vision",
    "ocr",
    "food_detection",
    "components",
    "context",
    "uncertainty"
  ]
}
```

## Normalized vision / OCR response

```json
{
  "title": "Likely food name",
  "contentType": "prepared_dish",
  "confidence": 0.93,
  "summary": "Short useful description",
  "cuisine": "West African",
  "category": "Prepared meal",
  "uncertainty": "What cannot be confidently determined",
  "tags": ["rice", "tomato"],
  "items": [
    {
      "name": "Rice component",
      "foodSlug": "jollof-rice",
      "confidence": 0.95,
      "type": "food",
      "bbox": {"x": 8, "y": 25, "w": 46, "h": 50},
      "notes": "Visible rice region",
      "sourceType": "detected"
    }
  ],
  "ingredients": [
    {
      "name": "Tomato",
      "slug": "tomato",
      "confidence": 0.75,
      "relationship": "likely",
      "sourceType": "inferred"
    }
  ],
  "text": [
    {
      "text": "Visible label text",
      "confidence": 0.91,
      "bbox": {"x": 5, "y": 10, "w": 40, "h": 8}
    }
  ],
  "allergens": [
    {
      "name": "Peanut",
      "basis": "Visible label text: contains peanuts",
      "confidence": 0.99,
      "sourceType": "extracted"
    }
  ],
  "relatedFoods": ["jollof-rice"]
}
```

Bounding boxes are percentages from 0–100 relative to the source image.

## Open-ended assistant request

`POST FOODSNAP_ASSISTANT_ENDPOINT`

The body contains:

- `version`
- `question`
- recent `history`
- normalized `scan` context

Expected response:

```json
{ "answer": "..." }
```

## Transactional mail request

`POST FOODSNAP_MAIL_ENDPOINT`

```json
{
  "to": "user@example.com",
  "subject": "Reset your FoodSnap password",
  "text": "...",
  "html": "..."
}
```

## Provider responsibilities

The external vision provider should:

- communicate uncertainty rather than manufacture certainty
- distinguish OCR-derived text from inferred content
- avoid claiming allergens solely from appearance unless explicitly marked as inference
- return component-level bounding regions where supported
- support multiple images in a single analysis request
- keep food names/cuisines descriptive rather than prescriptive

## Direct OpenAI adapter

The definitive merge also preserves the second branch's direct OpenAI integration path.

When `FOODSNAP_VISION_ENDPOINT` is empty and `OPENAI_API_KEY` is configured, `services/intelligence.js` sends the scan to the OpenAI Responses API and requires a strict normalized JSON result before any data is persisted.

```text
OPENAI_API_KEY=...
OPENAI_VISION_MODEL=gpt-5.6-luna
OPENAI_ASSISTANT_MODEL=gpt-5.6-luna
```

Provider precedence is:

1. `FOODSNAP_VISION_ENDPOINT` / `FOODSNAP_ASSISTANT_ENDPOINT`
2. direct OpenAI adapter
3. normal service-unavailable handling when external reasoning is required

The UI is not coupled to either provider path.

## Google Gemini direct adapter

FoodSnap can call Google Gemini directly when the custom FoodSnap provider and OpenAI are not configured.

```env
GEMINI_API_KEY=...
GEMINI_VISION_MODEL=gemini-3.1-flash-lite
GEMINI_ASSISTANT_MODEL=gemini-3.1-flash-lite
```

The adapter converts uploaded data URLs to Gemini inline image data, requests JSON for scan analysis, then runs the response through FoodSnap's normalizer before persistence. This preserves the same scan/event/knowledge model regardless of provider.

## Direct transactional email adapters

In addition to `FOODSNAP_MAIL_ENDPOINT`, FoodSnap supports direct Resend and Brevo transports.

```env
# Resend
RESEND_API_KEY=
FOODSNAP_FROM_EMAIL=FoodSnap <hello@example.com>

# Brevo
BREVO_API_KEY=
BREVO_SENDER_EMAIL=hello@example.com
BREVO_SENDER_NAME=FoodSnap
```

Only configure one unless you intentionally want the documented precedence. Email events are persisted in `email_events` and the application also creates in-app notifications for the relevant account events.
