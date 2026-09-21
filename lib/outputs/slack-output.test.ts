import { describe, expect, it } from "bun:test";

import { markdownToSlackMrkdwn } from "./slack-output";

describe("markdownToSlackMrkdwn", () => {
  it("converts bold and italic", () => {
    expect(markdownToSlackMrkdwn("**bold** and *italic*")).toBe(
      "*bold* and _italic_",
    );
  });

  // Regression: the in-place converter turned this into "__both__".
  it("converts bold italic once", () => {
    expect(markdownToSlackMrkdwn("***both***")).toBe("*_both_*");
  });

  // Regression: headings came out as literal "**Title**", and AI reports
  // routinely open with a bold heading.
  it("does not double-wrap a heading that is already bold", () => {
    expect(markdownToSlackMrkdwn("# **Title**")).toBe("*Title*");
    expect(markdownToSlackMrkdwn("## Plain title")).toBe("*Plain title*");
  });

  // Regression: arithmetic was rewritten as "2 _ 3 _ 4".
  it("leaves asterisks that are not emphasis alone", () => {
    expect(markdownToSlackMrkdwn("2 * 3 * 4")).toBe("2 * 3 * 4");
  });

  it("converts links, bullets and strikethrough", () => {
    expect(
      markdownToSlackMrkdwn("* item [docs](https://x.test/a)\n~~old~~"),
    ).toBe("• item <https://x.test/a|docs>\n~old~");
  });

  it("keeps code untouched and fences tables", () => {
    expect(markdownToSlackMrkdwn("`**raw**`")).toBe("`**raw**`");
    expect(markdownToSlackMrkdwn("```\n**raw**\n```")).toBe(
      "```\n**raw**\n```",
    );
    expect(markdownToSlackMrkdwn("| a | b |\n|---|---|\n| 1 | 2 |")).toBe(
      "```\n| a | b |\n|---|---|\n| 1 | 2 |\n```",
    );
  });

  it("converts a heading containing a link", () => {
    expect(markdownToSlackMrkdwn("# [Report](https://x.test)")).toBe(
      "*<https://x.test|Report>*",
    );
  });
});
