// Draws roleplay text with *actions* in muted italics, **bold**, "speech" and `code`.
import styled from "styled-components";
import { Text } from "../../ui/primitives/index.js";
import { parseRoleplayText } from "../../lib/parseRoleplayText.js";

const Action = styled(Text)`
  color: ${({ theme }) => theme.colors.muted};
  font-style: italic;
`;

const Bold = styled(Text)`
  font-weight: 700;
`;

const Speech = styled(Text)`
  color: ${({ theme }) => theme.colors.ink};
`;

const Code = styled(Text)`
  font-family: ${({ theme }) => theme.fonts.monospace};
  font-size: 14px;
  background: ${({ theme }) => theme.colors.chip};
  padding: 0 4px;
  border-radius: 4px;
`;

const PIECE_COMPONENTS = { plain: Text, action: Action, bold: Bold, speech: Speech, code: Code };

export function RoleplayText({ text }) {
  const pieces = parseRoleplayText(text);
  return pieces.map((piece, position) => {
    const PieceComponent = PIECE_COMPONENTS[piece.kind];
    return <PieceComponent key={position}>{piece.text}</PieceComponent>;
  });
}
