/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, Tooltip } from '@arco-design/web-react';
import { Down, Minus, Plus, Refresh, Up } from '@icon-park/react';
import { drag, type D3DragEvent } from 'd3-drag';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { select } from 'd3-selection';
import { type ZoomBehavior, zoom, zoomIdentity } from 'd3-zoom';
import { useTranslation } from 'react-i18next';

type ReasoningMetric = {
  title: string;
  count: number | string;
};

type ReasoningNode = {
  name: string;
  group?: number;
};

type ReasoningEdge = {
  source: string;
  target: string;
  value?: number;
  label?: string;
};

export type ReasoningCardData = {
  header: {
    title: string;
    des: string;
  };
  content?: {
    items?: ReasoningMetric[];
  };
  graph?: {
    nodes?: ReasoningNode[];
    edges?: ReasoningEdge[];
  };
  mermaid?: string;
};

type TacticalReasoningCardProps = {
  data: ReasoningCardData;
  mermaidRenderer?: React.ReactNode;
  renderMermaid?: (chart: string) => React.ReactNode;
  depth?: number;
  collapseSignal?: number;
};

type ThemePalette = {
  accent: string;
  accentSoft: string;
  accentMuted: string;
  border: string;
  panel: string;
  panelSoft: string;
  graphSurface: string;
  text: string;
  subtext: string;
  badgeText: string;
};

const THEME_MAP: Record<string, ThemePalette> = {
  red: {
    accent: '#dc2626',
    accentSoft: 'rgba(220, 38, 38, 0.12)',
    accentMuted: 'rgba(220, 38, 38, 0.07)',
    border: 'rgba(220, 38, 38, 0.22)',
    panel: 'linear-gradient(180deg, rgba(254, 242, 242, 0.96), rgba(255, 255, 255, 0.98))',
    panelSoft: 'rgba(255, 255, 255, 0.72)',
    graphSurface: 'rgba(255, 250, 250, 0.96)',
    text: '#7f1d1d',
    subtext: '#b91c1c',
    badgeText: '#991b1b',
  },
  emerald: {
    accent: '#059669',
    accentSoft: 'rgba(5, 150, 105, 0.12)',
    accentMuted: 'rgba(5, 150, 105, 0.07)',
    border: 'rgba(5, 150, 105, 0.22)',
    panel: 'linear-gradient(180deg, rgba(236, 253, 245, 0.96), rgba(255, 255, 255, 0.98))',
    panelSoft: 'rgba(255, 255, 255, 0.72)',
    graphSurface: 'rgba(245, 255, 250, 0.96)',
    text: '#064e3b',
    subtext: '#047857',
    badgeText: '#065f46',
  },
  amber: {
    accent: '#d97706',
    accentSoft: 'rgba(217, 119, 6, 0.12)',
    accentMuted: 'rgba(217, 119, 6, 0.07)',
    border: 'rgba(217, 119, 6, 0.22)',
    panel: 'linear-gradient(180deg, rgba(255, 251, 235, 0.96), rgba(255, 255, 255, 0.98))',
    panelSoft: 'rgba(255, 255, 255, 0.72)',
    graphSurface: 'rgba(255, 252, 245, 0.96)',
    text: '#78350f',
    subtext: '#b45309',
    badgeText: '#92400e',
  },
  blue: {
    accent: '#2563eb',
    accentSoft: 'rgba(37, 99, 235, 0.12)',
    accentMuted: 'rgba(37, 99, 235, 0.07)',
    border: 'rgba(37, 99, 235, 0.22)',
    panel: 'linear-gradient(180deg, rgba(239, 246, 255, 0.96), rgba(255, 255, 255, 0.98))',
    panelSoft: 'rgba(255, 255, 255, 0.72)',
    graphSurface: 'rgba(247, 250, 255, 0.96)',
    text: '#1e3a8a',
    subtext: '#1d4ed8',
    badgeText: '#1e40af',
  },
};

const DEFAULT_THEME = THEME_MAP.blue;

type LayoutNode = ReasoningNode &
  SimulationNodeDatum & {
    id: string;
  };

type LayoutEdge = Omit<ReasoningEdge, 'source' | 'target'> & SimulationLinkDatum<LayoutNode>;

type GraphHierarchy = {
  childMap: Map<string, string[]>;
  leafIds: Set<string>;
};

type VisibleGraph = {
  edges: ReasoningEdge[];
  nodes: ReasoningNode[];
};

const getNodeRadius = (name: string) => {
  return Math.max(18, Math.min(28, 12 + name.length * 1.6));
};

const getNodeFontSize = (name: string) => {
  return Math.max(10, Math.min(11, 12 - name.length * 0.08));
};

const getNodeX = (node: LayoutNode) => {
  return node.x ?? 0;
};

const getNodeY = (node: LayoutNode) => {
  return node.y ?? 0;
};

const getLayoutEdgeNode = (node: string | number | LayoutNode | undefined, nodeMap: Map<string, LayoutNode>) => {
  if (typeof node === 'object' && node) return node;
  return nodeMap.get(String(node ?? ''));
};

const getEdgeGeometry = (edge: LayoutEdge, nodeMap: Map<string, LayoutNode>) => {
  const source = getLayoutEdgeNode(edge.source, nodeMap);
  const target = getLayoutEdgeNode(edge.target, nodeMap);
  if (!source || !target) return null;

  const sourceX = getNodeX(source);
  const sourceY = getNodeY(source);
  const targetX = getNodeX(target);
  const targetY = getNodeY(target);
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const sourceRadius = getNodeRadius(source.name);
  const targetRadius = getNodeRadius(target.name);

  return {
    endX: targetX - (deltaX / distance) * (targetRadius + 8),
    endY: targetY - (deltaY / distance) * (targetRadius + 8),
    labelX: (sourceX + targetX) / 2,
    labelY: (sourceY + targetY) / 2 - 10,
    startX: sourceX + (deltaX / distance) * sourceRadius,
    startY: sourceY + (deltaY / distance) * sourceRadius,
  };
};

const buildGraphSimulationData = (nodes: ReasoningNode[], edges: ReasoningEdge[]) => {
  const width = 640;
  const height = 300;
  const centerX = width / 2;
  const centerY = height / 2;
  const orbitRadius = Math.max(72, Math.min(118, 50 + nodes.length * 6));

  const layoutNodes: LayoutNode[] = nodes.map((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1) - Math.PI / 2;
    return {
      ...node,
      id: node.name,
      x: centerX + Math.cos(angle) * orbitRadius,
      y: centerY + Math.sin(angle) * orbitRadius,
    };
  });

  const layoutEdges: LayoutEdge[] = edges.map((edge) => ({
    ...edge,
    source: edge.source,
    target: edge.target,
  }));

  return {
    height,
    nodes: layoutNodes,
    edges: layoutEdges,
    width,
  };
};

const buildGraphHierarchy = (nodes: ReasoningNode[], edges: ReasoningEdge[]): GraphHierarchy => {
  const nodeIds = new Set(nodes.map((node) => node.name));
  const childMap = new Map<string, string[]>();

  nodes.forEach((node) => {
    childMap.set(node.name, []);
  });

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return;
    childMap.get(edge.source)?.push(edge.target);
  });

  const leafIds = new Set(
    nodes.filter((node) => (childMap.get(node.name)?.length ?? 0) === 0).map((node) => node.name)
  );

  return { childMap, leafIds };
};

const getCollapsedDescendants = (nodeId: string, childMap: Map<string, string[]>) => {
  const descendants = new Set<string>();
  const queue = [...(childMap.get(nodeId) ?? [])];

  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index];
    if (currentId === nodeId || descendants.has(currentId)) continue;
    descendants.add(currentId);
    queue.push(...(childMap.get(currentId) ?? []));
  }

  return descendants;
};

const getVisibleGraph = (
  nodes: ReasoningNode[],
  edges: ReasoningEdge[],
  collapsedIds: Set<string>,
  childMap: Map<string, string[]>,
  leafOnly: boolean,
  leafIds: Set<string>
): VisibleGraph => {
  if (leafOnly) {
    const visibleNodes = nodes.filter((node) => leafIds.has(node.name));
    const visibleIds = new Set(visibleNodes.map((node) => node.name));
    const visibleEdges = edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));

    return { nodes: visibleNodes, edges: visibleEdges };
  }

  const hiddenIds = new Set<string>();

  collapsedIds.forEach((nodeId) => {
    getCollapsedDescendants(nodeId, childMap).forEach((descendantId) => hiddenIds.add(descendantId));
  });

  const visibleNodes = nodes.filter((node) => !hiddenIds.has(node.name));
  const visibleIds = new Set(visibleNodes.map((node) => node.name));
  const visibleEdges = edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));

  return { nodes: visibleNodes, edges: visibleEdges };
};

const GraphViz: React.FC<{
  childMap: Map<string, string[]>;
  edges: ReasoningEdge[];
  leafIds: Set<string>;
  nodes: ReasoningNode[];
  onToggleNode: (nodeId: string) => void;
  palette: ThemePalette;
}> = ({ childMap, nodes, edges, leafIds, onToggleNode, palette }) => {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const markerId = useId().replace(/:/g, '-');
  const {
    nodes: layoutNodes,
    edges: layoutEdges,
    width,
    height,
  } = useMemo(() => buildGraphSimulationData(nodes, edges), [edges, nodes]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();
    svg.on('.zoom', null);
    svg.style('cursor', 'grab');

    const defs = svg.append('defs');
    defs
      .append('marker')
      .attr('id', markerId)
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 9)
      .attr('refY', 5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .attr('fill', palette.accent);

    const viewport = svg.append('g').attr('data-layer', 'viewport');
    const edgeLayer = viewport.append('g').attr('data-layer', 'edges');
    const nodeLayer = viewport.append('g').attr('data-layer', 'nodes');

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.7, 2.4])
      .extent([
        [0, 0],
        [640, 300],
      ])
      .translateExtent([
        [-160, -120],
        [800, 420],
      ])
      .on('start', () => {
        svg.style('cursor', 'grabbing');
      })
      .on('zoom', (event) => {
        viewport.attr('transform', event.transform.toString());
      })
      .on('end', () => {
        svg.style('cursor', 'grab');
      });

    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior);
    svg.call(zoomBehavior.transform, zoomIdentity);

    const nodeMap = new Map(layoutNodes.map((node) => [node.id, node]));

    const edgeGroups = edgeLayer
      .selectAll<SVGGElement, LayoutEdge>('g')
      .data(layoutEdges, (datum, index) => {
        const source = getLayoutEdgeNode(datum.source, nodeMap);
        const target = getLayoutEdgeNode(datum.target, nodeMap);
        return `${source?.id ?? 'unknown'}-${target?.id ?? 'unknown'}-${index}`;
      })
      .join((enter) => {
        const group = enter.append('g');
        group.append('line');
        group.append('rect');
        group.append('text');
        return group;
      });

    edgeGroups
      .select('line')
      .attr('stroke', palette.accent)
      .attr('stroke-opacity', 0.7)
      .attr('stroke-width', 2)
      .attr('marker-end', `url(#${markerId})`);

    edgeGroups
      .select('rect')
      .attr('width', 84)
      .attr('height', 20)
      .attr('rx', 10)
      .attr('fill', 'rgba(255, 255, 255, 0.96)')
      .attr('stroke', palette.border)
      .attr('display', (datum) => (datum.label ? null : 'none'));

    edgeGroups
      .select('text')
      .attr('text-anchor', 'middle')
      .attr('fill', palette.subtext)
      .attr('font-size', 11)
      .attr('display', (datum) => (datum.label ? null : 'none'))
      .text((datum) => datum.label ?? '');

    const nodeGroups = nodeLayer
      .selectAll<SVGGElement, LayoutNode>('g')
      .data(layoutNodes, (datum) => datum.id)
      .join((enter) => {
        const group = enter.append('g');
        group.append('circle').attr('data-node-ring', 'halo');
        group.append('circle').attr('data-node-ring', 'inner');
        group.append('circle').attr('data-node-ring', 'outer');
        group.append('text');
        return group;
      });

    nodeGroups
      .style('cursor', (datum) => ((childMap.get(datum.id)?.length ?? 0) > 0 ? 'pointer' : 'default'))
      .on('click', (event: MouseEvent, datum) => {
        if (event.defaultPrevented) return;
        if ((childMap.get(datum.id)?.length ?? 0) === 0) return;
        onToggleNode(datum.id);
      });

    nodeGroups
      .select('circle[data-node-ring="halo"]')
      .attr('r', (datum) => getNodeRadius(datum.name) + (leafIds.has(datum.id) ? 11 : 8))
      .attr('fill', (datum) => (leafIds.has(datum.id) ? palette.accentSoft : 'transparent'))
      .attr('stroke', (datum) => (leafIds.has(datum.id) ? palette.accent : palette.border))
      .attr('stroke-opacity', (datum) => (leafIds.has(datum.id) ? 0.35 : 0.16))
      .attr('stroke-width', 1);

    nodeGroups
      .select('circle[data-node-ring="inner"]')
      .attr('r', (datum) => getNodeRadius(datum.name))
      .attr('fill', 'rgba(255, 255, 255, 0.98)')
      .attr('stroke', palette.accent)
      .attr('stroke-width', 2);

    nodeGroups
      .select('circle[data-node-ring="outer"]')
      .attr('r', (datum) => getNodeRadius(datum.name) + 5)
      .attr('fill', 'none')
      .attr('stroke', palette.border)
      .attr('stroke-dasharray', '4 4');

    nodeGroups
      .select('text')
      .attr('text-anchor', 'middle')
      .attr('fill', palette.text)
      .attr('font-size', (datum) => getNodeFontSize(datum.name))
      .attr('font-weight', 700)
      .text((datum) => datum.name);

    const simulation = forceSimulation(layoutNodes)
      .force(
        'link',
        forceLink<LayoutNode, LayoutEdge>(layoutEdges)
          .id((node) => node.id)
          .distance((edge) => {
            const source = getLayoutEdgeNode(edge.source, nodeMap);
            const target = getLayoutEdgeNode(edge.target, nodeMap);
            const sourceName = source?.name ?? '';
            const targetName = target?.name ?? '';
            return Math.max(90, Math.min(150, 66 + (sourceName.length + targetName.length) * 2.5));
          })
          .strength(0.78)
      )
      .force('charge', forceManyBody().strength(-560))
      .force(
        'collide',
        forceCollide<LayoutNode>().radius((node) => getNodeRadius(node.name) + 18)
      )
      .force('center', forceCenter(width / 2, height / 2))
      .force('x', forceX<LayoutNode>(width / 2).strength(0.03))
      .force('y', forceY<LayoutNode>(height / 2).strength(0.03));

    const clampNode = (node: LayoutNode) => {
      const radius = getNodeRadius(node.name) + 24;
      node.x = Math.max(radius, Math.min(width - radius, getNodeX(node)));
      node.y = Math.max(radius, Math.min(height - radius, getNodeY(node)));
    };

    const ticked = () => {
      layoutNodes.forEach(clampNode);

      edgeGroups
        .select('line')
        .attr('x1', (datum) => getEdgeGeometry(datum, nodeMap)?.startX ?? 0)
        .attr('y1', (datum) => getEdgeGeometry(datum, nodeMap)?.startY ?? 0)
        .attr('x2', (datum) => getEdgeGeometry(datum, nodeMap)?.endX ?? 0)
        .attr('y2', (datum) => getEdgeGeometry(datum, nodeMap)?.endY ?? 0);

      edgeGroups
        .select('rect')
        .attr('x', (datum) => (getEdgeGeometry(datum, nodeMap)?.labelX ?? 0) - 42)
        .attr('y', (datum) => (getEdgeGeometry(datum, nodeMap)?.labelY ?? 0) - 12);

      edgeGroups
        .select('text')
        .attr('x', (datum) => getEdgeGeometry(datum, nodeMap)?.labelX ?? 0)
        .attr('y', (datum) => (getEdgeGeometry(datum, nodeMap)?.labelY ?? 0) + 2);

      nodeGroups.select('circle[data-node-ring="halo"]').attr('cx', getNodeX).attr('cy', getNodeY);
      nodeGroups.select('circle[data-node-ring="inner"]').attr('cx', getNodeX).attr('cy', getNodeY);
      nodeGroups.select('circle[data-node-ring="outer"]').attr('cx', getNodeX).attr('cy', getNodeY);
      nodeGroups.select('text').attr('x', getNodeX).attr('y', (datum) => getNodeY(datum) + 4);
    };

    const handleDragStart = (event: D3DragEvent<SVGGElement, LayoutNode, LayoutNode>, datum: LayoutNode) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      datum.fx = getNodeX(datum);
      datum.fy = getNodeY(datum);
    };

    const handleDrag = (event: D3DragEvent<SVGGElement, LayoutNode, LayoutNode>, datum: LayoutNode) => {
      datum.fx = Math.max(getNodeRadius(datum.name), Math.min(width - getNodeRadius(datum.name), event.x));
      datum.fy = Math.max(getNodeRadius(datum.name), Math.min(height - getNodeRadius(datum.name), event.y));
    };

    const handleDragEnd = (event: D3DragEvent<SVGGElement, LayoutNode, LayoutNode>, datum: LayoutNode) => {
      if (!event.active) simulation.alphaTarget(0);
      datum.fx = null;
      datum.fy = null;
    };

    nodeGroups.call(
      drag<SVGGElement, LayoutNode>()
        .on('start', handleDragStart)
        .on('drag', handleDrag)
        .on('end', handleDragEnd)
    );

    simulation.on('tick', ticked);
    ticked();

    return () => {
      simulation.stop();
    };
  }, [
    childMap,
    height,
    layoutNodes,
    layoutEdges,
    markerId,
    leafIds,
    onToggleNode,
    palette.accent,
    palette.accentSoft,
    palette.border,
    palette.subtext,
    palette.text,
    t,
    width,
  ]);

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    select(svgRef.current).call(zoomBehaviorRef.current.scaleBy, 1.2);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    select(svgRef.current).call(zoomBehaviorRef.current.scaleBy, 0.85);
  };

  const handleZoomReset = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    select(svgRef.current).call(zoomBehaviorRef.current.transform, zoomIdentity);
  };

  if (!layoutNodes.length) {
    return (
      <div
        style={{
          minHeight: 260,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}
      >
        {t('messages.tacticalReasoning.emptyGraph')}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', overflow: 'hidden', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1,
          display: 'flex',
          gap: 6,
        }}
      >
        <Tooltip content={t('messages.tacticalReasoning.zoomOut')}>
          <Button
            type='text'
            icon={<Minus theme='outline' size='14' />}
            onClick={handleZoomOut}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: `1px solid ${palette.border}`,
              background: 'rgba(255, 255, 255, 0.94)',
              color: palette.text,
              fontSize: 14,
              lineHeight: '28px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          />
        </Tooltip>
        <Tooltip content={t('messages.tacticalReasoning.resetView')}>
          <Button
            type='text'
            icon={<Refresh theme='outline' size='14' />}
            onClick={handleZoomReset}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: `1px solid ${palette.border}`,
              background: 'rgba(255, 255, 255, 0.94)',
              color: palette.text,
              fontSize: 12,
              lineHeight: '28px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          />
        </Tooltip>
        <Tooltip content={t('messages.tacticalReasoning.zoomIn')}>
          <Button
            type='text'
            icon={<Plus theme='outline' size='14' />}
            onClick={handleZoomIn}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: `1px solid ${palette.border}`,
              background: 'rgba(255, 255, 255, 0.94)',
              color: palette.text,
              fontSize: 14,
              lineHeight: '28px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          />
        </Tooltip>
      </div>
      <svg
        ref={svgRef}
        viewBox='0 0 640 300'
        style={{ width: '100%', minWidth: 520, height: 300, display: 'block', touchAction: 'none' }}
      />
    </div>
  );
};

const TacticalReasoningCard: React.FC<TacticalReasoningCardProps> = ({
  data,
  mermaidRenderer,
  depth = 0,
  collapseSignal,
}) => {
  const { t } = useTranslation();
  const collapseSignalRef = useRef<number | undefined>(collapseSignal);
  const [showMetrics, setShowMetrics] = useState(true);
  const [showTopology, setShowTopology] = useState(true);
  const [graphLeafOnly, setGraphLeafOnly] = useState(true);
  const [collapsedGraphNodeIds, setCollapsedGraphNodeIds] = useState<Set<string>>(() => new Set());
  const palette = DEFAULT_THEME;
  const metrics = data.content?.items || [];
  const graphNodes = data.graph?.nodes || [];
  const graphEdges = data.graph?.edges || [];
  const hasMetrics = metrics.length > 0;
  const hasGraph = graphNodes.length > 0 || graphEdges.length > 0 || Boolean(data.mermaid);
  const graphHierarchy = useMemo(() => buildGraphHierarchy(graphNodes, graphEdges), [graphEdges, graphNodes]);
  const visibleGraph = useMemo(
    () =>
      getVisibleGraph(
        graphNodes,
        graphEdges,
        collapsedGraphNodeIds,
        graphHierarchy.childMap,
        graphLeafOnly,
        graphHierarchy.leafIds
      ),
    [collapsedGraphNodeIds, graphEdges, graphHierarchy.childMap, graphHierarchy.leafIds, graphLeafOnly, graphNodes]
  );

  const handleMetricsToggle = () => {
    setShowMetrics((value) => {
      const nextValue = !value;
      if (!nextValue) {
        setShowTopology(false);
      }
      return nextValue;
    });
  };

  useEffect(() => {
    if (collapseSignal === undefined || collapseSignalRef.current === collapseSignal) return;
    collapseSignalRef.current = collapseSignal;
    setShowMetrics(false);
    setShowTopology(false);
  }, [collapseSignal]);

  useEffect(() => {
    setGraphLeafOnly(true);
    setCollapsedGraphNodeIds(new Set());
  }, [graphEdges, graphNodes]);

  const toggleGraphNode = useMemo(() => {
    return (nodeId: string) => {
      setGraphLeafOnly(false);
      setCollapsedGraphNodeIds((value) => {
        const nextValue = new Set(value);
        if (nextValue.has(nodeId)) {
          nextValue.delete(nodeId);
        } else {
          nextValue.add(nodeId);
        }
        return nextValue;
      });
    };
  }, []);

  const collapseAllGraphNodes = () => {
    setGraphLeafOnly(true);
    setCollapsedGraphNodeIds(new Set());
  };

  const expandAllGraphNodes = () => {
    setGraphLeafOnly(false);
    setCollapsedGraphNodeIds(new Set());
  };

  const shellStyle: React.CSSProperties = {
    borderRadius: depth > 0 ? 14 : 16,
    border: `1px solid ${palette.border}`,
    background: palette.panel,
    boxShadow:
      depth > 0
        ? `inset 0 1px 0 ${palette.accentMuted}, 0 6px 18px rgba(15, 23, 42, 0.06)`
        : `inset 0 1px 0 ${palette.accentMuted}, 0 10px 28px rgba(15, 23, 42, 0.08)`,
    overflow: 'hidden',
    position: 'relative',
  };

  const sectionStyle: React.CSSProperties = {
    padding: '14px 16px',
    borderTop: `1px solid ${palette.border}`,
    background: palette.panelSoft,
  };

  const toggleButtonStyle: React.CSSProperties = {
    marginTop: 12,
    borderRadius: 999,
    border: `1px solid ${palette.border}`,
    background: palette.accentSoft,
    color: palette.badgeText,
    fontSize: 11,
    lineHeight: '16px',
    fontWeight: 700,
    padding: '6px 10px',
    cursor: 'pointer',
  };

  const graphActionStyle: React.CSSProperties = {
    borderRadius: 999,
    border: `1px solid ${palette.border}`,
    background: 'rgba(255, 255, 255, 0.86)',
    color: palette.badgeText,
    fontSize: 12,
    fontWeight: 700,
    height: 28,
    padding: '0 10px',
  };

  return (
    <div style={{ margin: depth > 0 ? '10px 0 0' : '12px 0', width: '100%' }}>
      <div style={shellStyle}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundImage: `linear-gradient(90deg, transparent 0%, ${palette.accentMuted} 50%, transparent 100%), linear-gradient(${palette.accentMuted} 1px, transparent 1px), linear-gradient(90deg, ${palette.accentMuted} 1px, transparent 1px)`,
            backgroundSize: '100% 100%, 20px 20px, 20px 20px',
            backgroundPosition: '0 0, 0 0, 0 0',
          }}
        />
        <div style={{ padding: '16px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: palette.accent,
                    boxShadow: `0 0 0 4px ${palette.accentSoft}`,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    color: palette.subtext,
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  {t('messages.tacticalReasoning.title')}
                </span>
              </div>
              <div style={{ color: palette.text, fontSize: 18, lineHeight: '24px', fontWeight: 800 }}>
                {data.header.title}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: '20px', marginTop: 6 }}>
                {data.header.des}
              </div>
            </div>
            <div
              style={{
                flexShrink: 0,
                minWidth: 88,
                textAlign: 'right',
                color: palette.subtext,
                fontSize: 11,
                lineHeight: '16px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <div>{t('messages.tacticalReasoning.mode')}</div>
              <div style={{ color: palette.text, fontSize: 14, fontWeight: 800, marginTop: 2 }}>
                {t('messages.tacticalReasoning.hud')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {hasMetrics ? (
              <Button type='text' style={toggleButtonStyle} onClick={handleMetricsToggle}>
                {showMetrics
                  ? t('messages.tacticalReasoning.hideMetrics')
                  : t('messages.tacticalReasoning.showMetrics')}
              </Button>
            ) : null}
          </div>
        </div>

        {showMetrics && hasMetrics ? (
          <div style={sectionStyle}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 10,
              }}
            >
              {metrics.map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${palette.border}`,
                    background: 'rgba(255, 255, 255, 0.84)',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: 11,
                      lineHeight: '16px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.title}
                  </div>
                  <div style={{ color: palette.text, fontSize: 24, lineHeight: '28px', fontWeight: 800, marginTop: 6 }}>
                    {item.count}
                  </div>
                </div>
              ))}
            </div>
            {hasGraph ? (
              <Button type='text' style={toggleButtonStyle} onClick={() => setShowTopology((value) => !value)}>
                {showTopology
                  ? t('messages.tacticalReasoning.hideTopology')
                  : t('messages.tacticalReasoning.showTopology')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {showTopology && hasGraph ? (
          <div style={sectionStyle}>
            {!data.mermaid ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div style={{ color: palette.text, fontSize: 13, fontWeight: 800 }}>
                  {t('messages.tacticalReasoning.topologyTitle')}
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, marginLeft: 8 }}>
                    {t('messages.tacticalReasoning.visibleNodes', {
                      count: visibleGraph.nodes.length,
                      total: graphNodes.length,
                    })}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <Button
                    type='text'
                    icon={<Down theme='outline' size='14' />}
                    style={graphActionStyle}
                    onClick={collapseAllGraphNodes}
                  >
                    {t('messages.tacticalReasoning.collapseGraph')}
                  </Button>
                  <Button
                    type='text'
                    icon={<Up theme='outline' size='14' />}
                    style={graphActionStyle}
                    onClick={expandAllGraphNodes}
                  >
                    {t('messages.tacticalReasoning.expandGraph')}
                  </Button>
                </div>
              </div>
            ) : null}
            <div
              style={{
                borderRadius: 14,
                border: `1px solid ${palette.border}`,
                background: palette.graphSurface,
                overflow: 'hidden',
                padding: 12,
              }}
            >
              {data.mermaid ? (
                mermaidRenderer
              ) : (
                <GraphViz
                  childMap={graphHierarchy.childMap}
                  nodes={visibleGraph.nodes}
                  edges={visibleGraph.edges}
                  leafIds={graphHierarchy.leafIds}
                  onToggleNode={toggleGraphNode}
                  palette={palette}
                />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TacticalReasoningCard;
