from transformers import pipeline

MODELS = [
    "airzipm/sentiment-analysis-muril-v2",
]

SAMPLE_REVIEWS = [
    "The food was amazing and the service was excellent.",
    "Khana bahut accha tha, definitely paisa vasool!",
    "खाना बहुत अच्छा था और सर्विस भी बढ़िया थी।",
    "Food accha tha but service bahut slow thi.",
    "The food was terrible and the staff were rude.",
    "Khana theek tha, nothing special.",
]

for model_name in MODELS:
    print("\n" + "=" * 80)
    print(f"MODEL: {model_name}")
    print("=" * 80)

    try:
        classifier = pipeline(
            "text-classification",
            model=model_name,
            tokenizer=model_name,
        )

        print("\nConfigured label mappings:")
        print(classifier.model.config.id2label)
        print("Label to ID:", classifier.model.config.label2id)

        print("\nSample predictions:")
        predictions = classifier(
            SAMPLE_REVIEWS,
            truncation=True,
            batch_size=4,
        )

        for review, prediction in zip(SAMPLE_REVIEWS, predictions):
            print(f"\nReview: {review}")
            print(f"Predicted label: {prediction['label']}")
            print(f"Score: {prediction['score']:.4f}")

    except Exception as exc:
        print(f"ERROR loading or running {model_name}: {exc}")
