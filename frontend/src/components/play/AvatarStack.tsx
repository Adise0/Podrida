import type { RoomMember } from "@podrida/shared";
import styled from "styled-components";
import { Avatar } from "../Avatar";

const Stack = styled.span`
  display: inline-flex;
  align-items: center;

  & > * {
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.surface};
  }

  & > * + * {
    margin-left: -8px;
  }
`;

const More = styled.span`
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.surfaceSunken};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 12px;
  font-weight: 600;
`;

// Who's at a table, at a glance. The names are in the label.
export function AvatarStack({ members, max = 5 }: { members: RoomMember[]; max?: number }) {
  const shown = members.slice(0, max);
  const hidden = members.length - shown.length;

  return (
    <Stack role="img" aria-label={members.map((member) => member.username).join(", ")}>
      {shown.map((member) => (
        <Avatar
          key={member.userId}
          src={member.avatarUrl}
          name={member.username}
          size={28}
          decorative
        />
      ))}
      {hidden > 0 && <More aria-hidden>+{hidden}</More>}
    </Stack>
  );
}
