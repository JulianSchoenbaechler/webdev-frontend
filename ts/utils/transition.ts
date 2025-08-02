/*!
 * CSS transition utility functions used in frontend development.
 *
 * Author: Julian Schönbächler (https://julian-s.ch/ | info@julian-s.ch)
 * Copyright: Julian Schönbächler, 2025
 * License: MPL-2.0
 */

// Utilities generally run on browsers newer than >= 2015 (if transpiled accordingly) and even IE 11 (using polyfills).
// The source targets ES2020.

// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not
// distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
//______________________________________________________________________________________________________________________

import { waitForNextRepaint } from './general.ts';

/**
 * Extract transition duration (in ms) from a CSS style declaration.
 *
 * @param computedStyles - The computed CSS styles declaration.
 */
function extractTransitionDuration(computedStyles: CSSStyleDeclaration) {
    if (computedStyles.transition && computedStyles.transition !== 'none') {
        let duration = parseFloat(computedStyles.transitionDuration);

        if (isNaN(duration)) {
            duration = 0;
        } else if (!computedStyles.transitionDuration.endsWith('ms')) {
            duration *= 1000;
        }

        return duration;
    }

    return 0;
}

/**
 * Get the transition duration (in ms) from a set of elements using their style declaration. If multiple elements have
 * transitions with different durations, the longest (maximum) will be returned.
 *
 * @param collection - A collection of elements to inspect.
 * @param currentDuration - An initial duration that cannot be undershot.
 * @param recursive - Should recursive search children of the provided elements.
 */
function getTransitionDurationElements(collection: HTMLCollection | NodeListOf<Element>,
                                       currentDuration = 0,
                                       recursive = false) {
    for (const element of collection) {
        const transitionDuration = extractTransitionDuration(window.getComputedStyle(element));

        if (currentDuration < transitionDuration) {
            currentDuration = transitionDuration;
        }

        if (recursive && element.childElementCount > 0) {
            currentDuration = getTransitionDurationElements(element.children, currentDuration);
        }
    }

    return currentDuration;
}

/**
 * Get the transition duration (in ms) from an element (and potential children) using their style declaration. If
 * multiple elements in the tree have transitions with different durations, the longest (maximum) will be returned.
 *
 * @param element - The element of which the transition duration should be evaluated.
 * @param recursive - Can be a boolean for evaluating all/none of the elements children; or a selector string.
 * @param computedStyle - Additional style declaration that should be considered.
 */
export function getTransitionDuration(element: Element,
                                      recursive: boolean | string = false,
                                      computedStyle?: CSSStyleDeclaration) {
    computedStyle ??= window.getComputedStyle(element);

    let currentDuration = extractTransitionDuration(computedStyle);

    if (recursive) {
        currentDuration = typeof recursive === 'string'
                          ? getTransitionDurationElements(element.querySelectorAll(recursive), currentDuration)
                          : getTransitionDurationElements(element.children, currentDuration, true);
    }

    return currentDuration;
}

/**
 * Gets a value indicating if the given element has a transition defined in its style declaration.
 *
 * @param element - The element of which the transition duration should be evaluated.
 * @param recursive - Can be a boolean for evaluating all/none of the elements children; or a selector string.
 * @param computedStyle - Additional style declaration that should be considered.
 */
// TODO(julian): Probably remove this... Absolutely not necessary if we can get the duration directly with a fallback of
//  zero.
export function hasTransition(element: Element,
                              recursive: boolean | string = false,
                              computedStyle?: CSSStyleDeclaration) {
    return getTransitionDuration(element, recursive, computedStyle) > 0;
}

/**
 * Return a promise that resolves when an elements transition ended or cancelled.
 *
 * @param element - The element that runs the transition.
 */
export function waitForTransitionEnd(element: HTMLElement) {
    return new Promise((resolve) => {
        element.ontransitionend = resolve;
        element.ontransitioncancel = resolve;
    });
}

/**
 * Simple transition routine helper function. This function controls a transition by assigning a class ("from") for one
 * repaint/frame to an element that can kick-off a CSS transition. Another class ("to") will be assigned during the
 * whole transition and removed on transition end.
 *
 * @param element - The element that transitions.
 * @param fromClass - The initial class that kicks off the CSS transition.
 * @param toClass - The class that holds the destination CSS styling.
 */
export async function transitionRoutine(element: HTMLElement, fromClass: string, toClass: string) {
    // Start
    element.classList.remove(toClass);
    element.classList.add(fromClass);

    await waitForNextRepaint();

    // Initiate transition
    element.classList.remove(fromClass);
    element.classList.add(toClass);

    // Let transition events call the end function (remove transition classes)
    await new Promise<void>((resolve) => {
        const end = () => {
            element.classList.remove(toClass);
            resolve();
        };
        element.ontransitionend = end;
        element.ontransitioncancel = end;
    });
}
