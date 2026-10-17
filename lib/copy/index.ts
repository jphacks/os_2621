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
  summary: {
    title: "話の内容を整理しました",
    lead: "相手に見えるのは、下の文だけです。自由に書き換えられます。",
    visibleNote: "相手にはこの文だけが表示されます。",
    loading: "話を整理しています…",
    textLabel: "相手に見せる文",
    categoryLabel: "テーマ",
    tagsLabel: "キーワード（読点・カンマ区切り）",
    share: "この内容で共有する",
    decline: "共有しない",
    shareHint: "共有すると、似た悩みの人の候補を見られます。共有した内容は24時間で見えなくなります。",
    blocked: "今回は、人とつながる手順には進めません。よければ、もう少しAIと話したり、相談窓口を見てみてください。",
    failed: "整理がうまくいきませんでした。もう一度ためしますか？",
    retry: "もう一度ためす",
    noMessages: "まだ話がありません。先にAIと少し話してみましょう。",
    saveFailed: "共有できませんでした。時間をおいて、もう一度ためしてください。",
  },
  categories: {
    relationships: "人間関係",
    career: "進路・仕事",
    study: "勉強",
    family: "家族",
    loneliness: "孤独感",
    health: "からだ・心の調子",
    other: "その他",
  },

  candidates: {
    title: "似た経験をしている人",
    lead: "あなたが共有した内容と近い人です。つながるかどうかは、あなたが決められます。",
    loading: "探しています…",
    empty:
      "今は近い人が見つかりませんでした。リクエストを残しておくと、似た人が来たときに見つけてもらえます。",
    request: "つながりをお願いする",
    sent: "お願いしました",
    limit: "同時にお願いできるのは3人までです。",
    commonLabel: "共通点",
    fallbackCommon: "似たテーマで悩んでいる方です",
    toRequests: "リクエストの状況を見る",
    back: "要約に戻る",
    noSummary: "共有した内容がありません。先に話を整理しましょう。",
  },

  requests: {
    title: "つながりリクエスト",
    lead: "届いたお願いと、あなたが送ったお願いの状況です。断っても理由は伝わりません。",
    received: "届いたリクエスト",
    sentTitle: "送ったリクエスト",
    noneReceived: "まだ届いていません。",
    noneSent: "まだ送っていません。",
    accept: "承諾して話す",
    decline: "見送る",
    waiting: "返事を待っています",
    accepted: "承諾されました",
    declined: "今回は見送られました",
    expired: "期限が切れました",
    enter: "ルームに入る",
    toCandidates: "候補を見る",
    failed: "うまく処理できませんでした。もう一度ためしてください。",
  },

  settings: {
    title: "設定",
    nicknameTitle: "ニックネームを変える",
    nicknameSave: "変更する",
    nicknameSaved: "変更しました。",
    hotlinesTitle: "相談できる窓口",
    deleteTitle: "データを全部消す",
    deleteLead:
      "あなたのプロフィール・共有した要約・リクエスト・送ったメッセージ・気分の記録を消して、ログアウトします。元に戻せません。（ブロックと通報の記録は、安全のため残ります）",
    deleteStart: "全データを削除する",
    deleteConfirm: "本当に削除する",
    deleteCancel: "やめる",
    deleteFailed: "削除できませんでした。時間をおいて、もう一度ためしてください。",
  },
  room: {
    leave: "退出",
    block: "ブロック",
    report: "通報",
    reportTitle: "どんな理由ですか？",
    reportReasons: [
      { id: "aggressive", label: "攻撃的だった" },
      { id: "pii", label: "個人情報を聞かれた" },
      { id: "uncomfortable", label: "不快な内容だった" },
      { id: "other", label: "その他" },
    ],
    remaining: "残り",
    placeholder: "ここでは、ニックネームのまま、無理のない範囲でどうぞ",
    send: "送る",
    masked: "個人が特定できる情報は伏せました。",
    ai: "司会（AI）",
    partnerLeft: "相手が退出しました。",
    ended: "ルームは終了しました。",
    endedSafety: "ルームが終了しました。",
    endedReport: "通報を受け付けて、ルームを終了しました。",
    reviewTitle: "おつかれさまでした。今の気分はどうですか？",
    reviewLead: "答えは、あなたの記録のためだけに使います。",
    reviewSubmit: "記録して、AIと話す",
    reviewSkip: "候補に戻る",
    loadFailed: "ルームを開けませんでした。",
    demoNote: "（画面確認用のデモ表示です。実際の通信は行っていません）",
    sendFailed: "送れませんでした。もう一度ためしてください。",
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

export type CategoryId = keyof typeof COPY.categories;

export function avatarEmoji(id: string | null | undefined): string {
  return AVATARS.find((a) => a.id === id)?.emoji ?? "🙂";
}
