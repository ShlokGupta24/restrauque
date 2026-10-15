
from app.ml.muril_sentiment  import (
    predict_sentiment,
    predict_sentiment_batch,
)


def main():
    reviews = [
        "The food was delicious and the staff were friendly.",
        "Khana bahut accha tha, service bhi mast thi.",
        "खाना बहुत अच्छा था और सेवा भी बढ़िया थी।",
        "The food was terrible and the service was slow.",
    ]

    print("Testing individual prediction:\n")

    for review in reviews:
        result = predict_sentiment(review)
        print(f"Review: {review}")
        print(f"Result: {result}\n")

    print("Testing batch prediction:\n")

    results = predict_sentiment_batch(reviews, batch_size=4)

    for review, result in zip(reviews, results):
        print(f"{review} -> {result}")


if __name__ == "__main__":
    main()
