import type React from "react";
import { useEffect, useState } from "react";
import { ForceGraph3D } from "react-force-graph";
import styled from "styled-components";

async function loadData() {
  const dataset = await fetch("/data/graph-viz-export.json").then((res) => res.json());
  const { predicateEdges, similarityEdges } = dataset as any;

  // console.log(predicateEdges, similarityEdges);

  function randomSampleArray(a: any[], count: number) {
    const shuffled = a.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  const linkSubset = [...randomSampleArray(predicateEdges, 4000), ...randomSampleArray(similarityEdges, 4000)] as { source: string; target: string }[];
  // const linkSubset = [...predicateEdges, ...similarityEdges] as { source: string; target: string }[];
  const nodeSubset = [...new Set(linkSubset.flatMap((link) => [link.source, link.target]))].map((id) => ({
    id,
  }));

  const nodeCardinality = new Map<string, number>();
  linkSubset.forEach((link) => {
    nodeCardinality.set(link.source, (nodeCardinality.get(link.source) ?? 0) + 1);
    nodeCardinality.set(link.target, (nodeCardinality.get(link.target) ?? 0) + 1);
  });

  const edgeCardinality = new Map<string, number>();
  linkSubset.forEach((link) => {
    const avgNodeCardinality = (nodeCardinality.get(link.source) ?? 0) + (nodeCardinality.get(link.target) ?? 0) / 2;
    edgeCardinality.set(link.source + link.target, avgNodeCardinality);
  });

  return {
    edgeCardinality,
    nodeCardinality,
    nodeSubset,
    linkSubset,
  };
}

export const OntologyGraph: React.FC = () => {
  const [graph, setGraph] = useState({
    nodes: [] as any[],
    links: [] as any[],
    nodeCardinality: new Map<string, number>(),
    edgeCardinality: new Map<string, number>(),
  });
  useEffect(() => {
    loadData().then((data) => {
      setGraph({
        nodes: data.nodeSubset,
        links: data.linkSubset,
        nodeCardinality: data.nodeCardinality,
        edgeCardinality: data.edgeCardinality,
      });
    });
  }, []);

  console.log(graph);

  return (
    <div>
      <StyledHeader>Technical demo | Microsoft HITS</StyledHeader>
      <ForceGraph3D
        warmupTicks={10}
        d3AlphaDecay={0.1}
        cooldownTime={30000}
        enableNodeDrag={false}
        linkOpacity={0.2}
        nodeVal={(n: any) => {
          return 1.5 * (graph.nodeCardinality.get(n.id) ?? 1);
        }}
        linkWidth={(l: any) => {
          const cardinality = graph.edgeCardinality.get(l.source + l.target) ?? 1;
          return (4 * cardinality) / (cardinality + 1) - 1;
        }}
        graphData={{ nodes: graph.nodes, links: graph.links }}
        nodeLabel={"id"}
        linkLabel={"predicate"}
        linkColor={(l) => (l.predicate === "_similar_" ? "lightgrey" : "white")}
        linkThreeObjectExtend={true}
      />
    </div>
  );
};

export default OntologyGraph;

const StyledHeader = styled.h1`
  color: white;
  background-color: black;
  padding: 2px;
  position: absolute;
  top: 80px;
  z-index: 100;
  left: 50%;
  transform: translateX(-50%);
`;
