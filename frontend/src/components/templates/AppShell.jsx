// The whole screen: the top bar, the current page below it, and the floating toast.
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";

const Screen = styled(View)`
  height: 100%;
`;

const PageArea = styled(View)`
  flex: 1;
  min-height: 0;
  overflow: ${({ $scrolls }) => ($scrolls ? "auto" : "hidden")};
`;

export function AppShell({ header, page, pageScrolls, toast }) {
  return (
    <Screen>
      {header}
      <PageArea as="main" $scrolls={pageScrolls}>
        {page}
      </PageArea>
      {toast}
    </Screen>
  );
}
