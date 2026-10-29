// The personality mixer's layout: a toolbar on top, controls on the left and the prompt they
// produce on the right (stacked when narrow), with a footer note.
import styled from "styled-components";
import { View, Row, Text } from "../../ui/primitives/index.js";

const Toolbar = styled(Row)`
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
`;

const ToolbarActions = styled(Row)`
  gap: 10px;
  margin-left: auto;
`;

const Columns = styled(View)`
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const OutputColumn = styled(View)`
  position: sticky;
  top: 12px;
  @media (max-width: 1100px) {
    position: static;
  }
`;

const Footer = styled(Text)`
  display: block;
  margin-top: 12px;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 14.5px;
`;

export function PersonalityTemplate({ toolbar, toolbarActions, controls, output, footer }) {
  return (
    <View>
      <Toolbar>
        {toolbar}
        {toolbarActions && <ToolbarActions>{toolbarActions}</ToolbarActions>}
      </Toolbar>
      <Columns>
        <View>{controls}</View>
        <OutputColumn>{output}</OutputColumn>
      </Columns>
      <Footer>{footer}</Footer>
    </View>
  );
}
