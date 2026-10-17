import { describe, expect, it } from "vitest";
import { maskPII } from "@/lib/safety/piiMask";

describe("lib/safety/piiMask - maskPII", () => {
  describe("1. 電話番号のマスク（固定・携帯・ハイフン有無・全角対応）", () => {
    const phoneSamples = [
      { label: "携帯番号（ハイフンあり）", text: "私の番号は 090-1234-5678 です" },
      { label: "携帯番号（080・ハイフンなし）", text: "08012345678に電話してください" },
      { label: "携帯番号（070・スペース区切り）", text: "連絡先は 070 1111 2222 です" },
      { label: "固定電話（東京03・ハイフンあり）", text: "実家は 03-1234-5678 です" },
      { label: "固定電話（地方局番・括弧つき）", text: "番号は 06(1234)5678 になります" },
      { label: "固定電話（ハイフンなし10桁）", text: "0312345678までお願いします" },
      { label: "IP電話（050）", text: "050-1234-5678 を使ってます" },
      { label: "フリーダイヤル（0120）", text: "0120-279-338 にかけました" },
      { label: "全角数字・全角ハイフンの携帯番号", text: "０９０ー１２３４ー５６７８まで連絡して" },
      { label: "国際電話番号表記（+81）", text: "+81-90-1234-5678 にSMS送って" },
    ];

    it.each(phoneSamples)(
      "$label: 「$text」がマスクされ masked: true になること",
      ({ text }) => {
        const result = maskPII(text);
        expect(result.masked).toBe(true);
        expect(result.text).toContain("***");
        expect(result.text).not.toMatch(/1234|5678|2222|279/);
      }
    );
  });

  describe("2. メールアドレスのマスク", () => {
    const emailSamples = [
      { label: "一般的なメールアドレス", text: "メールは taro.yamada@example.com です" },
      { label: "プラス記号・サブドメイン付き", text: "連絡先: user+test123@mail.university.ac.jp まで" },
      { label: "全角＠を含むメールアドレス", text: "アドレスは dummy_user＠example.co.jp です" },
    ];

    it.each(emailSamples)(
      "$label: 「$text」がマスクされ masked: true になること",
      ({ text }) => {
        const result = maskPII(text);
        expect(result.masked).toBe(true);
        expect(result.text).toContain("***");
        expect(result.text).not.toMatch(/example|university/);
      }
    );
  });

  describe("3. Web URL（http/https・短縮URL）のマスク", () => {
    const urlSamples = [
      { label: "https URL", text: "プロフィールは https://example.com/users/12345 を見てね" },
      { label: "http URL", text: "ブログ http://my-blog.test/entry?id=1 を書いてます" },
      { label: "www. から始まるURL", text: "サイトは www.example.com/profile です" },
      { label: "短縮URL (bit.ly)", text: "ここから飛べます bit.ly/3xyzAbC" },
      { label: "短縮URL (t.co)", text: "リンク t.co/AbCdEf1234 です" },
      { label: "短縮URL (x.gd)", text: "x.gd/abc12 を開いてみて" },
      { label: "LINE友だち追加URL (lin.ee)", text: "公式アカウント lin.ee/AbCdEfG を追加して" },
      { label: "SNSプロフィールURL (instagram.com)", text: "instagram.com/my_secret_account が私のアカウントです" },
    ];

    it.each(urlSamples)(
      "$label: 「$text」がマスクされ masked: true になること",
      ({ text }) => {
        const result = maskPII(text);
        expect(result.masked).toBe(true);
        expect(result.text).toContain("***");
      }
    );
  });

  describe("4. @ハンドル（SNSアカウント）のマスク", () => {
    const handleSamples = [
      { label: "半角@ハンドル（文中）", text: "よかったら @hidamari_user123 をフォローしてください" },
      { label: "半角@ハンドル（文頭）", text: "@test_account_99 が私の裏垢です" },
      { label: "全角＠ハンドル", text: "アカウントは ＠sample.user_01 です" },
    ];

    it.each(handleSamples)(
      "$label: 「$text」がマスクされ masked: true になること",
      ({ text }) => {
        const result = maskPII(text);
        expect(result.masked).toBe(true);
        expect(result.text).toContain("***");
        expect(result.text).not.toMatch(/hidamari_user123|test_account_99|sample\.user_01/);
      }
    );
  });

  describe("5. 「LINE」「インスタ」「X」「Twitter」「カカオ」等のID提示・交換表現のマスク", () => {
    const snsExchangeSamples = [
      { label: "LINE IDの直接提示（コロン）", text: "LINE ID: hidamari_01 に連絡して" },
      { label: "LINEのID提示（助詞）", text: "私のLINEのIDは abc_def_123 です" },
      { label: "カタカナ「ライン」でのID提示", text: "ライン：sample_line99 を検索してみて" },
      { label: "LINE交換の誘い", text: "もっと話したいからLINE交換しようよ" },
      { label: "LINEを聞く表現", text: "よかったらライン教えてくれませんか？" },
      { label: "インスタのID提示", text: "インスタは Secret_Insta99 でやってます" },
      { label: "インスタ交換の誘い", text: "インスタ交換しませんか？" },
      { label: "XのID提示", text: "XのID: x_handle_2026 です" },
      { label: "Xでの繋がり誘導", text: "今度Xで繋がろう！" },
      { label: "TwitterのID提示", text: "Twitterのアカウントは tw_user_001 です" },
      { label: "Twitterを聞く表現", text: "ツイッター教えて！" },
      { label: "カカオのID提示", text: "カカオID: kakao_talk_77 で待ってます" },
      { label: "カカオ交換の誘い", text: "カカオ交換しよう" },
      { label: "DiscordのID提示", text: "DiscordのIDは gamer_1234 です" },
      { label: "単独のID表記", text: "検索用 ID: secret_peer_01 です" },
    ];

    it.each(snsExchangeSamples)(
      "$label: 「$text」がマスクされ masked: true になること",
      ({ text }) => {
        const result = maskPII(text);
        expect(result.masked).toBe(true);
        expect(result.text).toContain("***");
      }
    );
  });

  describe("6. 複数の個人情報が混在するケース", () => {
    it("電話番号とメールアドレスと@ハンドルが同時に含まれる場合、すべて「***」に置換されること", () => {
      const input =
        "連絡先は 090-1111-2222 か test@example.com、または @my_sns_id までお願いします。";
      const result = maskPII(input);
      expect(result.masked).toBe(true);
      expect(result.text).toBe(
        "連絡先は *** か ***、または *** までお願いします。"
      );
    });
  });

  describe("7. 通常の悩み相談テキスト（誤検知しないことの確認）", () => {
    const safeSamples = [
      "新しいサークルで居場所がないと感じています。誰かと話したいです。",
      "大学3年生になって就活が始まったけど、やりたいことが見つかりません。",
      "毎日2時間くらいしか眠れなくて、朝起きるのがつらいです。",
      "2026年の春から一人暮らしを始めましたが、友達がまだ1人もいません。",
      "テストで100点満点中40点しか取れなくて落ち込んでいます。",
      "空文字のテスト用サンプルではなく通常の文章です。",
    ];

    it.each(safeSamples)(
      "通常の文章「%s」はマスクされず masked: false で元の文字列が返ること",
      (text) => {
        const result = maskPII(text);
        expect(result.masked).toBe(false);
        expect(result.text).toBe(text);
      }
    );

    it("空文字列を渡した場合は masked: false, text: '' を返すこと", () => {
      expect(maskPII("")).toEqual({ text: "", masked: false });
    });
  });
});
