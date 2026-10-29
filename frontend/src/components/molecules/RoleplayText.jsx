// Draws a roleplay reply as paragraphs: *actions* and narration in muted serif italics, spoken
// words upright in the full text colour inside curly quotes, with *emphasis*, **bold**, `code`
// and ‘quoted phrases’ kept in place.
import styled from "styled-components";
import { View, Text } from "../../ui/primitives/index.js";
import { splitRoleplayParagraphs } from "../../lib/splitRoleplayParagraphs.js";

const Paragraphs = styled(View)`
  gap: 12px;
`;

const Paragraph = styled(Text)`
  display: block;
`;

const Narration = styled(Text)`
  color: ${({ theme }) => theme.colors.muted};
  font-style: italic;
`;

const Speech = styled(Text)`
  color: ${({ theme }) => theme.colors.ink};
  font-style: normal;
`;

// Emphasis keeps the colour around it; only the slant changes.
const Emphasis = styled(Text)`
  font-style: italic;
`;

const Bold = styled(Text)`
  font-weight: 700;
`;

const Code = styled(Text)`
  font-family: ${({ theme }) => theme.fonts.monospace};
  font-size: 14px;
  font-style: normal;
  background: ${({ theme }) => theme.colors.chip};
  padding: 0 4px;
  border-radius: 4px;
`;

// In a mixed paragraph the plain words are narration; in a speech paragraph they are spoken.
const PIECES_IN_SPEECH = {
  plain: Speech,
  speech: Speech,
  quoted: Speech,
  emphasis: Emphasis,
  bold: Bold,
  code: Code,
};
// Narration is already italic, so emphasis there just reads as narration.
const PIECES_IN_MIXED = {
  plain: Narration,
  speech: Speech,
  quoted: Speech,
  emphasis: Narration,
  bold: Bold,
  code: Code,
};

function Pieces({ pieces, components }) {
  return pieces.map((piece, position) => {
    const PieceComponent = components[piece.kind] ?? Text;
    return <PieceComponent key={position}>{piece.text}</PieceComponent>;
  });
}

function RoleplayParagraph({ paragraph }) {
  if (paragraph.kind === "action") {
    return (
      <Paragraph>
        <Narration>{paragraph.text}</Narration>
      </Paragraph>
    );
  }
  const components = paragraph.kind === "speech" ? PIECES_IN_SPEECH : PIECES_IN_MIXED;
  return (
    <Paragraph>
      <Pieces pieces={paragraph.pieces} components={components} />
    </Paragraph>
  );
}

export function RoleplayText({ text, className }) {
  const paragraphs = splitRoleplayParagraphs(text);
  return (
    <Paragraphs className={className}>
      {paragraphs.map((paragraph, position) => (
        <RoleplayParagraph key={position} paragraph={paragraph} />
      ))}
    </Paragraphs>
  );
}
