import { FeedbackSubmission } from '../services/contracts/types';

export const mockDefaultFeedback: FeedbackSubmission = {
  orderId: 'ord-1042',
  overallRating: 4,
  overallComment: 'Great food and fast service!',
  items: [
    {
      productId: 'prod-mushroom-pasta',
      comment: 'Very creamy and rich mushroom flavor.',
    },
    {
      productId: 'prod-avocado-toast',
      comment: 'Crunchy sourdough and perfectly seasoned avocado.',
    },
  ],
};
