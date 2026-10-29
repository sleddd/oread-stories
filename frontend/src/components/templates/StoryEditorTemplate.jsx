// The open story: its title on the left and its section tabs on the right, sharing one rule, with
// the section's content below. Stacks the tabs under the title on narrow screens.
import styled from "styled-components";
import { View, Row } from "../../ui/primitives/index.js";

const Header = styled(Row)`
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
  border-bottom: 1px solid ${({ theme }) => theme.colors.line};
  margin-bottom: 22px;
  & [role="tablist"] {
    border-bottom: 0;
    margin-bottom: -1px;
  }
`;

const Body = styled(View)`
  min-width: 0;
`;

export function StoryEditorTemplate({ title, tabs, body }) {
  return (
    <View>
      <Header>
        {title}
        {tabs}
      </Header>
      <Body>{body}</Body>
    </View>
  );
}
