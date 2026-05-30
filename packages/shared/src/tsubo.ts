/**
 * 平方メートル ↔ 坪 の換算ユーティリティ。
 *
 * 1 坪 = 約 3.30579 ㎡ （= 6 尺 × 6 尺）。
 * 不動産業界の実務慣行に合わせ、1 ㎡ = 0.3025 坪 を採用する。
 */

const SQUARE_METER_TO_TSUBO = 0.3025;

/**
 * 平方メートル値を坪に換算する。
 *
 * @param squareMeter 専有面積（㎡）。負値は不正。
 * @param fractionDigits 小数点以下桁数（既定: 2）。
 * @returns 坪数（fractionDigits 桁で丸めた値）。
 */
export const squareMeterToTsubo = (squareMeter: number, fractionDigits = 2): number => {
  if (!Number.isFinite(squareMeter) || squareMeter < 0) {
    throw new RangeError(`squareMeter は 0 以上の有限数である必要があります: ${squareMeter}`);
  }
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0) {
    throw new RangeError(`fractionDigits は 0 以上の整数である必要があります: ${fractionDigits}`);
  }
  const tsubo = squareMeter * SQUARE_METER_TO_TSUBO;
  const factor = 10 ** fractionDigits;
  return Math.round(tsubo * factor) / factor;
};

/**
 * 坪を平方メートルに換算する（参考用、Sanity preview では未使用）。
 */
export const tsuboToSquareMeter = (tsubo: number, fractionDigits = 2): number => {
  if (!Number.isFinite(tsubo) || tsubo < 0) {
    throw new RangeError(`tsubo は 0 以上の有限数である必要があります: ${tsubo}`);
  }
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0) {
    throw new RangeError(`fractionDigits は 0 以上の整数である必要があります: ${fractionDigits}`);
  }
  const squareMeter = tsubo / SQUARE_METER_TO_TSUBO;
  const factor = 10 ** fractionDigits;
  return Math.round(squareMeter * factor) / factor;
};
