// Small vector helpers for meaning search.

export function cosineSimilarity(firstVector, secondVector) {
  let dotProduct = 0;
  let firstLengthSquared = 0;
  let secondLengthSquared = 0;
  for (let index = 0; index < firstVector.length; index++) {
    dotProduct += firstVector[index] * secondVector[index];
    firstLengthSquared += firstVector[index] ** 2;
    secondLengthSquared += secondVector[index] ** 2;
  }
  const lengthProduct = Math.sqrt(firstLengthSquared) * Math.sqrt(secondLengthSquared);
  if (lengthProduct === 0) {
    return 0;
  }
  return dotProduct / lengthProduct;
}
