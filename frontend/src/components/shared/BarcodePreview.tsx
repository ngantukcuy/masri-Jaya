const LEFT_PATTERNS = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];

const LEFT_G_PATTERNS = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
];

const RIGHT_PATTERNS = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
];

const FIRST_DIGIT_PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
];

function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const sum = Array.from(code.slice(0, 12), Number).reduce(
    (total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3),
    0,
  );
  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

function encodeEan13(code: string): string {
  const parity = FIRST_DIGIT_PARITY[Number(code[0])];
  const left = Array.from(code.slice(1, 7), (digit, index) => {
    const value = Number(digit);
    return parity[index] === 'L' ? LEFT_PATTERNS[value] : LEFT_G_PATTERNS[value];
  }).join('');
  const right = Array.from(code.slice(7), (digit) => RIGHT_PATTERNS[Number(digit)]).join('');
  return `101${left}01010${right}101`;
}

export default function BarcodePreview({ value }: { value: string }) {
  if (!isValidEan13(value)) return null;

  const pattern = encodeEan13(value);
  const quietZone = 11;
  const guardBarIndexes = new Set([0, 1, 2, 46, 48, 92, 93, 94]);

  return (
    <div className="inline-flex rounded-md border border-border bg-white p-2">
      <svg
        role="img"
        aria-label={`Preview barcode EAN-13 ${value}`}
        viewBox="0 0 117 52"
        className="h-14 w-[234px]"
      >
        <rect width="117" height="52" fill="white" />
        {Array.from(pattern, (bit, index) =>
          bit === '1' ? (
            <rect
              key={index}
              x={quietZone + index}
              y="2"
              width="1"
              height={guardBarIndexes.has(index) ? 39 : 34}
              fill="black"
            />
          ) : null,
        )}
        <text
          x="58.5"
          y="50"
          textAnchor="middle"
          fill="black"
          fontFamily="monospace"
          fontSize="6"
          letterSpacing="0.3"
        >
          {value}
        </text>
      </svg>
    </div>
  );
}
