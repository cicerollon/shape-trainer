export function randomFloat(min, max) {
  return min + Math.random() * (max - min);
}

export function randomInt(min, max) {
  return Math.floor(randomFloat(min, max + 1));
}
