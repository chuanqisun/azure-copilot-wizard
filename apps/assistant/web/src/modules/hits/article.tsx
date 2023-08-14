import type { CardData } from "@h20/assistant-types";
import { useRef } from "preact/hooks";
import type { HitsDisplayNode } from "../display/display-node";
import "./article.css";
import { EntityIconComponent } from "./entity";
import { entityToCard } from "./entity-to-card";
import { getEntityUrl } from "./get-entity-url";

export interface HitsCardProps {
  node: HitsDisplayNode;
  isParent?: boolean;
  onClick: (cardData: CardData) => void;
}
export function HitsArticle({ node, onClick, isParent }: HitsCardProps) {
  const cardData = entityToCard(node.id, node.entityType, node.title);
  const buttonRef = useRef<HTMLAnchorElement>(null);

  const handleClickInternal = (e: MouseEvent) => {
    buttonRef.current?.classList.add("c-button--hits-clicked");
    if (!e.ctrlKey) {
      onClick(cardData);
      e.preventDefault();
    }
  };

  return (
    <>
      <li class={`c-list__item`} key={node.id} draggable={true}>
        <a
          ref={buttonRef}
          href={getEntityUrl(node.entityType, node.id)}
          target="_blank"
          class={`u-reset c-button--hits ${isParent ? "c-button--hits-parent" : "c-button--hits-child"}`}
          onClick={handleClickInternal}
        >
          <article class="hits-item">
            {EntityIconComponent[node.entityType]()}
            <div class="hits-item__text">
              <span class={`hits-item__title ${isParent ? "hits-item__title--parent" : ""}`} dangerouslySetInnerHTML={{ __html: node.titleHtml }} />{" "}
              {isParent ? (
                <>
                  {node.researchers && <span class="hits-item__meta-field" dangerouslySetInnerHTML={{ __html: node.researchersHtml }} />}
                  &nbsp;· <span class="hits-item__meta-field" dangerouslySetInnerHTML={{ __html: node.idHtml }} />
                  &nbsp;· <span class="hits-item__meta-field">{node.updatedOn.toLocaleDateString()}</span>
                </>
              ) : !isParent && node.id !== node.idHtml ? (
                <span class="hits-item__meta-field" dangerouslySetInnerHTML={{ __html: node.idHtml }} />
              ) : null}
            </div>
          </article>
        </a>
      </li>
      {isParent &&
        node.children.map((childNode) =>
          node.showAllChildren || childNode.hasHighlight ? <HitsArticle isParent={false} node={childNode as any as HitsDisplayNode} onClick={onClick} /> : null
        )}
    </>
  );
}
