// UI上のやさしい文言集（Cさん担当）。文言の修正はここだけで完結させる。

export const COPY = {
  appName: "ひだまり",
  disclaimer:
    "AIや仲間は専門家の代わりではありません。診断や治療のアドバイスは行いません。",
  disclaimerShort: "※ AIや仲間は専門家の代わりではありません。",
  emergency: "緊急の危険があるときは、110番・119番に連絡してください。",
  generalError: "うまくつながりませんでした。少し時間をおいて、もう一度ためしてください。",

  top: {
    lead: "AIに今の気持ちを話して、あなたが望んだときだけ、同じような悩みを持つ人とゆるやかにつながれる場所です。",
    points: [
      "ニックネームだけで使えます。本名や連絡先は必要ありません。",
      "人とつながるかどうかは、いつもあなたが決めます。",
      "つらくなったら、いつでもやめられます。",
    ],
    notices: [
      "AIや仲間は専門家の代わりではありません（医療的な診断や治療は行いません）。",
      "本名・連絡先・SNSアカウントなどの個人情報は、入力も交換もしないでください。",
      "緊急の危険がある場合は、110番・119番、または専門の相談窓口へご連絡ください。",
    ],
    consent: "上の内容を読み、理解しました。",
    start: "はじめる",
  },

  start: {
    title: "ニックネームとアイコンを選びましょう",
    lead: "ここでの名前は、あなただけの匿名の名前です。本名は使わないでください。",
    nicknameLabel: "ニックネーム（2〜12文字）",
    nicknamePlaceholder: "例：ひなたぼっこ",
    avatarLabel: "アイコン",
    errors: {
      length: "ニックネームは2〜12文字で入力してください。",
      pii: "メールアドレス・電話番号・URLのように見える文字は使えません。",
      signIn: "はじめられませんでした。時間をおいて、もう一度ためしてください。",
    },
    submit: "この名前ではじめる",
  },

  checkin: {
    title: "今のあなたの調子を教えてください",
    lead: "答えたくなければ、そのまま進んでも大丈夫です。無理のないペースでいきましょう。",
    moodLabel: "気分",
    energyLabel: "エネルギー",
    moodScale: ["とてもつらい", "つらい", "ふつう", "まずまず", "いい感じ"],
    energyScale: ["ぐったり", "だるい", "ふつう", "動ける", "元気"],
    submit: "AIと話してみる",
    savingError: "記録は保存できませんでしたが、このまま進めます。",
  },

  consult: {
    title: "AIに話してみる",
    placeholder: "いま感じていることを、そのまま書いてみてください",
    send: "送る",
    organize: "話を整理する",
    organizeHint: "ここまでの話をまとめて、似た悩みの人とつながるか考えられます。",
    empty: "どんなことでも大丈夫です。話せるところから、ゆっくりどうぞ。",
    thinking: "考えています…",
    matchingBlocked: "今は少し時間をおきましょう。人とのつながりは、また気持ちが落ち着いてからにしましょう。",
    crisisTitle: "いま、とてもつらい状況かもしれません",
    crisisBody:
      "話してくれてありがとうございます。いまは専門の相談員に話を聞いてもらうのが一番安心です。電話は無料でかけられるものもあります。",
    crisisButton: "相談窓口を見る",
    newSession: "新しい相談をはじめる",
  },

  crisis: {
    title: "いま、頼れる相談窓口",
    lead: "ひとりで抱え込まなくて大丈夫です。話を聞いてくれる人がいます。AIや仲間は専門家の代わりではありません。",
    guideTitle: "少しだけ、呼吸を整えてみませんか",
    guide:
      "足の裏が床についている感覚を確かめて、4秒かけて鼻から息を吸い、6秒かけてゆっくり吐いてみましょう。数回くり返すだけで大丈夫です。",
    back: "AI相談に戻る",
    top: "トップへ戻る",
  },
} as const;

export const AVATARS = [
  { id: "sun", emoji: "☀️", label: "おひさま" },
  { id: "cloud", emoji: "☁️", label: "くも" },
  { id: "leaf", emoji: "🍃", label: "はっぱ" },
  { id: "moon", emoji: "🌙", label: "つき" },
  { id: "tea", emoji: "🍵", label: "おちゃ" },
  { id: "cat", emoji: "🐈", label: "ねこ" },
  { id: "bird", emoji: "🐦", label: "ことり" },
  { id: "flower", emoji: "🌼", label: "はな" },
] as const;

export function avatarEmoji(id: string | null | undefined): string {
  return AVATARS.find((a) => a.id === id)?.emoji ?? "🙂";
}
