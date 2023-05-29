import { memo, useState } from "react";
import { Handle, Position } from "reactflow";
import styled from "styled-components";

export interface ListNodeProps {
  data: string;
}
export const MarkdownListNode = memo(({ data }: ListNodeProps) => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <StyledNode className={isEditing ? "nodrag" : undefined}>
      <h1>Markdown list</h1>
      <textarea onFocus={() => setIsEditing(true)} onBlur={() => setIsEditing(false)}>
        {data}
      </textarea>
      <Handle type="source" position={Position.Bottom} />
    </StyledNode>
  );
});

const StyledNode = styled.div`
  background-color: #fff;
  padding: 8px;
`;
