
import csv
from pathlib import Path


# Project root: the parent directory of scripts/
ROOT = Path(__file__).resolve().parents[1]

OUTPUT_FILE = ROOT / "data" / "evaluation" / "hinglish_reviews.csv"

COLUMNS = [
    "review_id",
    "text",
    "language",
    "gold_sentiment",
    "is_mixed",
    "sampling_target",
    "source_type",
    "source_reference",
    "annotator_1_label",
    "annotator_2_label",
    "adjudicated_label",
    "split",
]

# Exact quotas: 500 reviews across 3 languages and 3 sentiments.
QUOTAS = {
    "english": {
        "positive": 56,
        "neutral": 56,
        "negative": 55,
    },
    "hinglish_roman": {
        "positive": 56,
        "neutral": 55,
        "negative": 56,
    },
    "hindi_devanagari": {
        "positive": 55,
        "neutral": 56,
        "negative": 55,
    },
}

# Synthetic templates for development and pipeline testing.
# These are generated examples, not real customer reviews.
TEMPLATES = {
    "english": {
        "positive": [
            "{item} was {quality}, and the {aspect} was excellent.",
            "Really enjoyed the {item}; the {aspect} was {quality}.",
            "The {item} tasted {quality}, making the visit worthwhile.",
            "Great experience overall: {item} was {quality} and {aspect}.",
            "I loved the {item}. The {aspect} made the experience even better.",
            "Definitely recommend this place for its {quality} {item}.",
        ],
        "neutral": [
            "The {item} was {quality}, and the {aspect} was average.",
            "Tried the {item}; the {aspect} was {quality}.",
            "The {item} was okay, and the {aspect} was fairly ordinary.",
            "An average visit. The {item} was {quality}.",
            "Nothing unusual about the {item}; the {aspect} was standard.",
            "The {item} was neither impressive nor disappointing.",
        ],
        "negative": [
            "The {item} was {quality}, and the {aspect} was disappointing.",
            "I disliked the {item}; the {aspect} was {quality}.",
            "The {item} was poorly prepared and the {aspect} was terrible.",
            "Very disappointing visit because the {item} was {quality}.",
            "Would not recommend the {item}; the {aspect} needs improvement.",
            "The {item} was unacceptable, and the {aspect} made it worse.",
        ],
    },

    "hinglish_roman": {
        "positive": [
            "{item} ekdum {quality} tha, aur {aspect} bhi zabardast thi.",
            "{item} kha kar maza aa gaya, {aspect} bhi kaafi acchi thi.",
            "Yahan ka {item} bahut {quality} tha, full paisa vasool.",
            "Overall experience mast tha, {item} aur {aspect} dono badhiya.",
            "{item} ka taste lajawab tha aur {aspect} ne dil jeet liya.",
            "Definitely recommend karunga, {item} ekdum {quality} tha.",
        ],
        "neutral": [
            "{item} theek tha, aur {aspect} bhi average thi.",
            "{item} try kiya, taste normal tha aur {aspect} okay thi.",
            "Khana na bahut accha tha na kharab, {aspect} bhi theek thi.",
            "Overall experience average tha, {item} kuch khaas nahi tha.",
            "{item} theek-thaak tha aur {aspect} normal thi.",
            "Sab kuch okay tha, lekin {item} yaad rehne layak nahi tha.",
        ],
        "negative": [
            "{item} bilkul {quality} tha aur {aspect} bhi disappointing thi.",
            "{item} ka taste kharab tha, {aspect} bhi bahut buri thi.",
            "Yahan ka {item} pasand nahi aaya, {aspect} bhi bekaar thi.",
            "Experience kharab raha, {item} aur {aspect} dono disappointing.",
            "{item} bilkul paisa vasool nahi tha aur {aspect} bhi kharab thi.",
            "Recommend nahi karunga, {item} {quality} tha aur {aspect} kharab thi.",
        ],
    },

    "hindi_devanagari": {
        "positive": [
            "{item} बहुत {quality} था और {aspect} भी शानदार थी।",
            "{item} खाकर मज़ा आ गया, {aspect} भी बहुत अच्छी थी।",
            "यहाँ का {item} लाजवाब था और पूरा अनुभव बढ़िया रहा।",
            "कुल मिलाकर अनुभव अच्छा रहा, {item} और {aspect} दोनों बेहतरीन थे।",
            "{item} का स्वाद बहुत अच्छा था और {aspect} ने दिल जीत लिया।",
            "मैं इस जगह की सिफारिश करूँगा, {item} वाकई {quality} था।",
        ],
        "neutral": [
            "{item} ठीक था और {aspect} भी औसत थी।",
            "{item} का स्वाद सामान्य था और {aspect} भी ठीक थी।",
            "खाना न बहुत अच्छा था न खराब, {aspect} भी सामान्य थी।",
            "कुल मिलाकर अनुभव औसत रहा, {item} कुछ खास नहीं था।",
            "{item} ठीक-ठाक था और {aspect} साधारण थी।",
            "सब कुछ ठीक था, लेकिन {item} याद रखने लायक नहीं था।",
        ],
        "negative": [
            "{item} बहुत {quality} था और {aspect} भी निराशाजनक थी।",
            "{item} का स्वाद खराब था और {aspect} भी बहुत बुरी थी।",
            "यहाँ का {item} पसंद नहीं आया और {aspect} भी खराब थी।",
            "अनुभव खराब रहा, {item} और {aspect} दोनों निराशाजनक थे।",
            "{item} बिल्कुल पैसे वसूल नहीं था और {aspect} भी खराब थी।",
            "मैं इस जगह की सिफारिश नहीं करूँगा, {item} {quality} था।",
        ],
    },
}


DETAILS = {
    "english": {
        "items": [
            "paneer tikka", "masala dosa", "cold coffee",
            "margherita pizza", "chocolate brownie", "veg biryani",
            "white sauce pasta", "cheese sandwich", "burger",
            "fresh lime soda",
        ],
        "aspects": [
            "service", "staff behaviour", "ambience",
            "waiting time", "presentation", "portion size",
            "cleanliness", "value for money",
        ],
        "positive": [
            "delicious", "fresh", "flavourful", "perfectly cooked",
            "excellent", "wonderful", "well prepared", "fantastic",
        ],
        "neutral": [
            "ordinary", "acceptable", "decent", "average",
            "normal", "reasonable", "okay", "fair",
        ],
        "negative": [
            "bland", "cold", "overcooked", "disappointing",
            "unappetising", "stale", "poorly prepared", "awful",
        ],
    },
    "hinglish_roman": {
        "items": [
            "paneer tikka", "masala dosa", "cold coffee",
            "margherita pizza", "chocolate brownie", "veg biryani",
            "white sauce pasta", "cheese sandwich", "burger",
            "fresh lime soda",
        ],
        "aspects": [
            "service", "staff ka behaviour", "ambience",
            "waiting time", "presentation", "portion size",
            "cleanliness", "value for money",
        ],
        "positive": [
            "tasty", "fresh", "laajawab", "perfectly cooked",
            "mast", "zabardast", "badhiya", "fantastic",
        ],
        "neutral": [
            "average", "theek-thaak", "normal", "okay",
            "ordinary", "decent", "theek", "usual",
        ],
        "negative": [
            "bekaar", "thanda", "overcooked", "disappointing",
            "basi", "kharab", "bilkul bland", "awful",
        ],
    },
    "hindi_devanagari": {
        "items": [
            "पनीर टिक्का", "मसाला डोसा", "कोल्ड कॉफी",
            "मार्घेरिटा पिज़्ज़ा", "चॉकलेट ब्राउनी", "वेज बिरयानी",
            "व्हाइट सॉस पास्ता", "चीज़ सैंडविच", "बर्गर",
            "फ्रेश लाइम सोडा",
        ],
        "aspects": [
            "सेवा", "स्टाफ का व्यवहार", "माहौल",
            "इंतज़ार का समय", "परोसने का तरीका", "खाने की मात्रा",
            "साफ-सफाई", "पैसों के हिसाब से कीमत",
        ],
        "positive": [
            "स्वादिष्ट", "ताज़ा", "लाजवाब", "अच्छी तरह पका हुआ",
            "बेहतरीन", "शानदार", "बढ़िया", "उम्दा",
        ],
        "neutral": [
            "सामान्य", "ठीक-ठाक", "औसत", "ठीक",
            "साधारण", "ठीक-ठाक", "सामान्य", "औसत",
        ],
        "negative": [
            "बेस्वाद", "ठंडा", "ज़्यादा पका हुआ", "निराशाजनक",
            "बासी", "खराब", "बेकार", "बहुत बुरा",
        ],
    },
}


def generate_reviews():
    rows = []
    review_number = 1

    for language, sentiment_quotas in QUOTAS.items():
        details = DETAILS[language]

        for sentiment, count in sentiment_quotas.items():
            templates = TEMPLATES[language][sentiment]
            qualities = details[sentiment]

            for i in range(count):
                template = templates[i % len(templates)]

                # Vary food, aspect, and description systematically.
                item = details["items"][(i // len(templates)) % len(details["items"])]
                aspect = details["aspects"][
                    (i * 3 + i // len(templates)) % len(details["aspects"])
                ]
                quality = qualities[
                    (i * 5 + i // len(templates)) % len(qualities)
                ]

                review_text = template.format(
                    item=item,
                    aspect=aspect,
                    quality=quality,
                )

                row = {
                    "review_id": f"SYN{review_number:04d}",
                    "text": review_text,
                    "language": language,
                    "gold_sentiment": sentiment,
                    "is_mixed": "false",
                    "sampling_target": sentiment,
                    "source_type": "synthetic_generated",
                    "source_reference": "",
                    "annotator_1_label": "",
                    "annotator_2_label": "",
                    "adjudicated_label": "",
                    "split": "synthetic_only",
                }

                rows.append(row)
                review_number += 1

    return rows


def main():
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    rows = generate_reviews()

    if len(rows) != 500:
        raise ValueError(f"Expected 500 reviews, generated {len(rows)}")

    # Protect existing work from accidental overwriting.
    if OUTPUT_FILE.exists():
        backup = OUTPUT_FILE.with_name("hinglish_reviews_backup.csv")
        if not backup.exists():
            backup.write_bytes(OUTPUT_FILE.read_bytes())
            print(f"Existing CSV backed up to: {backup}")

    with OUTPUT_FILE.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nGenerated {len(rows)} synthetic reviews.")
    print(f"Saved to: {OUTPUT_FILE}")

    print("\nCounts by language and sentiment:")
    for language in QUOTAS:
        for sentiment in ("positive", "neutral", "negative"):
            count = sum(
                r["language"] == language
                and r["gold_sentiment"] == sentiment
                for r in rows
            )
            print(f"  {language:20} {sentiment:8} {count}")

    print("\nColumn count:", len(COLUMNS))
    print("Synthetic labels are NOT human-verified.")
    print("Do not use this dataset to claim real-world model accuracy.")


if __name__ == "__main__":
    main()
