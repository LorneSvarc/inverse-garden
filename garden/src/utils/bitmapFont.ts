/**
 * Bitmap Font for LED Wall
 *
 * 5x7 pixel font - each character is represented as a 7-row array
 * where each row is a 5-bit number (binary: which pixels are lit)
 *
 * Example: 'A' =
 *   .###.  = 0b01110 = 14
 *   #...#  = 0b10001 = 17
 *   #...#  = 0b10001 = 17
 *   #####  = 0b11111 = 31
 *   #...#  = 0b10001 = 17
 *   #...#  = 0b10001 = 17
 *   #...#  = 0b10001 = 17
 */

// Each character is 7 rows of 5-bit values
type CharBitmap = [number, number, number, number, number, number, number];

const FONT: Record<string, CharBitmap> = {
  'A': [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  'B': [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  'C': [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  'D': [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  'E': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  'F': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  'G': [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  'H': [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  'I': [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  'J': [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  'K': [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  'L': [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  'M': [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  'N': [0b10001, 0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001],
  'O': [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  'P': [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  'Q': [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  'R': [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  'S': [0b01110, 0b10001, 0b10000, 0b01110, 0b00001, 0b10001, 0b01110],
  'T': [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  'U': [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  'V': [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  'W': [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  'X': [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  'Y': [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  'Z': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  ' ': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
  '-': [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
  '.': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00100],
};

// Character width including spacing
const CHAR_WIDTH = 6;  // 5 pixels + 1 space
const CHAR_HEIGHT = 7;

/**
 * Convert a string to a set of lit brick positions
 * Returns array of [x, y] coordinates (0-indexed from top-left)
 */
export function stringToPixels(text: string): [number, number][] {
  const pixels: [number, number][] = [];
  const upperText = text.toUpperCase();

  let xOffset = 0;

  for (const char of upperText) {
    const bitmap = FONT[char];
    if (!bitmap) {
      // Unknown character - skip with spacing
      xOffset += CHAR_WIDTH;
      continue;
    }

    for (let row = 0; row < CHAR_HEIGHT; row++) {
      const rowBits = bitmap[row];
      for (let col = 0; col < 5; col++) {
        // Check if this bit is set (reading left to right)
        const bitPosition = 4 - col;
        if ((rowBits >> bitPosition) & 1) {
          pixels.push([xOffset + col, row]);
        }
      }
    }

    xOffset += CHAR_WIDTH;
  }

  return pixels;
}

/**
 * Get the total width of a string in pixels
 */
export function getTextWidth(text: string): number {
  return text.length * CHAR_WIDTH - 1;  // -1 because last char doesn't need trailing space
}

/**
 * Get text height in pixels
 */
export function getTextHeight(): number {
  return CHAR_HEIGHT;
}

/**
 * Center text horizontally within a given width
 * Returns the x offset to use
 */
export function centerText(text: string, wallWidth: number): number {
  const textWidth = getTextWidth(text);
  return Math.floor((wallWidth - textWidth) / 2);
}
