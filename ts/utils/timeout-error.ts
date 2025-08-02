/*!
 * Timeout error instance type.
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

/**
 * Basic timeout error instance.
 */
export class TimeoutError extends Error {
    constructor(message?: string, ...params: any) {
        super(...params);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TimeoutError);
        }

        this.name = 'TimeoutError';
        this.message = message ?? 'Operation timed-out!';
    }
}
