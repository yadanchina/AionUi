/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force';
import { select } from 'd3-selection';
import { type ZoomBehavior, zoom, zoomIdentity } from 'd3-zoom';

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
  theme?: string;
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
  children?: ReasoningCardData[];
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

const resolveTheme = (theme?: string): ThemePalette => {
  if (!theme) return DEFAULT_THEME;
  return THEME_MAP[theme] || DEFAULT_THEME;
};

type LayoutNode = ReasoningNode & {
  id: string;
  x: number;
  y: number;
};

type LayoutEdge = Omit<ReasoningEdge, 'source' | 'target'> & {
  source: string | LayoutNode;
  target: string | LayoutNode;
};

type RenderedEdge = {
  endX: number;
  endY: number;
  index: number;
  label?: string;
  labelX: number;
  labelY: number;
  sourceId: string;
  startX: number;
  startY: number;
  targetId: string;
};

const getNodeRadius = (name: string) => {
  return Math.max(18, Math.min(28, 12 + name.length * 1.6));
};

const getNodeFontSize = (name: string) => {
  return Math.max(10, Math.min(11, 12 - name.length * 0.08));
};

const buildGraphLayout = (nodes: ReasoningNode[], edges: ReasoningEdge[]) => {
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

  const simulation = forceSimulation(layoutNodes)
    .force(
      'link',
      forceLink<LayoutNode, LayoutEdge>(layoutEdges)
        .id((node) => node.id)
        .distance((edge) => {
          const sourceName = typeof edge.source === 'string' ? edge.source : edge.source.name;
          const targetName = typeof edge.target === 'string' ? edge.target : edge.target.name;
          return Math.max(84, Math.min(140, 62 + (sourceName.length + targetName.length) * 2.5));
        })
        .strength(0.9)
    )
    .force('charge', forceManyBody().strength(-520))
    .force(
      'collide',
      forceCollide<LayoutNode>().radius((node) => getNodeRadius(node.name) + 12)
    )
    .force('center', forceCenter(centerX, centerY));

  for (let index = 0; index < 220; index += 1) {
    simulation.tick();
  }

  simulation.stop();

  return {
    nodes: layoutNodes.map((node) => ({
      ...node,
      x: Math.max(48, Math.min(width - 48, node.x)),
      y: Math.max(48, Math.min(height - 48, node.y)),
    })),
    edges: layoutEdges,
  };
};

const GraphViz: React.FC<{ nodes: ReasoningNode[]; edges: ReasoningEdge[]; palette: ThemePalette }> = ({ nodes, edges, palette }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const markerId = useId().replace(/:/g, '-');
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => buildGraphLayout(nodes, edges), [edges, nodes]);
  const nodeMap = useMemo(() => new Map(layoutNodes.map((node) => [node.name, node])), [layoutNodes]);
  const renderedEdges = useMemo<RenderedEdge[]>(() => {
    return layoutEdges.flatMap((edge, index) => {
      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.name;
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target.name;
      const source = nodeMap.get(sourceId);
      const target = nodeMap.get(targetId);
      if (!source || !target) return [];

      const labelX = (source.x + target.x) / 2;
      const labelY = (source.y + target.y) / 2 - 10;
      const deltaX = target.x - source.x;
      const deltaY = target.y - source.y;
      const distance = Math.hypot(deltaX, deltaY) || 1;
      const sourceRadius = getNodeRadius(source.name);
      const targetRadius = getNodeRadius(target.name);

      return [
        {
          endX: target.x - (deltaX / distance) * (targetRadius + 8),
          endY: target.y - (deltaY / distance) * (targetRadius + 8),
          index,
          label: edge.label,
          labelX,
          labelY,
          sourceId,
          startX: source.x + (deltaX / distance) * sourceRadius,
          startY: source.y + (deltaY / distance) * sourceRadius,
          targetId,
        },
      ];
    });
  }, [layoutEdges, nodeMap]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();
    svg.on('.zoom', null);
    svg.style('cursor', 'grab');

    const defs = svg.append('defs');
    defs.append('marker').attr('id', markerId).attr('viewBox', '0 0 10 10').attr('refX', 9).attr('refY', 5).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto-start-reverse').append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z').attr('fill', palette.accent);

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

    const edgeGroups = edgeLayer
      .selectAll<SVGGElement, RenderedEdge>('g')
      .data(renderedEdges, (datum) => `${datum.sourceId}-${datum.targetId}-${datum.index}`)
      .join((enter) => {
        const group = enter.append('g');
        group.append('line');
        group.append('rect');
        group.append('text');
        return group;
      });

    edgeGroups
      .select('line')
      .attr('x1', (datum) => datum.startX)
      .attr('y1', (datum) => datum.startY)
      .attr('x2', (datum) => datum.endX)
      .attr('y2', (datum) => datum.endY)
      .attr('stroke', palette.accent)
      .attr('stroke-opacity', 0.7)
      .attr('stroke-width', 2)
      .attr('marker-end', `url(#${markerId})`);

    edgeGroups
      .select('rect')
      .attr('x', (datum) => datum.labelX - 42)
      .attr('y', (datum) => datum.labelY - 12)
      .attr('width', 84)
      .attr('height', 20)
      .attr('rx', 10)
      .attr('fill', 'rgba(255, 255, 255, 0.96)')
      .attr('stroke', palette.border)
      .attr('display', (datum) => (datum.label ? null : 'none'));

    edgeGroups
      .select('text')
      .attr('x', (datum) => datum.labelX)
      .attr('y', (datum) => datum.labelY + 2)
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
        group.append('circle').attr('data-node-ring', 'inner');
        group.append('circle').attr('data-node-ring', 'outer');
        group.append('text');
        return group;
      });

    nodeGroups
      .select('circle[data-node-ring="inner"]')
      .attr('cx', (datum) => datum.x)
      .attr('cy', (datum) => datum.y)
      .attr('r', (datum) => getNodeRadius(datum.name))
      .attr('fill', 'rgba(255, 255, 255, 0.98)')
      .attr('stroke', palette.accent)
      .attr('stroke-width', 2);

    nodeGroups
      .select('circle[data-node-ring="outer"]')
      .attr('cx', (datum) => datum.x)
      .attr('cy', (datum) => datum.y)
      .attr('r', (datum) => getNodeRadius(datum.name) + 5)
      .attr('fill', 'none')
      .attr('stroke', palette.border)
      .attr('stroke-dasharray', '4 4');

    nodeGroups
      .select('text')
      .attr('x', (datum) => datum.x)
      .attr('y', (datum) => datum.y + 4)
      .attr('text-anchor', 'middle')
      .attr('fill', palette.text)
      .attr('font-size', (datum) => getNodeFontSize(datum.name))
      .attr('font-weight', 700)
      .text((datum) => datum.name);
  }, [layoutNodes, markerId, palette.accent, palette.border, palette.subtext, palette.text, renderedEdges]);

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
        No graph data
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
        <button
          type='button'
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
        >
          -
        </button>
        <button
          type='button'
          onClick={handleZoomReset}
          style={{
            minWidth: 40,
            height: 28,
            borderRadius: 999,
            border: `1px solid ${palette.border}`,
            background: 'rgba(255, 255, 255, 0.94)',
            color: palette.text,
            fontSize: 11,
            lineHeight: '28px',
            fontWeight: 700,
            padding: '0 10px',
            cursor: 'pointer',
          }}
        >
          1:1
        </button>
        <button
          type='button'
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
        >
          +
        </button>
      </div>
      <svg ref={svgRef} viewBox='0 0 640 300' style={{ width: '100%', minWidth: 520, height: 300, display: 'block', touchAction: 'none' }} />
    </div>
  );
};

const TacticalReasoningCard: React.FC<TacticalReasoningCardProps> = ({ data, mermaidRenderer, renderMermaid, depth = 0, collapseSignal }) => {
  const collapseSignalRef = useRef<number | undefined>(collapseSignal);
  const [showMetrics, setShowMetrics] = useState(true);
  const [showTopology, setShowTopology] = useState(true);
  const [showChildren, setShowChildren] = useState(true);
  const [childCollapseVersion, setChildCollapseVersion] = useState(0);
  const palette = resolveTheme(data.theme);
  const metrics = data.content?.items || [];
  const graphNodes = data.graph?.nodes || [];
  const graphEdges = data.graph?.edges || [];
  const childCards = data.children || [];
  const hasMetrics = metrics.length > 0;
  const hasGraph = graphNodes.length > 0 || graphEdges.length > 0 || Boolean(data.mermaid);
  const hasChildren = childCards.length > 0;

  const handleMetricsToggle = () => {
    setShowMetrics((value) => {
      const nextValue = !value;
      if (!nextValue) {
        setShowTopology(false);
      }
      return nextValue;
    });
  };

  const handleChildrenToggle = () => {
    setShowChildren((value) => {
      const nextValue = !value;
      if (!nextValue) {
        setChildCollapseVersion((version) => version + 1);
      }
      return nextValue;
    });
  };

  useEffect(() => {
    if (collapseSignal === undefined || collapseSignalRef.current === collapseSignal) return;
    collapseSignalRef.current = collapseSignal;
    setShowChildren(false);
    setChildCollapseVersion((version) => version + 1);
  }, [collapseSignal]);

  const shellStyle: React.CSSProperties = {
    borderRadius: depth > 0 ? 14 : 16,
    border: `1px solid ${palette.border}`,
    background: palette.panel,
    boxShadow: depth > 0 ? `inset 0 1px 0 ${palette.accentMuted}, 0 6px 18px rgba(15, 23, 42, 0.06)` : `inset 0 1px 0 ${palette.accentMuted}, 0 10px 28px rgba(15, 23, 42, 0.08)`,
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

  const childRailStyle: React.CSSProperties = {
    marginTop: 12,
    paddingLeft: depth > 0 ? 12 : 16,
    borderLeft: `2px solid ${palette.border}`,
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
                <span style={{ color: palette.subtext, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Tactical Reasoning</span>
              </div>
              <div style={{ color: palette.text, fontSize: 18, lineHeight: '24px', fontWeight: 800 }}>{data.header.title}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: '20px', marginTop: 6 }}>{data.header.des}</div>
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
              <div>Mode</div>
              <div style={{ color: palette.text, fontSize: 14, fontWeight: 800, marginTop: 2 }}>HUD</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {hasMetrics ? (
              <button type='button' style={toggleButtonStyle} onClick={handleMetricsToggle}>
                {showMetrics ? 'Hide Tactical Metrics' : 'Show Tactical Metrics'}
              </button>
            ) : null}
            {hasChildren ? (
              <button type='button' style={toggleButtonStyle} onClick={handleChildrenToggle}>
                {showChildren ? 'Hide Child Cards' : 'Show Child Cards'}
              </button>
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
                  <div style={{ color: 'var(--text-secondary)', fontSize: 11, lineHeight: '16px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{item.title}</div>
                  <div style={{ color: palette.text, fontSize: 24, lineHeight: '28px', fontWeight: 800, marginTop: 6 }}>{item.count}</div>
                </div>
              ))}
            </div>
            {hasGraph ? (
              <button type='button' style={toggleButtonStyle} onClick={() => setShowTopology((value) => !value)}>
                {showTopology ? 'Hide Tactical Topology' : 'Show Tactical Topology'}
              </button>
            ) : null}
          </div>
        ) : null}

        {showTopology && hasGraph ? (
          <div style={sectionStyle}>
            <div
              style={{
                borderRadius: 14,
                border: `1px solid ${palette.border}`,
                background: palette.graphSurface,
                overflow: 'hidden',
                padding: 12,
              }}
            >
              {data.mermaid ? mermaidRenderer : <GraphViz nodes={graphNodes} edges={graphEdges} palette={palette} />}
            </div>
          </div>
        ) : null}

        {hasChildren ? (
          <div style={{ ...sectionStyle, display: showChildren ? 'block' : 'none' }}>
            <div style={childRailStyle}>
              {childCards.map((child, index) => (
                <TacticalReasoningCard key={`${child.header.title}-${index}`} data={child} mermaidRenderer={child.mermaid ? renderMermaid?.(child.mermaid) : undefined} renderMermaid={renderMermaid} depth={depth + 1} collapseSignal={childCollapseVersion} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TacticalReasoningCard;
