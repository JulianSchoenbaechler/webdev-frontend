/*!
 * General utility functions and types used in frontend development.
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

import { TimeoutError } from './timeout-error';


//      _/_/_/_/_/  _/      _/  _/_/_/    _/_/_/_/    _/_/_/
//         _/        _/  _/    _/    _/  _/        _/
//        _/          _/      _/_/_/    _/_/_/      _/_/
//       _/          _/      _/        _/              _/
//      _/          _/      _/        _/_/_/_/  _/_/_/
//______________________________________________________________________________________________________________________

export type Timeout = { promise: Promise<void>, cancel: (reason?: any) => void };


//         _/    _/  _/_/_/_/_/  _/_/_/  _/          _/_/_/
//        _/    _/      _/        _/    _/        _/
//       _/    _/      _/        _/    _/          _/_/
//      _/    _/      _/        _/    _/              _/
//       _/_/        _/      _/_/_/  _/_/_/_/  _/_/_/
//______________________________________________________________________________________________________________________

/**
 * Simple debounce function that buffers calls and fires them in specified intervals. The first call of a series will
 * fire the provided function immediately (preventing debounce delays). Afterward, calls are buffered for a given delay
 * duration.
 *
 * @param func - The function to debounce.
 * @param delay - The debounce buffer delay.
 */
export function debounce(func: Function, delay = 100) {
    let timeout = -1;
    let mustDispatch = false;

    const evaluateCall: Function = function (this: any) {
        if (mustDispatch) {
            // Staged calls
            func.apply(this, arguments);
            timeout = window.setTimeout(evaluateCall, delay);
            mustDispatch = false;
        } else {
            // No more calls necessary; stop debounce
            timeout = -1;
        }
    };

    return function wrapper(this: any) {
        mustDispatch = true;

        // Dispatch immediate
        if (timeout === -1) {
            evaluateCall.apply(this, arguments);
        }
    };
}

/**
 * A wrapper function for event listeners that should call their handlers only once.
 *
 * @param func - The event listener function.
 * @remarks Usually one would use the 'once' option on the initial 'addEventListener()' call. However, this gives us
 *          better compatibility for older browsers older than 2017; especially Edge 12.
 */
export function dispatchOnceHandler(func: (this: any, event: Event) => void) {
    // NOTE(julian): Usually one would use the 'once' option on the initial 'addEventListener()' call. However, this
    //  gives us better compatibility for older browsers older than 2017; especially Edge 12.
    return function handler(this: any, event: Event) {
        this.removeEventListener(event.type, handler);
        func.apply(this, [event]);
    };
}

/**
 * Returns a promise that waits for the next browser repaint (animation frame listener).
 */
export function waitForNextRepaint() {
    // NOTE(julian): The doubly-nested call is necessary due to a browser inconsistency, notably in Chromium:
    //  https://issues.chromium.org/issues/41292070
    //  The next animation frame potentially runs before the next reflow/render event of the browser. As I understand
    //  it, this happens for the first call to 'requestAnimationFrame()' between queued events (basically in one frame).
    //  As there is no way of checking if an animation frame was already requested before the next event, we just fire
    //  it twice and await 2 frames at once, guaranteeing us at least one full browser render call. Downside to this is
    //  an artificially introduced pause of >=16.7ms.
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/**
 * Returns a {@link Timeout} that contains a timeout promise as well as a cancellation function.
 *
 * @param timeout The timeout duration in milliseconds.
 * @see Timeout
 */
export function waitForTimeout(timeout: number): Timeout {
    let id: number;
    let innerResolve: (() => void) | undefined;
    let innerReject: ((reason?: any) => void) | undefined;

    const promise = new Promise<void>((resolve, reject) => {
        innerResolve = resolve;
        innerReject = reject;
        id = window.setTimeout(() => {
            innerResolve = undefined;
            innerReject = undefined;
            resolve();
        }, timeout);
    });

    return {
        promise,
        cancel(reason?: any) {
            window.clearTimeout(id);

            if (reason) {
                innerReject!(reason);
            } else {
                innerResolve!();
            }
        },
    };
}

/**
 * Returns a promise with a given timeout after which it rejects with a {@link TimeoutError} if the wrapped promise has
 * not resolved.
 *
 * @param promise - The wrapped promise on which to apply a timeout.
 * @param timeout - The timeout duration in milliseconds.
 * @see TimeoutError
 */
export function promiseWithTimeout(promise: Promise<any>, timeout: number) {
    return new Promise((resolve, reject) => {
        const id = setTimeout(() => reject(new TimeoutError()), timeout);
        // NOTE(julian): Promise.finally() not available before 2020 and we do not want to include more polyfills...
        promise.then((value) => {
            window.clearTimeout(id);
            resolve(value);
        }).catch((reason) => {
            window.clearTimeout(id);
            reject(reason);
        });
    });
}
