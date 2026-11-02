import React from 'react';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

// EAN-13 encoding tables.
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

// Standard EAN-13 check digit for the first 12 digits.
export function ean13CheckDigit(digits12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

// Builds a stable in-store EAN-13 for a product from its database id.
// Prefix 200-299 is reserved for retailer-internal (in-store) codes.
export function generateEan13(product) {
  const base = `200${String(product.id).padStart(9, '0')}`;
  return base + ean13CheckDigit(base);
}

export default function Ean13Barcode({ value, width = 300, height = 80, fontSize = 14 }) {
  let bits = '101';
  const parity = PARITY[Number(value[0])];
  for (let i = 1; i <= 6; i++) {
    const d = Number(value[i]);
    bits += parity[i - 1] === 'L' ? L[d] : G[d];
  }
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[Number(value[i])];
  bits += '101';

  const barW = width / bits.length;
  const textH = fontSize + 4;
  return (
    <Svg width={width} height={height + textH}>
      {bits.split('').map((b, i) =>
        b === '1' ? (
          <Rect key={i} x={i * barW} y={0} width={barW + 0.5} height={height} fill="#000" />
        ) : null
      )}
      <SvgText x={0} y={height + textH - 3} fontSize={fontSize} fill="#000" fontFamily="Courier">
        {value.slice(0, 1)} {value.slice(1, 7)} {value.slice(7)}
      </SvgText>
    </Svg>
  );
}
