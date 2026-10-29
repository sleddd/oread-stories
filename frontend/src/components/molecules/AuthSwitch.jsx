// The line under a sign-in form that moves to another one: "New to Oread? Create an account".
import styled from "styled-components";
import { Row, Text } from "../../ui/primitives/index.js";
import { LinkButton } from "../atoms/index.js";

const Line = styled(Row)`
  gap: 6px;
  flex-wrap: wrap;
`;

const Question = styled(Text)`
  color: ${({ theme }) => theme.colors.muted};
  font-size: 14.5px;
`;

export function AuthSwitch({ question, actionLabel, onPress }) {
  return (
    <Line>
      {question && <Question>{question}</Question>}
      <LinkButton label={actionLabel} onPress={onPress} />
    </Line>
  );
}
