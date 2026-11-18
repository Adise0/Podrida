import { Link } from "react-router";
import styled from "styled-components";
import { Row } from "../../components/ui/layout";

// The pieces of the admin list pages (users, games): a filter bar, the table, and its footer.

export const Filters = styled.div<{ $columns?: string }>`
  display: grid;
  grid-template-columns: ${({ $columns = "2fr repeat(3, 1fr)" }) => $columns};
  gap: ${({ theme }) => theme.space(3)};
  padding: ${({ theme }) => theme.space(5)};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  ${({ theme }) => theme.media.small} {
    grid-template-columns: 1fr 1fr;

    & > :first-child {
      grid-column: 1 / -1;
    }
  }
`;

export const TableScroll = styled.div`
  overflow-x: auto;
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;

  th,
  td {
    padding: ${({ theme }) => `${theme.space(3)} ${theme.space(5)}`};
    text-align: left;
    vertical-align: middle;
    white-space: nowrap;
  }

  th {
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  tbody tr {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }

  tbody tr:hover {
    background: ${({ theme }) => theme.colors.surfaceSunken};
  }
`;

export const RowLink = styled(Link)`
  color: ${({ theme }) => theme.colors.text};
  font-weight: 600;
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
  }
`;

export const TableFooter = styled(Row)`
  padding: ${({ theme }) => theme.space(4)} ${({ theme }) => theme.space(5)};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

export const TableEmpty = styled.div`
  display: grid;
  place-items: center;
  gap: ${({ theme }) => theme.space(2)};
  padding: ${({ theme }) => theme.space(12)};
  color: ${({ theme }) => theme.colors.textMuted};
`;
