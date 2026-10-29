// Layout boxes. Like React Native's View, they stack their children vertically by default.
import styled from "styled-components";

export const View = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

export const Row = styled(View)`
  flex-direction: row;
  align-items: center;
`;
