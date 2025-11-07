/**
 * Copyright (c) 2022—present Michael Dougall. All rights reserved.
 *
 * This repository utilizes multiple licenses across different directories. To
 * see this files license find the nearest LICENSE file up the source tree.
 */
import { type TriplexMeta } from "@triplex/bridge/client";
import { getTriplexMeta, hasTriplexMeta } from "../../util/meta";
import { type SelectionState } from "../selection-provider/types";

export interface ResolvedNode {
  meta: TriplexMeta;
  node: Node;
}

/**
 * **resolveDOMNodes()**
 *
 * Traverses the DOM scene to find all matching objects based on the filter.
 * Objects can match either by a direct match, or by having a parent that
 * matches the filter. The meta in each return object is the meta from the
 * matching direct or parent object.
 */
/**
 * **hasAncestorWithMeta()**
 *
 * Checks if a node has a DOM ancestor that either:
 * 1. Has meta matching the target meta, OR
 * 2. Has the target meta in its parents chain
 *
 * This ensures that when we match against parent meta, we only match nodes
 * that are actually descendants of that parent in the DOM tree. This handles
 * both regular DOM elements and non-rendering components like Fragment.
 *
 * Returns true if:
 * - An ancestor with matching meta is found, OR
 * - No triplex-tagged ancestors exist (allowing non-rendering parent components)
 */
function hasAncestorWithMeta(
  node: Node,
  targetMeta: { path: string; column: number; line: number },
): boolean {
  let current = node.parentElement;
  let foundAnyTriplexAncestor = false;

  while (current) {
    if (hasTriplexMeta(current)) {
      foundAnyTriplexAncestor = true;
      const ancestorMeta = getTriplexMeta(current);
      if (ancestorMeta) {
        // Check if the ancestor itself matches the target
        if (
          ancestorMeta.path === targetMeta.path &&
          ancestorMeta.column === targetMeta.column &&
          ancestorMeta.line === targetMeta.line
        ) {
          return true;
        }

        // Check if the ancestor has the target in its parents
        for (const parent of ancestorMeta.parents) {
          if (
            parent.path === targetMeta.path &&
            parent.column === targetMeta.column &&
            parent.line === targetMeta.line
          ) {
            return true;
          }
        }
      }
    }
    current = current.parentElement;
  }

  // If we didn't find any triplex-tagged ancestors, allow the match
  // This handles cases like Fragment where the parent doesn't render a DOM element
  return !foundAnyTriplexAncestor;
}

export function resolveDOMNodes(selections: SelectionState[]): ResolvedNode[] {
  const nodes: ResolvedNode[] = [];
  const iterator = document.createNodeIterator(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    (node) => {
      if (hasTriplexMeta(node)) {
        return NodeFilter.FILTER_ACCEPT;
      } else {
        return NodeFilter.FILTER_REJECT;
      }
    },
  );

  let node = iterator.nextNode();

  while (node) {
    const meta = getTriplexMeta(node);
    if (!meta) {
      continue;
    }

    const isDirectMatch = selections.findIndex(
      (filter) =>
        filter.path === meta.path &&
        filter.column === meta.column &&
        filter.line === meta.line,
    );

    if (isDirectMatch !== -1) {
      nodes.push({
        meta,
        node,
      });
    } else {
      for (const parent of meta.parents) {
        // Check the parents in the meta to see if they are a match and if so resolve the object.
        const isParentMatch = selections.findIndex(
          (filter) =>
            filter.path === parent.path &&
            filter.column === parent.column &&
            filter.line === parent.line,
        );

        // Only add the node if the parent match exists AND the parent is an actual
        // DOM ancestor of the current node
        if (
          isParentMatch !== -1 &&
          hasAncestorWithMeta(node, {
            column: parent.column,
            line: parent.line,
            path: parent.path,
          })
        ) {
          nodes.push({
            meta: parent,
            node,
          });
          break;
        }
      }
    }

    node = iterator.nextNode();
  }

  return nodes;
}

export function resolveElementsFromPoint(
  points: { clientX: number; clientY: number },
  { root }: { root: HTMLElement },
) {
  const previousPointerEvents = root.style.pointerEvents;
  // Enable pointer events so the browser can perform hit detection.
  root.style.pointerEvents = "all";
  const elements = document
    .elementsFromPoint(points.clientX, points.clientY)
    .filter((element) => root.contains(element));
  // Revert to the original pointer events value.
  root.style.pointerEvents = previousPointerEvents;

  return elements;
}
