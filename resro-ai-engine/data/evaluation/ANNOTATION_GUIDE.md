
# Resro Review Sentiment Annotation Guide

## 1. Objective

Label restaurant and cafe reviews so we can evaluate sentiment models
on English, Romanized Hinglish, and Hindi written in Devanagari.

Annotate the meaning of the original review. Do not translate it
before assigning a label.

## 2. Allowed overall sentiment labels

### positive
The review expresses clear satisfaction, praise, recommendation,
or a predominantly favorable experience.

Examples:
- "Coffee was amazing and the staff were friendly."
- "Khana bahut mast tha, definitely coming back!"
- "कॉफी बहुत अच्छी थी।"

### neutral
The review is primarily factual, ambiguous, or expresses neither
clear satisfaction nor dissatisfaction.

Examples:
- "Ordered a cappuccino and a sandwich."
- "Theek tha, kuch special nahi."
- "मैंने कॉफी और सैंडविच ऑर्डर किया।"

### negative
The review expresses dissatisfaction, criticism, disappointment,
or a predominantly unfavorable experience.

Examples:
- "The food was cold and the service was slow."
- "Khana bekar tha, dobara nahi aaunga."
- "सेवा बहुत खराब थी।"

## 3. Mixed sentiment

Set is_mixed=true when the review contains meaningful positive
and negative opinions.

Examples:
- "Food was great but service was terrible."
- "Khana accha tha, lekin price bahut zyada hai."
- "कॉफी अच्छी थी लेकिन स्टाफ बहुत रूखा था।"

Mixed is a separate annotation attribute, not a fourth overall
sentiment label.

For the overall label, use this rule:
- positive: the overall experience is clearly favorable.
- negative: the overall experience is clearly unfavorable.
- neutral: the review is balanced or the overall polarity is unclear.

Do not infer the overall sentiment from star ratings alone.

## 4. Language labels

English:
Primarily English text.

Romanized Hinglish:
Hindi or mixed Hindi-English written mainly using Latin letters.

Devanagari Hindi:
Hindi written mainly using Devanagari script.

Use the dominant language/script. Flag unusual or ambiguous cases
for review rather than silently forcing a label.

## 5. Annotation rules

- Preserve slang, spelling variations, and code-switching.
- Consider negation: "not good" is not positive.
- Interpret context rather than counting positive/negative words.
- Do not treat emojis as the only evidence of sentiment.
- Do not infer sentiment from a customer's identity.
- If the text is unintelligible or contains no meaningful review,
  flag it for exclusion and replacement.
- Keep the original review text unchanged.

## 6. Independent labelling

Whenever possible, two annotators should label each review independently.

If their overall labels disagree, a third review or adjudication
should establish the final label.

Record the final overall label in adjudicated_label.
Use gold_sentiment as the final evaluation label after adjudication.

## 7. Quality checks

- Every included review must have non-empty text.
- Every included review must have an allowed language and sentiment.
- Duplicate and near-duplicate reviews should be investigated.
- sampling_target is a collection target, not the correct answer.
- Never copy a model prediction directly into a gold label.
