import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export const useD3Graph = ({
  svgRef,
  nodes,
  onNodeDrag,
}) => {
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);

    // Setup drag handler
    const dragBehavior = d3
      .drag()
      .on('start', function () {
        isDraggingRef.current = false;
      })
      .on('drag', function (event, d) {
        isDraggingRef.current = true;
        if (onNodeDrag && d) {
          onNodeDrag(d.id, Math.round(event.x), Math.round(event.y));
        }
      })
      .on('end', function () {
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 50);
      });

    // Safely bind datum to each node element without failing on uninitialized data keys
    svg.selectAll('.node-group').each(function () {
      const nodeId = Number(this.getAttribute('data-node-id'));
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        d3.select(this).datum(node).call(dragBehavior);
      }
    });
  }, [nodes, svgRef, onNodeDrag]);

  return { isDraggingRef };
};
