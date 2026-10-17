// 個人情報のマスク（電話番号・メール・URL・@ハンドル・SNSのID交換）。純粋関数。
// 要約（P4）とルームのメッセージの両方に使う（SPEC §5.7）。

const MASK = "***";

const SNS_NAMES = "LINE|ＬＩＮＥ|ライン|インスタ|instagram|insta|twitter|ツイッター|ツイッターアカ|discord|ディスコード|tiktok|ティックトック|カカオ|kakao|telegram";

const PATTERNS: RegExp[] = [
  // メールアドレス
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  // URL
  /(?:https?:\/\/|www\.)[^\s　]+/gi,
  // 電話番号（ハイフン・空白あり/なし、国際表記）
  /(?:\+81[-\s]?)?0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/g,
  /\b\d{10,11}\b/g,
  // SNS名 + ID/アカウント + 実際のID文字列
  new RegExp(String.raw`(?:${SNS_NAMES})\s*(?:の)?\s*(?:ID|id|ＩＤ|アカウント|アカ)?\s*(?:は|：|:|＝|=)?\s*@?[A-Za-z0-9._-]{3,}`, "gi"),
  // X は誤爆しやすいので「Xのid / Xアカウント」のように明示されたときだけ
  /(?:X|Ｘ)\s*(?:の)?\s*(?:ID|id|アカウント|アカ)\s*(?:は|：|:|＝|=)?\s*@?[A-Za-z0-9._-]{3,}/g,
  // @ハンドル
  /(?<![A-Za-z0-9._])@[A-Za-z0-9._]{3,}/g,
];

export function maskPii(input: string): { text: string; masked: boolean } {
  let text = input;
  for (const pattern of PATTERNS) text = text.replace(pattern, MASK);
  return { text, masked: text !== input };
}
