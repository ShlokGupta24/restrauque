
from pydantic import BaseModel, Field


class ReviewInput(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    rating: int | None = Field(default=None, ge=1, le=5)


class ReviewBatchInput(BaseModel):
    reviews: list[ReviewInput] = Field(min_length=1, max_length=500)
