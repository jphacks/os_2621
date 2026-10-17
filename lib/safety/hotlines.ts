/**
 * 公的相談窓口リスト
 *
 * 【重要・注意】
 * ここに記載されている窓口の電話番号・受付時間・料金等の情報は、
 * 公開・本番運用前に必ず公式サイトで最新情報を確認してください。
 * （参考: 厚生労働省「まもろうよ こころ」、各窓口公式サイト）
 */

export interface Hotline {
  id: string;
  name: string;
  phone: string;
  hours: string;
  description: string;
  cost?: string;
  isEmergency?: boolean;
}

export const HOTLINES: readonly Hotline[] = [
  {
    id: "police",
    name: "警察",
    phone: "110",
    hours: "24時間",
    description: "今すぐ命の危険がある、事件・事故などの緊急時",
    cost: "通話料無料",
    isEmergency: true,
  },
  {
    id: "ambulance",
    name: "救急・消防",
    phone: "119",
    hours: "24時間",
    description: "今すぐ救急車が必要なケガ・急病などの緊急時",
    cost: "通話料無料",
    isEmergency: true,
  },
  {
    id: "yorisoi",
    name: "よりそいホットライン",
    phone: "0120-279-338",
    hours: "24時間",
    description: "どんな悩みでも相談できる公的な24時間通話無料の相談窓口です。",
    cost: "無料",
    isEmergency: false,
  },
  {
    id: "inochi-sos",
    name: "#いのちSOS",
    phone: "0120-061-338",
    hours: "24時間（年中無休）",
    description: "生きるのがつらい、死にたいと考えてしまう方のための相談窓口です。",
    cost: "無料",
    isEmergency: false,
  },
  {
    id: "inochi-no-denwa",
    name: "いのちの電話（ナビダイヤル）",
    phone: "0570-783-556",
    hours: "午前10時〜午後10時",
    description: "こころの悩みを相談できる電話相談窓口です（毎月10日は 0120-783-556 で24時間受付）。",
    cost: "ナビダイヤル通話料がかかります",
    isEmergency: false,
  },
] as const;

