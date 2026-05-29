/** @type {import("@commitlint/types").UserConfig} */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // 許容する type を spec §5 / CLAUDE.md に揃える
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "refactor", "test", "docs", "chore", "perf", "ci", "build", "style", "revert"],
    ],
    // 日本語タイトルを考慮して subject ケース制限を無効化
    "subject-case": [0],
    // ヘッダー長は日本語で説明的にしたいので 100 まで許容
    "header-max-length": [2, "always", 100],
    // body / footer の空行は守らせる
    "body-leading-blank": [2, "always"],
    "footer-leading-blank": [2, "always"],
  },
};

export default config;
