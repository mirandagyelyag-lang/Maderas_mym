import { Fragment } from "react";

function RoleplayText({ content = "" }) {
  const lines = String(content).split("\n");

  return (
    <span className="roleplay-text">
      {lines.map((line, lineIndex) => (
        <Fragment key={`${lineIndex}-${line.slice(0, 12)}`}>
          {line.startsWith("> ") ? (
            <span className="roleplay-text__quote">
              {renderInline(line.slice(2), lineIndex)}
            </span>
          ) : (
            renderInline(line, lineIndex)
          )}
          {lineIndex < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </span>
  );
}

function renderInline(text, lineIndex) {
  const tokens = [];
  let cursor = 0;
  let tokenIndex = 0;

  while (cursor < text.length) {
    const match = findNextToken(text, cursor);

    if (!match) {
      tokens.push(text.slice(cursor));
      break;
    }

    if (match.start > cursor) tokens.push(text.slice(cursor, match.start));

    tokens.push(
      <span
        key={`${lineIndex}-${tokenIndex}`}
        className={`roleplay-text__${match.type}`}
      >
        {match.content}
      </span>
    );

    tokenIndex += 1;
    cursor = match.end;
  }

  return tokens;
}

function findNextToken(text, from) {
  const definitions = [
    { type: "strong-emphasis", open: "***", close: "***" },
    { type: "bold", open: "**", close: "**" },
    { type: "thought-marked", open: "*/", close: "/*" },
    { type: "thought", open: "//", close: "//" },
    { type: "instruction", open: "[", close: "]" },
    { type: "narration", open: "*", close: "*" },
    { type: "thought", open: "/", close: "/" },
    { type: "strike", open: "~~", close: "~~" },
  ];

  let winner = null;

  for (const definition of definitions) {
    const start = text.indexOf(definition.open, from);
    if (start === -1) continue;

    const contentStart = start + definition.open.length;
    const close = text.indexOf(definition.close, contentStart);
    if (close === -1 || close === contentStart) continue;

    if (definition.type === "thought") {
      const before = text[start - 1] || " ";
      const after = text[close + 1] || " ";
      if (/\w/.test(before) || /\w/.test(after)) continue;
    }

    const candidate = {
      type: definition.type,
      start,
      end: close + definition.close.length,
      content: text.slice(contentStart, close),
    };

    if (!winner || candidate.start < winner.start) winner = candidate;
  }

  return winner;
}

export default RoleplayText;
